"use server";

import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SETTING_KEY = "training.videos";

export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  category: string;
  duration: string;
  published: boolean;
  order: number;
}

const videoSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(3, "Informe o título."),
  description: z.string().trim().max(500),
  youtubeUrl: z.url("Informe um link válido do YouTube.").refine((url) => /(?:youtube\.com|youtu\.be)/i.test(url), "Use um link do YouTube."),
  category: z.string().trim().min(2, "Informe a categoria."),
  duration: z.string().trim().max(20),
  published: z.boolean(),
  order: z.number().int().nonnegative(),
});

async function readVideos() {
  const record = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!record?.value) return [];
  try {
    const parsed = z.array(videoSchema).safeParse(JSON.parse(record.value));
    return parsed.success ? parsed.data.sort((a, b) => a.order - b.order) : [];
  } catch { return []; }
}

export async function getTrainingVideosAction() {
  let canManage = false;
  try {
    const session = await requireAuth();
    canManage = session.roleName === "Administrador" || session.permissions.includes("admin.all") || session.permissions.includes("dev.all");
  } catch {
    // A central é pública; somente as ferramentas de gestão exigem sessão.
  }
  const videos = await readVideos();
  return { videos: canManage ? videos : videos.filter((video) => video.published), canManage };
}

export async function saveTrainingVideoAction(input: TrainingVideo) {
  try {
    const session = await requirePermission("admin.all");
    const video = videoSchema.parse(input);
    const videos = await readVideos();
    const index = videos.findIndex((item) => item.id === video.id);
    if (index >= 0) videos[index] = video; else videos.push(video);
    await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: JSON.stringify(videos) }, update: { value: JSON.stringify(videos) } });
    await prisma.auditLog.create({ data: { userId: session.userId, action: index >= 0 ? "EDICAO" : "CRIACAO", entity: "Treinamento", entityId: video.id, changesJson: JSON.stringify({ title: video.title, category: video.category, published: video.published }) } });
    revalidatePath("/treinamentos");
    return { success: true as const };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível salvar o vídeo." }; }
}

export async function deleteTrainingVideoAction(id: string) {
  try {
    const session = await requirePermission("admin.all");
    const videos = (await readVideos()).filter((item) => item.id !== id);
    await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: JSON.stringify(videos) }, update: { value: JSON.stringify(videos) } });
    await prisma.auditLog.create({ data: { userId: session.userId, action: "EXCLUSAO", entity: "Treinamento", entityId: id, changesJson: "{}" } });
    revalidatePath("/treinamentos");
    return { success: true as const };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível excluir o vídeo." }; }
}
