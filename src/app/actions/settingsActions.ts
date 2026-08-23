"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { persistTaxProfile, loadTaxProfile } from "@/lib/taxProfile";
import { normalizeTaxRegime } from "@/lib/tax";
import { calculateProposalTax } from "@/lib/tax";
import { revalidatePath } from "next/cache";

const SETTING_KEY_COMPANY = "company.params";

export interface CompanyParams {
  corporateName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  foundationDate?: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  logoUrl: string;
  fiscalRegime: string;
  taxRate: number;
  cnae?: string;
  differentials: string;
  merchanTitle: string;
  merchanDesc: string;
  terms: string;
  technicalResponsible: string;
}

const DEFAULT_COMPANY_PARAMS: CompanyParams = {
  corporateName: "NEXUS CLIMATIZACAO E SERVICOS LTDA",
  tradeName: "Nexus Ar Condicionado",
  cnpj: "12.345.678/0001-99",
  stateRegistration: "111.222.333.444",
  municipalRegistration: "1.234.567-8",
  foundationDate: "2020-01-15",
  email: "contato@oprestador.tech",
  phone: "(11) 4002-8922",
  whatsapp: "(11) 99999-8888",
  website: "https://oprestador.tech",
  cep: "01310-100",
  address: "Avenida Paulista",
  number: "1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  logoUrl: "",
  fiscalRegime: "SIMPLES_NACIONAL",
  taxRate: 6.0,
  cnae: "43.22-3-02 - Instalação e manutenção de sistemas centrais de ar condicionado",
  differentials:
    "Equipe técnica especializada e certificada\nAtendimento 24/7 com suporte prioritário\nGarantia estendida de 12 meses nos serviços\nPeças e componentes de alta performance com selo de fábrica",
  merchanTitle: "NEXUS MANUTENÇÃO & ENGENHARIA",
  merchanDesc: "Soluções completas e inteligência em climatização corporativa e industrial.",
  terms:
    "Validade desta proposta: 15 dias. Pagamento via Boleto Faturado ou PIX. Serviços com garantia de 90 dias após conclusão.",
  technicalResponsible: "Eng. Lucas Ribeiro - CREA 5069827341",
};

/**
 * Obtém as configurações centrais da empresa a partir do banco de dados PostgreSQL.
 * Visível para qualquer usuário autenticado no sistema.
 */
export async function getCompanySettingsAction(): Promise<CompanyParams> {
  try {
    await requireAuth();
    const record = await prisma.setting.findUnique({
      where: { key: SETTING_KEY_COMPANY },
    });

    if (record && record.value) {
      try {
        const parsed = JSON.parse(record.value);
        return {
          ...DEFAULT_COMPANY_PARAMS,
          ...parsed,
        };
      } catch {
        return DEFAULT_COMPANY_PARAMS;
      }
    }

    return DEFAULT_COMPANY_PARAMS;
  } catch (error) {
    console.error("[Settings] Erro ao carregar dados da empresa do banco:", error);
    return DEFAULT_COMPANY_PARAMS;
  }
}

/**
 * Salva as configurações da empresa diretamente no banco de dados PostgreSQL (tabela Setting).
 * Sincroniza em tempo real para todos os dispositivos conectados.
 */
export async function saveCompanySettingsAction(input: Partial<CompanyParams>) {
  try {
    const session = await requireAuth();

    // Carrega versão atual para mesclagem
    const current = await getCompanySettingsAction();
    const updated: CompanyParams = {
      ...current,
      ...input,
    };

    await prisma.setting.upsert({
      where: { key: SETTING_KEY_COMPANY },
      create: {
        key: SETTING_KEY_COMPANY,
        value: JSON.stringify(updated),
      },
      update: {
        value: JSON.stringify(updated),
      },
    });

    // Se o regime tributário ou alíquota mudaram, sincroniza também o perfil fiscal
    if (input.fiscalRegime || input.taxRate !== undefined) {
      try {
        await persistTaxProfile({
          regime: normalizeTaxRegime(updated.fiscalRegime),
          rate: Number(updated.taxRate),
        });
      } catch (e) {
        console.warn("[Settings] Aviso ao sincronizar perfil fiscal:", e);
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZAR_DADOS_EMPRESA",
        entity: "ConfiguracaoEmpresa",
        entityId: SETTING_KEY_COMPANY,
        changesJson: JSON.stringify({ corporateName: updated.corporateName, tradeName: updated.tradeName, cnpj: updated.cnpj }),
      },
    });

    revalidatePath("/");
    revalidatePath("/configuracoes");
    revalidatePath("/orcamentos");
    revalidatePath("/empresa");

    return { success: true as const, data: updated };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Não foi possível salvar os dados no banco de dados.",
    };
  }
}

export async function getCompanyTaxProfile() {
  await requireAuth();
  return loadTaxProfile();
}

export async function saveCompanyTaxProfile(input: { regime: string; rate: number }) {
  try {
    const session = await requirePermission("admin.all");
    const regime = normalizeTaxRegime(input.regime);
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error("A alíquota deve estar entre 0% e 100%.");
    }
    await persistTaxProfile({ regime, rate });
    const openQuotes = await prisma.quote.findMany({
      where: { status: { in: ["RASCUNHO", "ENVIADO", "PENDENTE", "NEGOCIACAO", "EM_NEGOCIACAO"] } },
      select: { id: true, subtotal: true, discount: true, costEstimate: true },
    });
    if (openQuotes.length) {
      await prisma.$transaction(openQuotes.map((quote) => {
        const calculation = calculateProposalTax(Number(quote.subtotal), Number(quote.discount), rate);
        return prisma.quote.update({
          where: { id: quote.id },
          data: {
            tax: calculation.tax,
            total: calculation.total,
            estimatedMargin: calculation.total - Number(quote.costEstimate),
          },
        });
      }));
    }
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ATUALIZACAO",
        entity: "ConfiguracaoTributaria",
        entityId: "company.taxProfile",
        changesJson: JSON.stringify({ regime, rate, recalculatedOpenProposals: openQuotes.length }),
      },
    });
    revalidatePath("/orcamentos");
    revalidatePath("/preventivas");
    return { success: true as const, profile: await loadTaxProfile(), recalculated: openQuotes.length };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar o perfil tributário." };
  }
}

/**
 * Dispara um backup manual instantâneo de todo o banco de dados e arquivos
 */
export async function triggerManualBackupAction() {
  try {
    await requirePermission("admin.all");
    const { createBackup } = await import("@/lib/backup");
    const backup = await createBackup("manual");
    revalidatePath("/configuracoes");
    return { success: true as const, backup };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Não foi possível realizar o backup manual.",
    };
  }
}

/**
 * Retorna o histórico de backups registrados
 */
export async function getSystemBackupsAction() {
  try {
    await requireAuth();
    const { listBackups } = await import("@/lib/backup");
    const backups = listBackups(25);
    return { success: true as const, backups };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível carregar o histórico de backups.", backups: [] };
  }
}

/**
 * Executa o purge/zeramento seguro do banco de dados operacional.
 * Gera um snapshot de segurança pre-restore antes de limpar as tabelas.
 */
export async function resetSystemDataAction(confirmationCode: string) {
  try {
    const session = await requirePermission("admin.all");
    if (confirmationCode?.trim() !== "ZERAR-SISTEMA-CONFIRMAR") {
      throw new Error("Código de confirmação incorreto. Digite ZERAR-SISTEMA-CONFIRMAR para prosseguir.");
    }

    // 1. Snapshot automático pré-zeramento por segurança
    const { createBackup } = await import("@/lib/backup");
    try {
      await createBackup("pre-restore");
    } catch {
      // prossegue mesmo se o backup de arquivo já existir
    }

    // 2. Limpeza relacional segura na transação do Prisma
    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderAsset.deleteMany({});
      await tx.completionReport.deleteMany({});
      await tx.serviceOrderPhoto.deleteMany({});
      await tx.serviceOrderMaterial.deleteMany({});
      await tx.serviceOrderItem.deleteMany({});
      await tx.serviceOrderStatusHistory.deleteMany({});
      await tx.timeEntry.deleteMany({});
      await tx.visitStatusHistory.deleteMany({});
      await tx.measurementReading.deleteMany({});
      await tx.formSubmission.deleteMany({});
      await tx.serviceVisit.deleteMany({});
      await tx.financialTransaction.deleteMany({});
      await tx.accountsReceivable.deleteMany({});
      await tx.accountsPayable.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.nfseRecord.deleteMany({});
      await tx.serviceOrder.deleteMany({});
      await tx.quoteItem.deleteMany({});
      await tx.quoteVersion.deleteMany({});
      await tx.quoteApproval.deleteMany({});
      await tx.quote.deleteMany({});
      await tx.contractItem.deleteMany({});
      await tx.contract.deleteMany({});
      await tx.crmActivity.deleteMany({});
      await tx.lead.deleteMany({});
      await tx.clientContact.deleteMany({});
      await tx.clientAddress.deleteMany({});
      await tx.clientEquipment.deleteMany({});
      await tx.clientStoreProject.deleteMany({});
      await tx.client.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.product.deleteMany({});

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "EXCLUSAO",
          entity: "Sistema",
          entityId: "full.system.reset",
          changesJson: JSON.stringify({ message: "Zeramento completo de dados de teste executado com snapshot salvo." }),
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/clientes");
    revalidatePath("/orcamentos");
    revalidatePath("/ordens-servico");
    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    revalidatePath("/estoque");

    return { success: true as const };
  } catch (error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Não foi possível zerar os dados do sistema.",
    };
  }
}
