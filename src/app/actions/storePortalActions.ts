"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { saveBase64Asset } from "@/lib/storage";
import { nextServiceOrderCode } from "@/lib/sequences";
import { createInitialVisit } from "@/lib/visits";

interface PortalPhotoInput {
  dataUrl: string;
  fileName?: string;
  caption?: string;
}

const closedStatuses = ["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"];

const normalizePhotos = (photos: PortalPhotoInput[] = []) => photos.slice(0, 5).map((photo) => {
  if (!photo.dataUrl.startsWith("data:image/") || photo.dataUrl.length > 4_500_000) {
    throw new Error("Cada foto deve ser uma imagem válida de até 3 MB.");
  }
  return {
    dataUrl: photo.dataUrl,
    fileName: photo.fileName?.slice(0, 180) || null,
    caption: photo.caption?.trim().slice(0, 240) || null,
  };
});

export async function getPublicStorePortal(token: string) {
  if (!token || token.length > 120) return null;

  const portal = await prisma.storePortal.findUnique({
    where: { token },
    include: {
      contract: {
        include: {
          address: true,
          contact: true,
          client: {
            select: {
              name: true,
              fancyName: true,
              socialName: true,
            },
          },
          storeProjects: {
            orderBy: { updatedAt: "desc" },
            include: {
              address: true,
              assets: {
                orderBy: [{ category: "asc" }, { name: "asc" }],
                include: {
                  photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
                  components: {
                    orderBy: { name: "asc" },
                    include: { photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
                  },
                },
              },
            },
          },
          serviceOrders: {
            orderBy: { createdAt: "desc" },
            take: 30,
            include: {
              storeAsset: { select: { id: true, name: true, tag: true } },
              storeProject: { select: { id: true, name: true } },
              _count: { select: { photos: true } },
            },
          },
        },
      },
    },
  });

  if (!portal?.enabled) return null;

  await prisma.storePortal.update({ where: { id: portal.id }, data: { lastAccessAt: new Date() } });

  const contract = portal.contract;
  const projects = contract.storeProjects.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    assets: project.assets
      .filter((asset) => !asset.parentAssetId)
      .map((asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        photos: asset.photos.map((photo) => ({ ...photo, createdAt: photo.createdAt.toISOString() })),
        components: asset.components.map((component) => ({
          ...component,
          createdAt: component.createdAt.toISOString(),
          updatedAt: component.updatedAt.toISOString(),
          photos: component.photos.map((photo) => ({ ...photo, createdAt: photo.createdAt.toISOString() })),
        })),
      })),
  }));

  return {
    portal: {
      token: portal.token,
      allowTicketCreation: portal.allowTicketCreation,
    },
    store: {
      label: contract.address?.label || contract.client.fancyName || contract.client.name,
      groupName: contract.client.socialName || contract.client.name,
      contractCode: contract.code,
      contractStatus: contract.status,
      address: contract.address,
      contact: contract.contact ? {
        name: contract.contact.name,
        role: contract.contact.role,
        phone: contract.contact.phone,
        email: contract.contact.email,
      } : null,
    },
    projects,
    tickets: contract.serviceOrders.map((order) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      priority: order.priority,
      problemReported: order.problemReported,
      requestSource: order.requestSource,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      scheduledDate: order.scheduledDate?.toISOString() || null,
      completedAt: order.completedAt?.toISOString() || null,
      storeAsset: order.storeAsset,
      storeProject: order.storeProject,
      photoCount: order._count.photos,
      isOpen: !closedStatuses.includes(order.status),
    })),
  };
}

export async function createPublicStoreTicket(input: {
  token: string;
  projectId?: string;
  assetId?: string;
  title: string;
  description: string;
  priority: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  photos?: PortalPhotoInput[];
}) {
  try {
    const portal = await prisma.storePortal.findUnique({
      where: { token: input.token },
      include: { contract: { include: { address: true } } },
    });
    if (!portal?.enabled || !portal.allowTicketCreation) {
      return { success: false, error: "A abertura de chamados não está disponível neste portal." };
    }
    if (!input.requesterName.trim() || !input.title.trim() || !input.description.trim()) {
      return { success: false, error: "Informe seu nome, o assunto e a descrição do chamado." };
    }
    if (!portal.contract.addressId) return { success: false, error: "A loja ainda não possui endereço definido." };

    const priorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
    const priority = priorities.includes(input.priority) ? input.priority : "MEDIA";
    const project = input.projectId ? await prisma.clientStoreProject.findFirst({
      where: { id: input.projectId, contractId: portal.contractId },
      select: { id: true },
    }) : null;
    if (input.projectId && !project) return { success: false, error: "O setor selecionado não pertence a esta loja." };
    const asset = input.assetId ? await prisma.storeAsset.findFirst({
      where: { id: input.assetId, project: { contractId: portal.contractId } },
      select: { id: true, projectId: true },
    }) : null;
    if (input.assetId && !asset) return { success: false, error: "O equipamento selecionado não pertence a esta loja." };

    const photos = normalizePhotos(input.photos);
    const storedPhotos = await Promise.all(photos.map(async (photo) => ({
      ...photo,
      url: await saveBase64Asset(photo.dataUrl, `portal-${portal.contractId}`),
    })));

    const order = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const created = await tx.serviceOrder.create({
        data: {
          code,
          clientId: portal.contract.clientId,
          contractId: portal.contractId,
          addressId: portal.contract.addressId,
          storeProjectId: project?.id || asset?.projectId || null,
          storeAssetId: asset?.id || null,
          type: "CORRETIVA",
          status: "AGUARDANDO_AGENDAMENTO",
          priority,
          requestSource: "CLIENTE_PORTAL",
          requesterName: input.requesterName.trim().slice(0, 160),
          requesterEmail: input.requesterEmail?.trim().slice(0, 180) || null,
          requesterPhone: input.requesterPhone?.trim().slice(0, 40) || null,
          problemReported: `${input.title.trim()}\n\n${input.description.trim()}`,
        },
      });
      const visit = await createInitialVisit(tx, {
        serviceOrderId: created.id,
        status: created.status,
        kind: "ATENDIMENTO",
      });
      if (storedPhotos.length) {
        await tx.serviceOrderPhoto.createMany({
          data: storedPhotos.map((photo) => ({ serviceOrderId: created.id, step: "EVIDENCIA", url: photo.url, caption: photo.caption || photo.fileName })),
        });
        await tx.evidence.createMany({
          data: storedPhotos.map((photo) => ({
            serviceOrderId: created.id,
            visitId: visit.id,
            storeAssetId: asset?.id || null,
            kind: "FOTO",
            stage: "DIAGNOSTICO",
            fileUrl: photo.url,
            fileName: photo.fileName,
            caption: photo.caption || photo.fileName,
          })),
        });
      }
      if (asset?.id) {
        await tx.serviceOrderAsset.create({ data: { serviceOrderId: created.id, storeAssetId: asset.id, isPrimary: true } });
      }
      await tx.notification.create({
        data: {
          title: `Novo chamado do cliente ${code}`,
          message: `${input.title.trim()} — ${portal.contract.address?.label || portal.contract.code}`,
          type: "OPERACIONAL",
          link: "/ordens-servico",
        },
      });
      return created;
    });

    revalidatePath(`/portal/loja/${input.token}`);
    revalidatePath("/ordens-servico");
    revalidatePath("/preventivas");
    return { success: true, code: order.code, serviceOrderId: order.id };
  } catch (error: any) {
    logger.error("public_store_ticket_create_failed", error);
    return { success: false, error: error.message || "Não foi possível abrir o chamado." };
  }
}
