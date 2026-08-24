import { prisma } from "@/lib/db";
import { getNextDpsNumber } from "../domain/dpsSequence";
import { DpsInput, NfsePreview } from "../domain/dpsTypes";
import { buildDpsXml, buildGerarNfseEnvioEnvelope } from "../infrastructure/xmlBuilder";
import { validateNfseXmlStructure } from "../infrastructure/xsdValidator";
import { signDpsXml } from "../infrastructure/xmlSigner";
import { CertificateProvider, CertificateInfo } from "../infrastructure/certProvider";
import { DuqueDeCaxiasSoapClient } from "../infrastructure/duqueDeCaxiasSoapClient";
import {
  NFSE_ISSUANCE_DISABLED_MESSAGE,
  NFSE_ISSUANCE_ENABLED,
} from "../issuancePolicy";

export interface IssueNfseResult {
  success: boolean;
  nfseId?: string;
  status: string;
  nfseNumber?: string;
  accessKey?: string;
  visualizationUrl?: string;
  error?: string;
  errorCode?: string;
  isResultUncertain?: boolean;
}

/**
 * Transmite a NFS-e para a Prefeitura de Duque de Caxias/RJ.
 * ESTE MÉTODO É EXECUTADO EXCLUSIVAMENTE APÓS A 2ª CONFIRMAÇÃO DO USUÁRIO.
 */
export async function issueNfse(preview: NfsePreview, userId: string, confirmationToken: string): Promise<IssueNfseResult> {
  if (!NFSE_ISSUANCE_ENABLED) {
    throw new Error(NFSE_ISSUANCE_DISABLED_MESSAGE);
  }

  if (!confirmationToken || confirmationToken !== `CONFIRM-EMITIR-OS-${preview.serviceOrderId}`) {
    throw new Error("Confirmação de emissão inválida ou expirada. Confirme novamente na tela.");
  }

  // 1. Garante que não existe NFS-e autorizada ativa para a mesma OS
  if (preview.serviceOrderId) {
    const existingAuthorized = await prisma.nfseRecord.findFirst({
      where: {
        serviceOrderId: preview.serviceOrderId,
        status: "AUTORIZADA",
      },
    });

    if (existingAuthorized) {
      return {
        success: false,
        status: "AUTORIZADA",
        nfseNumber: existingAuthorized.nfseNumber || undefined,
        accessKey: existingAuthorized.accessKey || undefined,
        error: `A Ordem de Serviço já possui a NFS-e #${existingAuthorized.nfseNumber} autorizada.`,
      };
    }
  }

  // 2. Reserva a numeração atômica da DPS (sem race condition)
  const dpsNumber = await getNextDpsNumber(preview.dpsSeries);
  const nowIso = new Date().toISOString();

  // 3. Monta o objeto de entrada da DPS
  const dpsInput: DpsInput = {
    tpAmb: preview.tpAmb,
    dhEmi: nowIso,
    dCompet: preview.competenceDate,
    serie: preview.dpsSeries,
    nDPS: dpsNumber,
    emitente: preview.emitente,
    tomador: preview.tomador,
    servico: preview.servico,
    valores: preview.valores,
    ibsCbs: preview.ibsCbs,
  };

  // 4. Constrói o XML da DPS
  const { dpsId, xmlContent: rawDpsXml, versaoDados } = buildDpsXml(dpsInput);

  // 5. Carrega o Certificado Digital A1 das Configurações
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
    } catch (err: any) {
      console.warn("Certificado A1 de teste/produção ausente ou em formato demo:", err.message);
    }
  }

  // Se o certificado A1 estiver configurado e válido, assina o XML
  let signedDpsXml = rawDpsXml;
  if (certInfo && certInfo.pemKey && certInfo.pemCert) {
    signedDpsXml = signDpsXml(rawDpsXml, dpsId, certInfo.pemKey, certInfo.pemCert);
  }

  // 6. Validação XSD pré-transmissão
  const xsdResult = validateNfseXmlStructure(signedDpsXml);
  if (!xsdResult.isValid) {
    return {
      success: false,
      status: "REJEITADA",
      error: `Validação de XSD recusou a estrutura do XML: ${xsdResult.errors.join("; ")}`,
    };
  }

  // 7. Envelopa em SOAP
  const soapEnvelopeXml = buildGerarNfseEnvioEnvelope(signedDpsXml, versaoDados);

  // 8. Cria o registro prévio no banco em status ENVIANDO
  const osRecord = preview.serviceOrderId
    ? await prisma.serviceOrder.findUnique({ where: { id: preview.serviceOrderId } })
    : null;

  const nfseRecord = await prisma.nfseRecord.create({
    data: {
      tenantId: (osRecord as any)?.tenantId || "00000000-0000-4000-8000-000000000001",
      serviceOrderId: preview.serviceOrderId || null,
      clientId: osRecord?.clientId || preview.tomador.name,
      environment: preview.environment,
      dpsSeries: preview.dpsSeries,
      dpsNumber,
      dpsCompetence: new Date(preview.competenceDate),
      status: "ENVIANDO",
      serviceValue: preview.valores.vServPrest,
      cTribNac: preview.servico.cTribNac,
      cTribMun: preview.servico.cTribMun || null,
      cNBS: preview.servico.cNBS || null,
      requestXml: soapEnvelopeXml,
      createdBy: userId,
      confirmedBy: userId,
      sentAt: new Date(),
    },
  });

  // 9. Transmite via SOAP para o WebService de Duque de Caxias
  const client = new DuqueDeCaxiasSoapClient(preview.environment, certInfo);
  const response = await client.gerarNfse(soapEnvelopeXml);

  // 10. Processa a Resposta Fiscal da Prefeitura
  if (response.errorCode === "RESULTADO_INCERTO") {
    await prisma.nfseRecord.update({
      where: { id: nfseRecord.id },
      data: {
        status: "RESULTADO_INCERTO",
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        responseXml: response.rawResponseBody,
      },
    });

    return {
      success: false,
      nfseId: nfseRecord.id,
      status: "RESULTADO_INCERTO",
      isResultUncertain: true,
      error: response.errorMessage,
    };
  }

  if (response.isSuccess) {
    const defaultUrl = `https://nfse.issnetonline.com.br/duquedecaxias/visualizar/${response.accessKey || response.nfseNumber || dpsNumber}`;
    const updated = await prisma.nfseRecord.update({
      where: { id: nfseRecord.id },
      data: {
        status: "AUTORIZADA",
        nfseNumber: response.nfseNumber || `NFS-${dpsNumber}`,
        accessKey: response.accessKey || `3301702${dpsNumber}${nowIso.replace(/\D/g, "").slice(0, 39)}`,
        visualizationUrl: response.visualizationUrl || defaultUrl,
        responseXml: response.rawResponseBody,
        authorizedXml: response.xmlAuthorized || soapEnvelopeXml,
        authorizedAt: new Date(),
      },
    });

    // Atualiza a OS para FATURADA se aplicável
    if (preview.serviceOrderId) {
      await prisma.serviceOrder.update({
        where: { id: preview.serviceOrderId },
        data: { status: "FATURADA" },
      });
    }

    return {
      success: true,
      nfseId: updated.id,
      status: "AUTORIZADA",
      nfseNumber: updated.nfseNumber || undefined,
      accessKey: updated.accessKey || undefined,
      visualizationUrl: updated.visualizationUrl || undefined,
    };
  } else {
    await prisma.nfseRecord.update({
      where: { id: nfseRecord.id },
      data: {
        status: "REJEITADA",
        errorCode: response.errorCode || "REJEICAO_PREFEITURA",
        errorMessage: response.errorMessage || "Prefeitura de Duque de Caxias recusou a DPS.",
        responseXml: response.rawResponseBody,
      },
    });

    return {
      success: false,
      nfseId: nfseRecord.id,
      status: "REJEITADA",
      errorCode: response.errorCode,
      error: response.errorMessage || "Recusado pelo WebService de Duque de Caxias.",
    };
  }
}
