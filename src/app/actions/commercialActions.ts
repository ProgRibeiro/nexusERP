"use server";

import { prisma } from "@/lib/db";
import { AuthError, requirePortalAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type CommercialLeadStatus = "NOVO" | "EM_ANDAMENTO" | "CONVERTIDO" | "PERDIDO";

export interface CommercialLeadSummary {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  source: string | null;
  status: CommercialLeadStatus;
  value: number;
  closePrediction: Date | null;
  stageId: string | null;
  stageName: string;
  ownerName: string | null;
  updatedAt: Date;
  nextFollowUpAt: Date | null;
}

export interface CommercialPipelineColumn {
  id: string;
  name: string;
  order: number;
  leads: CommercialLeadSummary[];
}

export interface CommercialDashboardSnapshot {
  totals: {
    leads: number;
    openLeads: number;
    convertedLeads: number;
    lostLeads: number;
    openValue: number;
  };
  stageBreakdown: Array<{ stageId: string; stageName: string; leads: number; amount: number }>;
  dueFollowUps: Array<{
    id: string;
    leadName: string;
    type: string;
    description: string;
    date: Date;
    ownerName: string | null;
  }>;
}

function hasCommercialWriteAccess(session: { platformRole?: string; permissions: string[] }) {
  if (session.platformRole === "SUPER_ADMIN" || session.platformRole === "SALES_MANAGER") return true;
  return session.permissions.includes("crm.manage") || session.permissions.includes("crm.write");
}

export async function getCommercialPipelineAction(): Promise<{
  success: true;
  pipeline: CommercialPipelineColumn[];
} | {
  success: false;
  error: string;
}> {
  try {
    await requirePortalAccess("commercial");
    const stages = await prisma.crmStage.findMany({
      orderBy: { order: "asc" },
      include: {
        leads: {
          include: {
            owner: { select: { name: true } },
            activities: {
              where: { done: false },
              orderBy: { date: "asc" },
              take: 1,
            },
          },
          orderBy: [{ updatedAt: "desc" }],
        },
      },
    });

    const pipeline = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      leads: stage.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        status: lead.status as CommercialLeadStatus,
        value: lead.value,
        closePrediction: lead.closePrediction,
        stageId: lead.pipelineStageId,
        stageName: stage.name,
        ownerName: lead.owner?.name || null,
        updatedAt: lead.updatedAt,
        nextFollowUpAt: lead.activities[0]?.date || null,
      })),
    }));

    return { success: true, pipeline };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    throw error;
  }
}

export async function getCommercialDashboardAction(): Promise<{
  success: true;
  snapshot: CommercialDashboardSnapshot;
} | {
  success: false;
  error: string;
}> {
  try {
    await requirePortalAccess("commercial");
    const [allLeads, overdueActivities, grouped] = await Promise.all([
      prisma.lead.findMany({
        select: {
          status: true,
          value: true,
        },
      }),
      prisma.crmActivity.findMany({
        where: { done: false, date: { lte: new Date() } },
        orderBy: { date: "asc" },
        take: 8,
        select: {
          id: true,
          type: true,
          description: true,
          date: true,
          lead: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.crmStage.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          leads: {
            select: { value: true },
          },
        },
      }),
    ]);

    const totals = allLeads.reduce(
      (acc, current) => {
        acc.leads += 1;
        if (current.status !== "CONVERTIDO" && current.status !== "PERDIDO") {
          acc.openLeads += 1;
          acc.openValue += current.value;
        }
        if (current.status === "CONVERTIDO") acc.convertedLeads += 1;
        if (current.status === "PERDIDO") acc.lostLeads += 1;
        return acc;
      },
      { leads: 0, openLeads: 0, convertedLeads: 0, lostLeads: 0, openValue: 0 }
    );

    const stageBreakdown = grouped.map((stage) => ({
      stageId: stage.id,
      stageName: stage.name,
      leads: stage.leads.length,
      amount: stage.leads.reduce((sum, lead) => sum + lead.value, 0),
    }));

    return {
      success: true,
      snapshot: {
        totals,
        stageBreakdown,
        dueFollowUps: overdueActivities.map((activity) => ({
          id: activity.id,
          leadName: activity.lead.name,
          type: activity.type,
          description: activity.description,
          date: activity.date,
          ownerName: activity.user.name,
        })),
      },
    };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    throw error;
  }
}

export async function getCommercialLeadsAction(): Promise<{
  success: true;
  leads: CommercialLeadSummary[];
} | {
  success: false;
  error: string;
}> {
  const pipeline = await getCommercialPipelineAction();
  if (!pipeline.success) return pipeline;
  return {
    success: true,
    leads: pipeline.pipeline.flatMap((column) => column.leads),
  };
}

export async function getCommercialAgendaAction(): Promise<{
  success: true;
  activities: Array<{
    id: string;
    leadName: string;
    type: string;
    description: string;
    date: Date;
    done: boolean;
    ownerName: string | null;
  }>;
} | {
  success: false;
  error: string;
}> {
  try {
    await requirePortalAccess("commercial");
    const activities = await prisma.crmActivity.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { date: "asc" },
      take: 50,
      include: {
        lead: { select: { name: true } },
        user: { select: { name: true } },
      },
    });
    return {
      success: true,
      activities: activities.map((activity) => ({
        id: activity.id,
        leadName: activity.lead.name,
        type: activity.type,
        description: activity.description,
        date: activity.date,
        done: activity.done,
        ownerName: activity.user.name,
      })),
    };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    throw error;
  }
}

export async function createCommercialLeadAction(data: {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  source?: string;
  value?: number;
  notes?: string;
  closePrediction?: string;
}) {
  const session = await requirePortalAccess("commercial");
  if (!hasCommercialWriteAccess(session)) {
    throw new AuthError("SEM_PERMISSAO", "Usuário sem permissão para criar leads.");
  }

  const firstStage = await prisma.crmStage.findFirst({
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (!firstStage) {
    throw new Error("Nenhum estágio comercial configurado no pipeline.");
  }

  const lead = await prisma.lead.create({
    data: {
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      company: data.company?.trim() || null,
      source: data.source?.trim() || null,
      value: Number.isFinite(data.value) ? Number(data.value) : 0,
      notes: data.notes?.trim() || null,
      closePrediction: data.closePrediction ? new Date(data.closePrediction) : null,
      status: "NOVO",
      pipelineStageId: firstStage.id,
      ownerId: session.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "CRIACAO",
      entity: "Lead",
      entityId: lead.id,
      changesJson: JSON.stringify({ origin: "commercial.portal", leadId: lead.id }),
    },
  });
  revalidatePath("/comercial");
  revalidatePath("/comercial/leads");
  revalidatePath("/comercial/pipeline");

  return { success: true as const, leadId: lead.id };
}
