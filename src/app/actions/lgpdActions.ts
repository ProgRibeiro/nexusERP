"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";

/**
 * Coleta todos os dados de um cliente no banco de dados para exportação de portabilidade (LGPD)
 */
export async function exportClientData(clientId: string) {
  try {
    await requirePermission("admin.all");

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        contacts: true,
        addresses: true,
        equipments: true,
        quotes: {
          include: {
            items: true,
          }
        },
        serviceOrders: {
          include: {
            items: true,
            materials: true,
          }
        },
        contracts: {
          include: {
            items: true,
          }
        },
        accountsReceivable: true,
        invoices: true,
      }
    });

    if (!client) {
      return { success: false, error: "Cliente não localizado." };
    }

    return { success: true, data: client };
  } catch (error: any) {
    logger.error("Erro ao exportar prontuário LGPD:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Anonimiza dados pessoais identificáveis (PII) de um cliente para cumprir o Direito ao Esquecimento (LGPD)
 */
export async function anonymizeClient(clientId: string) {
  try {
    const session = await requirePermission("admin.all");

    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return { success: false, error: "Cliente não localizado." };
    }

    const timestamp = new Date().toLocaleDateString("pt-BR");

    // 1. Anonimiza os contatos vinculados
    await prisma.clientContact.updateMany({
      where: { clientId },
      data: {
        name: "CONTATO ANONIMIZADO",
        email: "anonimo@lgpd.com",
        phone: "(00) 0000-0000",
      }
    });

    // 2. Mascara e anonimiza o perfil do cliente
    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: "CLIENTE ANONIMIZADO (LGPD)",
        socialName: "EMPRESA ANONIMIZADA (LGPD)",
        fancyName: "NOME FANTASIA ANONIMIZADO (LGPD)",
        cpfCnpj: `ANON-${clientId.slice(-8)}`,
        email: "anonimo@lgpd.com",
        phone: "(00) 0000-0000",
        whatsapp: "",
        notes: `Dados pessoais anonimizados em ${timestamp} conforme solicitação do titular (Artigo 18, IV da LGPD). Código ID preservado para integridade histórica.`,
        status: "INATIVO",
      }
    });

    // 3. Registra na trilha de auditoria
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "EDICAO",
        entity: "Cliente",
        entityId: clientId,
        changesJson: JSON.stringify({ anonymized: true }),
      }
    });

    revalidatePath("/clientes");
    return { success: true };
  } catch (error: any) {
    logger.error("Erro ao anonimizar cliente LGPD:", error);
    return { success: false, error: error.message };
  }
}
