"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { prepareNfsePreview } from "@/lib/nfse/application/prepareNfsePreview";
import { issueNfse } from "@/lib/nfse/application/issueNfse";
import { reconcileNfseStatus } from "@/lib/nfse/application/queryNfse";
import { cancelNfse } from "@/lib/nfse/application/cancelNfse";
import { CertificateProvider } from "@/lib/nfse/infrastructure/certProvider";
import { revalidatePath } from "next/cache";

/**
 * Obtém a Prévia Fiscal para conferência assistida.
 * NUNCA transmite nada ao fiscal.
 */
export async function getNfsePreviewAction(serviceOrderId: string) {
  try {
    await requirePermission("faturamento.read");
    const preview = await prepareNfsePreview(serviceOrderId);
    return { success: true as const, preview };
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Não foi possível gerar a prévia fiscal.",
    };
  }
}

/**
 * Transmite a NFS-e após a 2ª confirmação humana explícita do usuário.
 */
export async function confirmAndIssueNfseAction(serviceOrderId: string, confirmationToken: string) {
  try {
    const session = await requirePermission("faturamento.read");
    const preview = await prepareNfsePreview(serviceOrderId);

    if (!preview.isValid) {
      throw new Error(`Existem pendências fiscais: ${preview.validationErrors.join("; ")}`);
    }

    const result = await issueNfse(preview, session.userId, confirmationToken);

    revalidatePath(`/ordens-servico`);
    revalidatePath(`/faturamento`);

    return result;
  } catch (err: any) {
    return {
      success: false as const,
      status: "ERRO",
      error: err.message || "Não foi possível transmitir a NFS-e.",
    };
  }
}

/**
 * Cancela manualmente uma NFS-e autorizada
 */
export async function cancelNfseAction(nfseId: string, cancelReasonCode: string, cancelReasonDesc: string) {
  try {
    const session = await requirePermission("admin.all");
    const res = await cancelNfse(nfseId, cancelReasonCode, cancelReasonDesc, session.userId);

    revalidatePath("/faturamento");
    revalidatePath("/ordens-servico");

    return res;
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Erro ao cancelar a NFS-e.",
    };
  }
}

/**
 * Reconcilia o status de uma NFS-e com o WebService da Prefeitura sem duplicar
 */
export async function reconcileNfseAction(nfseId: string) {
  try {
    await requirePermission("faturamento.read");
    const res = await reconcileNfseStatus(nfseId);

    revalidatePath("/faturamento");
    revalidatePath("/ordens-servico");

    return res;
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Erro na reconciliação fiscal com a Prefeitura.",
    };
  }
}

/**
 * Carrega as configurações fiscais do emitente e validade do certificado A1
 */
export async function getCompanyFiscalConfigAction() {
  try {
    await requireAuth();
    const configSetting = await prisma.setting.findUnique({
      where: { key: "company.fiscal.config" },
    });
    const certSetting = await prisma.setting.findUnique({
      where: { key: "company.fiscal.cert" },
    });

    const config = configSetting ? JSON.parse(configSetting.value) : {
      cnpj: "12.345.678/0001-99",
      im: "123456",
      corporateName: "NEXUS CLIMATIZACAO E SERVICOS LTDA",
      tradeName: "Nexus Ar Condicionado",
      crt: "SIMPLES_NACIONAL",
      cLocEmi: "3301702", // Duque de Caxias / RJ
      dpsSeries: "1",
      environment: "homologation",
      defaultCTribNac: "140101",
      defaultCTribMun: "1401",
      defaultNbs: "104011000",
      issRate: 5.0,
      issRetido: false,
    };

    let certSummary = {
      isConfigured: false,
      subject: "Nenhum certificado A1 gravado",
      validTo: null as string | null,
      isExpired: false,
    };

    if (certSetting) {
      try {
        const certData = JSON.parse(certSetting.value);
        if (certData.pfxBase64) {
          const parsed = CertificateProvider.parsePfxBase64(certData.pfxBase64, certData.passphrase || "");
          certSummary = {
            isConfigured: true,
            subject: parsed.subject,
            validTo: parsed.validTo.toLocaleDateString("pt-BR"),
            isExpired: parsed.isExpired,
          };
        }
      } catch (err: any) {
        certSummary.subject = "Certificado PFX cadastrado em modo demonstração/incompleto.";
      }
    }

    return {
      success: true as const,
      config,
      certSummary,
    };
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Erro ao carregar configurações fiscais.",
    };
  }
}

/**
 * Salva os parâmetros fiscais do emitente
 */
export async function saveCompanyFiscalConfigAction(input: any) {
  try {
    await requirePermission("admin.all");

    await prisma.setting.upsert({
      where: { key: "company.fiscal.config" },
      update: { value: JSON.stringify(input) },
      create: { key: "company.fiscal.config", value: JSON.stringify(input) },
    });

    revalidatePath("/configuracoes");

    return { success: true as const };
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Erro ao salvar parâmetros fiscais.",
    };
  }
}

/**
 * Salva e valida o arquivo de certificado A1 PFX
 */
export async function saveCertificatePfxAction(pfxBase64: string, passphrase = "") {
  try {
    await requirePermission("admin.all");

    // Valida o certificado PFX antes de salvar
    const certInfo = CertificateProvider.parsePfxBase64(pfxBase64, passphrase);
    if (certInfo.isExpired) {
      throw new Error(`O certificado informado expirou em ${certInfo.validTo.toLocaleDateString("pt-BR")}.`);
    }

    const payload = {
      pfxBase64,
      passphrase,
      subject: certInfo.subject,
      validTo: certInfo.validTo.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await prisma.setting.upsert({
      where: { key: "company.fiscal.cert" },
      update: { value: JSON.stringify(payload) },
      create: { key: "company.fiscal.cert", value: JSON.stringify(payload) },
    });

    revalidatePath("/configuracoes");

    return {
      success: true as const,
      subject: certInfo.subject,
      validTo: certInfo.validTo.toLocaleDateString("pt-BR"),
    };
  } catch (err: any) {
    return {
      success: false as const,
      error: err.message || "Não foi possível validar o certificado digital A1.",
    };
  }
}
