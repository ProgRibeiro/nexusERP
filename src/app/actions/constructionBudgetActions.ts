"use server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateAbc } from "@/lib/budget";

export async function listConstructionBudgets() {
  await requireAuth();
  return prisma.constructionBudget.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { items: true } } } });
}

export async function createConstructionBudget(formData: FormData) {
  await requireAuth();
  const workName = String(formData.get("workName") || "").trim();
  if (workName.length < 3) return { success: false as const, error: "Informe o nome da obra." };
  const code = `OB-${Date.now().toString().slice(-8)}`;
  const budget = await prisma.constructionBudget.create({ data: {
    code, workName, clientId: String(formData.get("clientId") || "") || null,
    contractorName: String(formData.get("contractorName") || "") || null,
    technicalLead: String(formData.get("technicalLead") || "") || null,
    address: String(formData.get("address") || "") || null,
    isPublic: formData.get("isPublic") === "on",
    procurementJson: JSON.stringify({ modality: formData.get("modality") || "", number: formData.get("procurementNumber") || "", agency: formData.get("agency") || "" }),
    enabledBasesJson: JSON.stringify(["SINAPI", "SICRO", "SEINFRA", "OUTRA"]),
  }});
  revalidatePath("/orcamentos-obras");
  return { success: true as const, id: budget.id };
}

export async function createConstructionBudgetAndOpen(formData: FormData) {
  const result = await createConstructionBudget(formData);
  if (!result.success) return;
  redirect(`/orcamentos-obras/${result.id}`);
}

export async function getConstructionBudget(id: string) {
  await requireAuth();
  return prisma.constructionBudget.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } }, bdi: true, periods: { orderBy: { period: "asc" } } } });
}

export async function searchConstructionReferences(base: string, search: string) {
  await requireAuth();
  return prisma.referencePriceItem.findMany({ where: { base, OR: [{ code: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }, orderBy: { code: "asc" }, take: 50 });
}

export async function addReferenceToBudget(formData: FormData) {
  await requireAuth();
  const item = await prisma.referencePriceItem.findUnique({ where: { id: String(formData.get("referenceId")) } });
  if (!item) return;
  const budgetId = String(formData.get("budgetId"));
  const last = await prisma.constructionBudgetItem.findFirst({ where: { budgetId, parentId: null }, orderBy: { sortOrder: "desc" } });
  const hierarchyCode = String((last?.sortOrder || 0) + 1);
  await prisma.constructionBudgetItem.create({ data: { budgetId, kind: "SERVICO", hierarchyCode, sortOrder: Number(hierarchyCode), description: item.description, sourceBase: item.base, sourceCode: item.code, sourceItemId: item.id, unit: item.unit, quantity: 1, referenceUnitPrice: item.unitPrice, adoptedUnitPrice: item.unitPrice, directTotal: item.unitPrice, totalWithBdi: item.unitPrice, snapshotJson: JSON.stringify({ base: item.base, code: item.code, description: item.description, unit: item.unit, unitPrice: item.unitPrice.toString(), referenceMonth: item.referenceMonth }) } });
  revalidatePath(`/orcamentos-obras/${budgetId}`);
}

export async function getConstructionSummary(id: string) {
  await requireAuth();
  const items = await prisma.constructionBudgetItem.findMany({ where: { budgetId: id, kind: "SERVICO" }, orderBy: { totalWithBdi: "desc" } });
  const abc = calculateAbc(items.map((item) => ({ key: `${item.sourceBase || "MANUAL"}:${item.sourceCode || item.id}`, totalWithBdi: Number(item.totalWithBdi), totalWithoutBdi: Number(item.directTotal), bdiValue: Number(item.bdiValue), quantity: Number(item.quantity) })));
  const directCost = items.reduce((sum, item) => sum + Number(item.directTotal), 0);
  const globalTotal = items.reduce((sum, item) => sum + Number(item.totalWithBdi), 0);
  return { directCost, globalTotal, bdiValue: globalTotal - directCost, abc };
}

export async function addConstructionBudgetItem(formData: FormData) {
  await requireAuth();
  const budgetId = String(formData.get("budgetId"));
  const kind = String(formData.get("kind") || "SERVICO");
  const description = String(formData.get("description") || "").trim();
  if (!description) return { success: false as const, error: "Descrição obrigatória." };
  const parentId = String(formData.get("parentId") || "") || null;
  const last = await prisma.constructionBudgetItem.findFirst({ where: { budgetId, parentId }, orderBy: { sortOrder: "desc" } });
  const code = `${parentId ? (await prisma.constructionBudgetItem.findUnique({ where: { id: parentId } }))?.hierarchyCode || "1" : ""}${parentId ? "." : ""}${(last?.sortOrder || 0) + 1}`;
  const quantity = Number(formData.get("quantity") || 0);
  const adopted = Number(formData.get("adoptedUnitPrice") || 0);
  const directTotal = kind === "SERVICO" ? quantity * adopted : 0;
  await prisma.constructionBudgetItem.create({ data: { budgetId, parentId, kind, hierarchyCode: code, sortOrder: (last?.sortOrder || 0) + 1, description, unit: String(formData.get("unit") || "UN"), quantity, referenceUnitPrice: Number(formData.get("referenceUnitPrice") || adopted), adoptedUnitPrice: adopted, directTotal, totalWithBdi: directTotal, sourceBase: String(formData.get("sourceBase") || "") || null, sourceCode: String(formData.get("sourceCode") || "") || null, calculationMemory: String(formData.get("calculationMemory") || "") || null } });
  const totals = await prisma.constructionBudgetItem.aggregate({ where: { budgetId, kind: "SERVICO" }, _sum: { directTotal: true, totalWithBdi: true } });
  await prisma.constructionBudget.update({ where: { id: budgetId }, data: { directCost: totals._sum.directTotal || 0, globalTotal: totals._sum.totalWithBdi || 0 } });
  revalidatePath(`/orcamentos-obras/${budgetId}`);
  return { success: true as const };
}
