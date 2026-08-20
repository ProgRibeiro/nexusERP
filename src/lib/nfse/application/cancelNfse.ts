import { prisma } from "@/lib/db";
import { DuqueDeCaxiasSoapClient } from "../infrastructure/duqueDeCaxiasSoapClient";
import { CertificateProvider, CertificateInfo } from "../infrastructure/certProvider";

export interface CancelNfseResult {
  success: boolean;
  nfseId: string;
  status: string;
  error?: string;
}

/**
 * Cancela manualmente uma NFS-e previamente autorizada
 */
export async function cancelNfse(
  nfseId: string,
  cancelReasonCode: string,
  cancelReasonDesc: string,
  userId: string
): Promise<CancelNfseResult> {
  const record = await prisma.nfseRecord.findUnique({
    where: { id: nfseId },
  });

  if (!record) {
    throw new Error(`Registro NFS-e ${nfseId} não encontrado.`);
  }

  if (record.status !== "AUTORIZADA") {
    throw new Error(`A NFS-e está com status ${record.status} e não pode ser cancelada.`);
  }

  if (!cancelReasonDesc || cancelReasonDesc.trim().length < 15) {
    throw new Error("Informe uma justificativa detalhada para o cancelamento (mínimo 15 caracteres).");
  }

  // Tenta carregar o certificado digital A1 para assinatura do cancelamento
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
      // prossegue
    }
  }

  const env = (record.environment || "homologation") as "homologation" | "production";
  const client = new DuqueDeCaxiasSoapClient(env, certInfo);

  const cancelXml =
    `<CancelarNfseEnvio xmlns="http://www.sped.fazenda.gov.br/nfse">` +
    `<Pedido>` +
    `<InfPedidoCancelamento Id="CAN${record.id}">` +
    `<IdentificacaoNfse>` +
    `<Numero>${record.nfseNumber || record.dpsNumber}</Numero>` +
    `<ChaveAcesso>${record.accessKey || ""}</ChaveAcesso>` +
    `</IdentificacaoNfse>` +
    `<CodigoCancelamento>${cancelReasonCode || "1"}</CodigoCancelamento>` +
    `<MotivoCancelamento>${cancelReasonDesc}</MotivoCancelamento>` +
    `</InfPedidoCancelamento>` +
    `</Pedido>` +
    `</CancelarNfseEnvio>`;

  const soapEnvelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Header><cabecalho versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse"><versaoDados>1.00</versaoDados></cabecalho></soap:Header>` +
    `<soap:Body>${cancelXml}</soap:Body>` +
    `</soap:Envelope>`;

  const response = await client.cancelarNfse(soapEnvelope);

  if (response.isSuccess || env === "homologation") {
    const updated = await prisma.nfseRecord.update({
      where: { id: nfseId },
      data: {
        status: "CANCELADA",
        cancelReasonCode,
        cancelReasonDesc,
        cancelledAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "CANCELAMENTO",
        entity: "NfseRecord",
        entityId: nfseId,
        changesJson: JSON.stringify({ reasonCode: cancelReasonCode, reasonDesc: cancelReasonDesc }),
      },
    });

    return {
      success: true,
      nfseId: updated.id,
      status: "CANCELADA",
    };
  } else {
    return {
      success: false,
      nfseId,
      status: record.status,
      error: response.errorMessage || "Prefeitura de Duque de Caxias recusou o cancelamento.",
    };
  }
}
