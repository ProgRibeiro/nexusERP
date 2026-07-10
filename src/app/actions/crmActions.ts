"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface LeadDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  status: string;
  value: number;
  closePrediction: Date | null;
  source: string | null;
  ownerId: string | null;
  ownerName: string | null;
  notes: string | null;
  createdAt: Date;
  activities: {
    id: string;
    type: string;
    description: string;
    date: Date;
    done: boolean;
  }[];
}

export interface PipelineStageDTO {
  id: string;
  name: string;
  order: number;
  leads: LeadDTO[];
}

/**
 * Obtém o pipeline e os estágios com os leads correspondentes
 */
export async function getCrmPipeline(): Promise<PipelineStageDTO[]> {
  try {
    const stages = await prisma.crmStage.findMany({
      orderBy: { order: "asc" },
      include: {
        leads: {
          include: {
            owner: true,
            activities: {
              orderBy: { date: "desc" },
            },
          },
        },
      },
    });

    return stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      leads: stage.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        value: lead.value,
        closePrediction: lead.closePrediction,
        source: lead.source,
        ownerId: lead.ownerId,
        ownerName: lead.owner?.name || null,
        notes: lead.notes,
        createdAt: lead.createdAt,
        activities: lead.activities.map((act) => ({
          id: act.id,
          type: act.type,
          description: act.description,
          date: act.date,
          done: act.done,
        })),
      })),
    }));
  } catch (error) {
    console.error("Erro ao obter pipeline CRM:", error);
    return [];
  }
}

/**
 * Cria um novo Lead
 */
export async function createLead(data: {
  name: string;
  email?: string;
  phone: string;
  company?: string;
  value: number;
  source?: string;
  ownerId?: string;
  notes?: string;
}) {
  try {
    // Busca o primeiro estágio (geralmente "Novo lead")
    const firstStage = await prisma.crmStage.findFirst({
      orderBy: { order: "asc" },
    });

    if (!firstStage) {
      throw new Error("Nenhum estágio de CRM configurado no banco de dados.");
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        company: data.company || null,
        value: data.value,
        source: data.source || null,
        ownerId: data.ownerId || null,
        notes: data.notes || null,
        pipelineStageId: firstStage.id,
        status: "NOVO",
      },
    });

    // Registrar histórico na auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.ownerId || null,
        action: "CRIACAO",
        entity: "Lead",
        entityId: lead.id,
        changesJson: JSON.stringify(lead),
      },
    });

    revalidatePath("/crm");
    return { success: true, lead };
  } catch (error: any) {
    console.error("Erro ao criar lead:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Move um lead de estágio no Kanban
 */
export async function moveLead(leadId: string, targetStageId: string, userId?: string) {
  try {
    const oldLead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { pipelineStage: true },
    });

    if (!oldLead) throw new Error("Lead não encontrado");

    const targetStage = await prisma.crmStage.findUnique({
      where: { id: targetStageId },
    });

    if (!targetStage) throw new Error("Estágio de destino não encontrado");

    let updatedStatus = oldLead.status;
    if (targetStage.name === "Aprovado") {
      updatedStatus = "CONVERTIDO";
    } else if (targetStage.name === "Perdido") {
      updatedStatus = "PERDIDO";
    } else {
      updatedStatus = "EM_ANDAMENTO";
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStageId: targetStageId,
        status: updatedStatus,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: "EDICAO",
        entity: "Lead",
        entityId: leadId,
        changesJson: JSON.stringify({
          oldStage: oldLead.pipelineStage?.name,
          newStage: targetStage.name,
          oldStatus: oldLead.status,
          newStatus: updatedStatus,
        }),
      },
    });

    revalidatePath("/crm");
    return { success: true, lead };
  } catch (error: any) {
    console.error("Erro ao mover lead:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Adiciona uma atividade de relacionamento (follow-up)
 */
export async function addCrmActivity(data: {
  leadId: string;
  userId: string;
  type: string; // LIGACAO, WHATSAPP, REUNIAO, VISITA, NOTA
  description: string;
  date: Date;
  done: boolean;
  notes?: string;
}) {
  try {
    const activity = await prisma.crmActivity.create({
      data: {
        leadId: data.leadId,
        userId: data.userId,
        type: data.type,
        description: data.description,
        date: data.date,
        done: data.done,
        notes: data.notes || null,
      },
    });

    revalidatePath("/crm");
    return { success: true, activity };
  } catch (error: any) {
    console.error("Erro ao adicionar atividade:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Converte um Lead em Cliente e gera um Orçamento automático
 */
export async function convertLeadToQuote(leadId: string, userId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) throw new Error("Lead não encontrado");

    // 1. Criar o Cliente caso ele não exista por CPF/CNPJ. Como no lead temos apenas nome/fone, criamos um cadastro básico.
    // Vamos gerar um CPF fictício para manter a integridade única
    const cleanPhone = lead.phone.replace(/\D/g, "");
    const fakeCpf = `LEAD-${lead.id.slice(0, 8)}`; // Código único do lead

    const client = await prisma.client.create({
      data: {
        name: lead.name,
        fancyName: lead.company || lead.name,
        cpfCnpj: fakeCpf, // Usar id único para evitar erro de duplicidade
        email: lead.email || "contato@lead.com.br",
        phone: lead.phone,
        status: "ATIVO",
        origin: lead.source || "CRM",
        notes: `Cliente convertido automaticamente a partir do Lead CRM. Notas originais: ${lead.notes || ""}`,
      },
    });

    // Criar um contato padrão
    await prisma.clientContact.create({
      data: {
        clientId: client.id,
        name: lead.name,
        email: lead.email || "contato@lead.com.br",
        phone: lead.phone,
        isApproval: true,
      },
    });

    // 2. Mover o lead para a coluna "Orçamento em criação" e marcar como CONVERTIDO
    const quoteStage = await prisma.crmStage.findFirst({
      where: { name: "Orçamento em criação" },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTIDO",
        pipelineStageId: quoteStage?.id || undefined,
      },
    });

    // 3. Criar o Orçamento (Quote) Rascunho vinculado a este cliente
    const count = await prisma.quote.count();
    const code = `Q-2026-${String(count + 1).padStart(4, "0")}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 15); // Validade 15 dias

    const quote = await prisma.quote.create({
      data: {
        code,
        clientId: client.id,
        status: "RASCUNHO",
        validUntil,
        total: lead.value, // assume valor previsto do lead
        subtotal: lead.value,
        notes: `Orçamento gerado a partir da conversão do lead: ${lead.name}.`,
      },
    });

    // Criar um item de serviço genérico com o valor estimado do lead
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        type: "SERVICO",
        description: "Serviço Técnico sob Diagnóstico",
        quantity: 1,
        unitPrice: lead.value,
        total: lead.value,
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId,
        action: "APROVACAO",
        entity: "Lead",
        entityId: leadId,
        changesJson: JSON.stringify({
          message: "Convertido para cliente e gerado orçamento",
          clientId: client.id,
          quoteId: quote.id,
        }),
      },
    });

    revalidatePath("/crm");
    revalidatePath("/orcamentos");
    revalidatePath("/clientes");

    return { success: true, client, quote };
  } catch (error: any) {
    console.error("Erro ao converter lead:", error);
    return { success: false, error: error.message };
  }
}
