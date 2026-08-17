"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireAnyPermission } from "@/lib/auth";
import { logger } from "@/lib/logger";

const statuses = new Set(["IDEIA", "PRODUCAO", "REVISAO", "AGENDADO", "PUBLICADO"]);
const channels = new Set(["Instagram", "Facebook", "LinkedIn", "TikTok"]);

type MarketingInput = { id?: string; title: string; caption?: string; date: string; time: string; status: string; channels: string[]; format: string; owner: string; campaign: string };

function validate(data: MarketingInput) {
  if (!data.title?.trim()) throw new Error("Informe o título da pauta.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Informe uma data válida.");
  if (!/^\d{2}:\d{2}$/.test(data.time)) throw new Error("Informe um horário válido.");
  if (!statuses.has(data.status)) throw new Error("Status inválido.");
  const selected = [...new Set(data.channels)].filter((item) => channels.has(item));
  if (!selected.length) throw new Error("Selecione pelo menos um canal.");
  return { title: data.title.trim(), caption: data.caption?.trim() || null, publishDate: data.date, publishTime: data.time, status: data.status, channelsJson: JSON.stringify(selected), format: data.format.trim() || "Conteúdo", owner: data.owner.trim() || "Equipe de marketing", campaign: data.campaign.trim() || "Geral" };
}

const dto = (post: { id: string; title: string; caption: string | null; publishDate: string; publishTime: string; status: string; channelsJson: string; format: string; owner: string; campaign: string }) => ({
  id: post.id, title: post.title, caption: post.caption || "", date: post.publishDate, time: post.publishTime, status: post.status, channels: JSON.parse(post.channelsJson), format: post.format, owner: post.owner, campaign: post.campaign,
});

export async function getMarketingPosts() {
  await requireAuth();
  const posts = await prisma.marketingPost.findMany({ orderBy: [{ publishDate: "asc" }, { publishTime: "asc" }] });
  return posts.map(dto);
}

export async function saveMarketingPost(data: MarketingInput) {
  try {
    const session = await requireAnyPermission(["clients.write", "crm.write"]);
    const parsed = validate(data);
    const post = await prisma.$transaction(async (tx) => {
      const saved = data.id
        ? await tx.marketingPost.update({ where: { id: data.id }, data: parsed })
        : await tx.marketingPost.create({ data: { ...parsed, createdById: session.userId } });
      await tx.auditLog.create({ data: { userId: session.userId, action: data.id ? "EDICAO" : "CRIACAO", entity: "MarketingPost", entityId: saved.id, changesJson: JSON.stringify(parsed) } });
      return saved;
    });
    revalidatePath("/marketing");
    return { success: true as const, post: dto(post) };
  } catch (error) {
    logger.error("marketing_post_save_failed", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao salvar conteúdo." };
  }
}

export async function deleteMarketingPost(id: string) {
  try {
    const session = await requireAnyPermission(["clients.write", "crm.write"]);
    await prisma.$transaction(async (tx) => {
      const current = await tx.marketingPost.findUnique({ where: { id } });
      if (!current) throw new Error("Conteúdo não encontrado.");
      await tx.auditLog.create({ data: { userId: session.userId, action: "EXCLUSAO", entity: "MarketingPost", entityId: id, changesJson: JSON.stringify(current) } });
      await tx.marketingPost.delete({ where: { id } });
    });
    revalidatePath("/marketing");
    return { success: true as const };
  } catch (error) {
    logger.error("marketing_post_delete_failed", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao excluir conteúdo." };
  }
}

export async function importLegacyMarketingPosts(items: MarketingInput[]) {
  const session = await requireAnyPermission(["clients.write", "crm.write"]);
  if (!items.length || await prisma.marketingPost.count()) return { success: true as const, imported: 0 };
  const parsed = items.slice(0, 500).map(validate);
  const result = await prisma.marketingPost.createMany({ data: parsed.map((item) => ({ ...item, createdById: session.userId })) });
  revalidatePath("/marketing");
  return { success: true as const, imported: result.count };
}
