"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const clamp = (value: string | undefined, max: number) => (value || "").slice(0, max);

export async function createErrorReport(data: {
  description: string; pageUrl: string; userAgent?: string; errorMessage?: string;
  errorStack?: string; consoleLogs?: string[]; screenshotData?: string;
}) {
  try {
    const session = await requireAuth();
    if (data.description.trim().length < 3) return { success: false, error: "Descreva brevemente o que aconteceu." };
    const screenshot = data.screenshotData?.startsWith("data:image/") && data.screenshotData.length <= 2_000_000 ? data.screenshotData : null;
    const report = await prisma.errorReport.create({ data: {
      userId: session.userId, description: clamp(data.description.trim(), 2000), pageUrl: clamp(data.pageUrl, 1000),
      userAgent: clamp(data.userAgent, 1000) || null, errorMessage: clamp(data.errorMessage, 4000) || null,
      errorStack: clamp(data.errorStack, 12000) || null, consoleLogsJson: JSON.stringify((data.consoleLogs || []).slice(-50).map(v=>clamp(v,1000))), screenshotData: screenshot,
    }});
    await prisma.auditLog.create({ data: { userId: session.userId, action: "CRIACAO", entity: "RelatoErro", entityId: report.id, changesJson: JSON.stringify({ pageUrl: report.pageUrl, status: report.status }) } });
    revalidatePath("/configuracoes");
    return { success: true, id: report.id };
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function getErrorReports() {
  await requirePermission("admin.all");
  return prisma.errorReport.findMany({ include: { user: { select: { name:true,email:true } } }, orderBy: { createdAt:"desc" }, take:200 });
}
