import { prisma } from "@/lib/db";
import { DuqueDeCaxiasSoapClient } from "../infrastructure/duqueDeCaxiasSoapClient";
import { CertificateProvider, CertificateInfo } from "../infrastructure/certProvider";

/**
 * Reconcilia a situação de uma NFS-e pendente ou em estado RESULTADO_INCERTO
 * consultando a Prefeitura via DPS sem gerar nova emissão.
 */
export async function reconcileNfseStatus(nfseId: string): Promise<{ success: boolean; status: string; message: string }> {
  const record = await prisma.nfseRecord.findUnique({
    where: { id: nfseId },
  });

  if (!record) {
    throw new Error(`Registro NFS-e ${nfseId} não localizado.`);
  }

  // Tenta carregar o certificado digital para consulta segura
  const certSetting = await prisma.setting.findUnique({
    where: { key: "company.fiscal.cert" },
  });

  let certInfo: CertificateInfo | undefined;
  if (certSetting) {
    try {
      const certData = JSON.parse(certSetting.value);
      if (certData.pfxBase64) {
        certInfo = CertificateProvider.parsePfxBase64(certData.pfxBase64, certData.passphrase || "");
      }
    } catch {
      // prossegue consulta padrão
    }
  }

  const env = (record.environment || "homologation") as "homologation" | "production";
  const client = new DuqueDeCaxiasSoapClient(env, certInfo);

  // Constrói envelope de consulta por DPS
  const queryXml =
    `<ConsultarNfseDpsEnvio xmlns="http://www.sped.fazenda.gov.br/nfse">` +
    `<DPS>` +
    `<serie>${record.dpsSeries}</serie>` +
    `<nDPS>${record.dpsNumber}</nDPS>` +
    `</DPS>` +
    `</ConsultarNfseDpsEnvio>`;

  const soapEnvelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Header><cabecalho versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse"><versaoDados>1.00</versaoDados></cabecalho></soap:Header>` +
    `<soap:Body>${queryXml}</soap:Body>` +
    `</soap:Envelope>`;

  const response = await client.consultarNfsePorDps(soapEnvelope);

  if (response.isSuccess && (response.nfseNumber || response.accessKey)) {
    await prisma.nfseRecord.update({
      where: { id: nfseId },
      data: {
        status: "AUTORIZADA",
        nfseNumber: response.nfseNumber || record.nfseNumber || `NFS-${record.dpsNumber}`,
        accessKey: response.accessKey || record.accessKey,
        visualizationUrl: response.visualizationUrl || record.visualizationUrl,
        authorizedAt: new Date(),
        responseXml: response.rawResponseBody,
      },
    });

    if (record.serviceOrderId) {
      await prisma.serviceOrder.update({
        where: { id: record.serviceOrderId },
        data: { status: "FATURADA" },
      });
    }

    return {
      success: true,
      status: "AUTORIZADA",
      message: `Reconciliação concluída: NFS-e #${response.nfseNumber || record.dpsNumber} confirmada como AUTORIZADA na Prefeitura!`,
    };
  } else {
    return {
      success: false,
      status: record.status,
      message: response.errorMessage || "A Prefeitura ainda não retornou a autorização para esta DPS.",
    };
  }
}
