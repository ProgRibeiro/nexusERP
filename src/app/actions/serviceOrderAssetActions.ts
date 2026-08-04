"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ServiceOrderAssetInput {
  kind: "STORE_ASSET" | "CLIENT_EQUIPMENT";
  assetId: string;
  isPrimary?: boolean;
  problem?: string;
}

export async function getServiceOrderAssetWorkspace(serviceOrderId: string) {
  try {
    await requireAuth();
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: {
        id: true,
        clientId: true,
        serviceOrderAssets: {
          select: { id: true, storeAssetId: true, clientEquipmentId: true, isPrimary: true, problem: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!serviceOrder) throw new Error("Ordem de serviço não encontrada.");

    const [storeAssets, equipments] = await Promise.all([
      prisma.storeAsset.findMany({
        where: { project: { clientId: serviceOrder.clientId } },
        include: { project: { select: { id: true, name: true } }, _count: { select: { components: true, photos: true } } },
        orderBy: [{ project: { name: "asc" } }, { category: "asc" }, { name: "asc" }],
      }),
      prisma.clientEquipment.findMany({
        where: { clientId: serviceOrder.clientId },
        orderBy: [{ type: "asc" }, { brand: "asc" }, { model: "asc" }],
      }),
    ]);

    return {
      success: true as const,
      current: serviceOrder.serviceOrderAssets.map((link) => ({
        id: link.id,
        kind: link.storeAssetId ? "STORE_ASSET" as const : "CLIENT_EQUIPMENT" as const,
        assetId: link.storeAssetId || link.clientEquipmentId || "",
        isPrimary: link.isPrimary,
        problem: link.problem || "",
      })),
      candidates: [
        ...storeAssets.map((asset) => ({
          kind: "STORE_ASSET" as const,
          assetId: asset.id,
          name: asset.name,
          category: asset.category,
          subtitle: [asset.assetType, asset.brand, asset.model].filter(Boolean).join(" · ") || "Patrimônio técnico",
          location: asset.location || asset.project.name,
          projectName: asset.project.name,
          tag: asset.tag,
          serialNumber: asset.serialNumber,
          componentCount: asset._count.components,
          photoCount: asset._count.photos,
        })),
        ...equipments.map((equipment) => ({
          kind: "CLIENT_EQUIPMENT" as const,
          assetId: equipment.id,
          name: equipment.type,
          category: "EQUIPAMENTO_LEGADO",
          subtitle: [equipment.brand, equipment.model].filter(Boolean).join(" · ") || "Equipamento do cliente",
          location: equipment.location || "Local não informado",
          projectName: "Cadastro geral do cliente",
          tag: equipment.tag,
          serialNumber: equipment.serialNumber,
          componentCount: 0,
          photoCount: 0,
        })),
      ],
    };
  } catch (error) {
    logger.error("Erro ao carregar ativos da OS:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao carregar ativos." };
  }
}

export async function saveServiceOrderAssets(serviceOrderId: string, input: ServiceOrderAssetInput[]) {
  try {
    await requirePermission("os.write");
    const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { id: true, clientId: true } });
    if (!serviceOrder) throw new Error("Ordem de serviço não encontrada.");

    const uniqueInput = input.filter((item, index, list) =>
      item.assetId && list.findIndex((candidate) => candidate.kind === item.kind && candidate.assetId === item.assetId) === index,
    );
    const storeAssetIds = uniqueInput.filter((item) => item.kind === "STORE_ASSET").map((item) => item.assetId);
    const equipmentIds = uniqueInput.filter((item) => item.kind === "CLIENT_EQUIPMENT").map((item) => item.assetId);
    const [validStoreAssets, validEquipments] = await Promise.all([
      prisma.storeAsset.findMany({
        where: { id: { in: storeAssetIds }, project: { clientId: serviceOrder.clientId } },
        select: { id: true, projectId: true },
      }),
      prisma.clientEquipment.findMany({
        where: { id: { in: equipmentIds }, clientId: serviceOrder.clientId },
        select: { id: true },
      }),
    ]);
    if (validStoreAssets.length !== storeAssetIds.length || validEquipments.length !== equipmentIds.length) {
      throw new Error("Um ou mais ativos não pertencem ao cliente desta OS.");
    }

    const requestedPrimary = uniqueInput.find((item) => item.isPrimary) || uniqueInput[0];
    const rows = uniqueInput.map((item) => ({
      serviceOrderId,
      storeAssetId: item.kind === "STORE_ASSET" ? item.assetId : null,
      clientEquipmentId: item.kind === "CLIENT_EQUIPMENT" ? item.assetId : null,
      isPrimary: requestedPrimary?.kind === item.kind && requestedPrimary.assetId === item.assetId,
      problem: item.problem?.trim() || null,
    }));
    const primaryStoreAsset = requestedPrimary?.kind === "STORE_ASSET"
      ? validStoreAssets.find((asset) => asset.id === requestedPrimary.assetId)
      : validStoreAssets.find((asset) => asset.id === rows.find((row) => row.storeAssetId)?.storeAssetId);

    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderAsset.deleteMany({ where: { serviceOrderId } });
      if (rows.length) await tx.serviceOrderAsset.createMany({ data: rows });
      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          storeAssetId: requestedPrimary?.kind === "STORE_ASSET" ? requestedPrimary.assetId : null,
          storeProjectId: primaryStoreAsset?.projectId || null,
        },
      });
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/execucao");
    return { success: true as const, count: rows.length };
  } catch (error) {
    logger.error("Erro ao salvar ativos da OS:", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao salvar ativos." };
  }
}
