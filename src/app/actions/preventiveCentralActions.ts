"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireAuth, requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { deleteUploadedAsset, saveBase64Asset } from "@/lib/storage";
import { nextServiceOrderCode } from "@/lib/sequences";
import { createInitialVisit } from "@/lib/visits";

interface StoreAssetPhotoInput {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
}

interface StorePhotoInput {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  category?: string;
}

const STORE_PHOTO_CATEGORIES = new Set([
  "FACHADA",
  "SALAO",
  "ESTOQUE",
  "AREA_TECNICA",
  "QUADRO_ELETRICO",
  "CLIMATIZACAO",
  "ILUMINACAO",
  "DEPOSITO",
  "TELHADO",
  "CASA_MAQUINAS",
  "OUTROS",
]);

const normalizeAssetPhotos = (photos: StoreAssetPhotoInput[] = []) => photos.slice(0, 8).map((photo) => {
  if (!photo.dataUrl.startsWith("data:image/") || photo.dataUrl.length > 4_500_000) {
    throw new Error("Cada foto deve ser uma imagem válida de até 3 MB.");
  }
  return {
    dataUrl: photo.dataUrl,
    fileName: photo.fileName?.slice(0, 180) || null,
    mimeType: photo.mimeType?.slice(0, 80) || null,
    caption: photo.caption?.trim().slice(0, 240) || null,
  };
});

const refreshPreventiveCentral = () => {
  revalidatePath("/preventivas");
  revalidatePath("/clientes");
};

export async function getPreventiveStores() {
  await requireAuth();

  const contracts = await prisma.contract.findMany({
    where: { status: { in: ["ATIVO", "PROVISORIO"] } },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          fancyName: true,
          socialName: true,
          cpfCnpj: true,
          _count: { select: { equipments: true } },
        },
      },
      address: true,
      storeProjects: {
        select: {
          assets: {
            select: { quantity: true, status: true, criticality: true, category: true, parentAssetId: true },
          },
        },
      },
      serviceOrders: {
        select: { status: true, priority: true, type: true, createdAt: true, scheduledDate: true },
      },
      _count: {
        select: {
          storeProjects: true,
          serviceOrders: true,
        },
      },
    },
    orderBy: [{ client: { name: "asc" } }, { code: "asc" }],
  });

  return contracts.map((contract) => {
    const assets = contract.storeProjects.flatMap((project) => project.assets).filter((asset) => !asset.parentAssetId);
    const assetCount = assets.reduce((sum, asset) => sum + Math.max(1, asset.quantity), 0);
    const criticalAssetCount = assets
      .filter((asset) => ["CRITICA", "CRITICO", "VENCIDO", "INATIVO"].includes(asset.criticality) || ["CRITICO", "VENCIDO", "INATIVO"].includes(asset.status))
      .reduce((sum, asset) => sum + Math.max(1, asset.quantity), 0);
    const attentionAssetCount = assets
      .filter((asset) => !(["CRITICA", "CRITICO", "VENCIDO", "INATIVO"].includes(asset.criticality) || ["CRITICO", "VENCIDO", "INATIVO"].includes(asset.status)))
      .filter((asset) => ["ALTA", "ATENCAO", "MANUTENCAO"].includes(asset.criticality) || ["ATENCAO", "MANUTENCAO"].includes(asset.status))
      .reduce((sum, asset) => sum + Math.max(1, asset.quantity), 0);
    const openOrders = contract.serviceOrders.filter((order) => !["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"].includes(order.status));
    const healthScore = assetCount
      ? Math.max(0, Math.min(100, Math.round((100 - (criticalAssetCount / assetCount) * 60 - (attentionAssetCount / assetCount) * 25 - Math.min(openOrders.length * 2, 20)) * 10) / 10))
      : null;
    return ({
    id: contract.id,
    clientId: contract.clientId,
    name: contract.client.name,
    fancyName: contract.client.fancyName,
    socialName: contract.client.socialName,
    cpfCnpj: contract.client.cpfCnpj,
    storeLabel: contract.address?.label || null,
    storeAddress: contract.address
      ? `${contract.address.street}, ${contract.address.number} · ${contract.address.city}/${contract.address.state}`
      : null,
    contracts: [{
      id: contract.id,
      code: contract.code,
      value: Number(contract.value),
      billingPeriod: contract.billingPeriod,
      endDate: contract.endDate,
      status: contract.status,
    }],
    hasActiveContract: contract.status === "ATIVO",
    isProvisional: contract.status === "PROVISORIO",
    hasAssignedStore: Boolean(contract.addressId),
    assetCount,
    criticalAssetCount,
    attentionAssetCount,
    openOrderCount: openOrders.length,
    preventiveCount: contract.serviceOrders.filter((order) => order.type === "PREVENTIVA").length,
    categories: Array.from(new Set(assets.map((asset) => asset.category))),
    priorities: Array.from(new Set(openOrders.map((order) => order.priority))),
    activityDates: contract.serviceOrders.map((order) => order.scheduledDate || order.createdAt),
    healthScore,
    _count: {
      equipments: contract.client._count.equipments,
      storeProjects: contract._count.storeProjects,
      serviceOrders: contract._count.serviceOrders,
    },
    });
  });
}

export async function getPreventiveStore(contractId: string) {
  await requireAuth();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      address: true,
      contact: true,
      items: true,
      portal: true,
      client: {
        include: {
          addresses: { orderBy: { createdAt: "asc" } },
          contacts: { orderBy: { createdAt: "asc" } },
          equipments: { orderBy: { createdAt: "asc" } },
          storeProjects: {
            where: { contractId },
            orderBy: { updatedAt: "desc" },
            include: {
              address: true,
              assets: {
                orderBy: [{ category: "asc" }, { name: "asc" }],
                include: {
                  photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
                  parentAsset: { select: { id: true, name: true, category: true } },
                  components: {
                    orderBy: { name: "asc" },
                    include: { photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
                  },
                },
              },
            },
          },
        },
      },
      serviceOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          contract: { select: { code: true } },
          storeAsset: { select: { id: true, name: true, category: true, tag: true } },
          storeProject: { select: { id: true, name: true } },
          _count: { select: { photos: true } },
        },
      },
    },
  });

  if (!contract) return null;
  const storePhotos = await prisma.attachment.findMany({
    where: { entityId: contract.id, entityType: { startsWith: "LOJA_FOTO_" } },
    orderBy: { createdAt: "desc" },
  });
  const selectedContract = {
    ...contract,
    value: Number(contract.value),
    items: contract.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  };
  return {
    ...contract.client,
    selectedContract,
    contracts: [selectedContract],
    storeProjects: contract.client.storeProjects,
    serviceOrders: contract.serviceOrders,
    storePhotos: storePhotos.map((photo) => ({
      ...photo,
      category: photo.entityType.replace("LOJA_FOTO_", ""),
    })),
  };
}

export async function addPreventiveStorePhotos(input: { contractId: string; photos: StorePhotoInput[] }) {
  const uploadedUrls: string[] = [];
  try {
    const session = await requirePermission("clients.write");
    const contract = await prisma.contract.findUnique({ where: { id: input.contractId }, select: { id: true, clientId: true } });
    if (!contract) return { success: false, error: "Loja ou contrato não encontrado." };
    const existingCount = await prisma.attachment.count({ where: { entityId: contract.id, entityType: { startsWith: "LOJA_FOTO_" } } });
    const photos = (input.photos || []).slice(0, 10);
    if (!photos.length) return { success: false, error: "Selecione ao menos uma foto da loja." };
    if (existingCount + photos.length > 60) return { success: false, error: "A galeria da loja aceita até 60 fotos." };

    const records = [];
    for (const photo of photos) {
      if (!photo.dataUrl?.startsWith("data:image/") || photo.dataUrl.length > 4_500_000) {
        throw new Error("Cada foto deve ser JPG, PNG ou WEBP e possuir até 3 MB.");
      }
      const category = STORE_PHOTO_CATEGORIES.has(photo.category || "") ? photo.category! : "OUTROS";
      const url = await saveBase64Asset(photo.dataUrl, `loja-${contract.id.slice(0, 8)}-${category.toLowerCase()}`);
      uploadedUrls.push(url);
      const base64 = photo.dataUrl.split(",")[1] || "";
      records.push({
        name: (photo.fileName || `${category.toLowerCase()}.jpg`).slice(0, 180),
        url,
        sizeBytes: Buffer.from(base64, "base64").byteLength,
        mimeType: (photo.mimeType || "image/jpeg").slice(0, 80),
        entityType: `LOJA_FOTO_${category}`,
        entityId: contract.id,
      });
    }
    await prisma.attachment.createMany({ data: records });
    await prisma.auditLog.create({
      data: { userId: session.userId, action: "CRIACAO", entity: "FotosLojaPreventiva", entityId: contract.id, changesJson: JSON.stringify({ added: records.length, categories: records.map((record) => record.entityType) }) },
    });
    refreshPreventiveCentral();
    return { success: true, added: records.length };
  } catch (error: any) {
    await Promise.all(uploadedUrls.map((url) => deleteUploadedAsset(url).catch(() => undefined)));
    logger.error("preventive_store_photos_add_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar as fotos da loja." };
  }
}

export async function deletePreventiveStorePhoto(photoId: string) {
  try {
    const session = await requirePermission("clients.write");
    const photo = await prisma.attachment.findFirst({ where: { id: photoId, entityType: { startsWith: "LOJA_FOTO_" } } });
    if (!photo) return { success: false, error: "Foto da loja não encontrada." };
    await prisma.attachment.delete({ where: { id: photo.id } });
    await deleteUploadedAsset(photo.url);
    await prisma.auditLog.create({
      data: { userId: session.userId, action: "EXCLUSAO", entity: "FotoLojaPreventiva", entityId: photo.entityId, changesJson: JSON.stringify({ photoId: photo.id, category: photo.entityType }) },
    });
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_store_photo_delete_failed", error);
    return { success: false, error: error.message || "Não foi possível excluir a foto da loja." };
  }
}

export async function savePreventiveStoreProfile(input: {
  contractId: string;
  client: {
    name: string;
    socialName?: string;
    fancyName?: string;
    email: string;
    phone: string;
    whatsapp?: string;
    segment?: string;
    notes?: string;
  };
  contact: {
    id?: string;
    name: string;
    role?: string;
    email?: string;
    phone: string;
    whatsapp?: string;
  };
}) {
  try {
    await requirePermission("clients.write");
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      select: { clientId: true, contactId: true },
    });
    if (!contract) return { success: false, error: "Contrato não encontrado." };
    if (!input.client.name.trim() || !input.client.email.trim() || !input.client.phone.trim()) {
      return { success: false, error: "Preencha nome, e-mail e telefone do cadastro." };
    }
    if (!input.contact.name.trim() || !input.contact.phone.trim()) {
      return { success: false, error: "Preencha nome e telefone do responsável da loja." };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: contract.clientId },
        data: {
          name: input.client.name.trim(),
          socialName: input.client.socialName?.trim() || null,
          fancyName: input.client.fancyName?.trim() || null,
          email: input.client.email.trim(),
          phone: input.client.phone.trim(),
          whatsapp: input.client.whatsapp?.trim() || null,
          segment: input.client.segment?.trim() || null,
          notes: input.client.notes?.trim() || null,
        },
      });

      let contactId = input.contact.id || contract.contactId;
      if (contactId) {
        const existing = await tx.clientContact.findFirst({
          where: { id: contactId, clientId: contract.clientId },
          select: { id: true },
        });
        if (!existing) throw new Error("O contato informado não pertence a este cliente.");
        await tx.clientContact.update({
          where: { id: existing.id },
          data: {
            name: input.contact.name.trim(),
            role: input.contact.role?.trim() || null,
            email: input.contact.email?.trim() || "",
            phone: input.contact.phone.trim(),
            whatsapp: input.contact.whatsapp?.trim() || null,
            isTechnical: true,
            isApproval: true,
          },
        });
      } else {
        const contact = await tx.clientContact.create({
          data: {
            clientId: contract.clientId,
            name: input.contact.name.trim(),
            role: input.contact.role?.trim() || null,
            email: input.contact.email?.trim() || "",
            phone: input.contact.phone.trim(),
            whatsapp: input.contact.whatsapp?.trim() || null,
            isTechnical: true,
            isApproval: true,
          },
        });
        contactId = contact.id;
      }

      await tx.contract.update({
        where: { id: input.contractId },
        data: { contactId },
      });
      return { contactId };
    });

    refreshPreventiveCentral();
    return { success: true, ...result };
  } catch (error: any) {
    logger.error("preventive_store_profile_save_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar o cadastro da loja." };
  }
}

export async function assignContractStore(input: { contractId: string; addressId: string }) {
  try {
    await requirePermission("contratos.write");
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      select: { clientId: true },
    });
    if (!contract) return { success: false, error: "Contrato não encontrado." };
    const address = await prisma.clientAddress.findFirst({
      where: { id: input.addressId, clientId: contract.clientId },
      select: { id: true },
    });
    if (!address) return { success: false, error: "A loja selecionada não pertence ao cliente deste contrato." };

    await prisma.$transaction([
      prisma.contract.update({
        where: { id: input.contractId },
        data: { addressId: input.addressId },
      }),
      prisma.clientStoreProject.updateMany({
        where: { contractId: input.contractId },
        data: { addressId: input.addressId },
      }),
    ]);
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_contract_store_assign_failed", error);
    return { success: false, error: error.message || "Não foi possível vincular a loja ao contrato." };
  }
}

export async function saveContractStore(input: {
  contractId: string;
  duplicateContract?: boolean;
  addressId?: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
}) {
  try {
    const session = await requirePermission("contratos.write");
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      include: {
        items: true,
        storeProjects: { select: { id: true }, take: 1 },
      },
    });
    if (!contract || !["ATIVO", "PROVISORIO"].includes(contract.status)) {
      return { success: false, error: "Selecione um contrato ativo ou provisório." };
    }
    if (!input.label.trim() || !input.street.trim() || !input.number.trim() || !input.city.trim() || !input.state.trim()) {
      return { success: false, error: "Preencha nome da loja, endereço, número, cidade e UF." };
    }

    const result = await prisma.$transaction(async (tx) => {
      let address;
      if (input.addressId && !input.duplicateContract) {
        const existing = await tx.clientAddress.findFirst({
          where: { id: input.addressId, clientId: contract.clientId },
        });
        if (!existing) throw new Error("O endereço informado não pertence a este contrato.");
        address = await tx.clientAddress.update({
          where: { id: existing.id },
          data: {
            label: input.label.trim(),
            cep: input.cep.replace(/\D/g, ""),
            street: input.street.trim(),
            number: input.number.trim(),
            complement: input.complement?.trim() || null,
            neighborhood: input.neighborhood.trim(),
            city: input.city.trim(),
            state: input.state.trim().toUpperCase().slice(0, 2),
            reference: input.reference?.trim() || null,
          },
        });
      } else {
        address = await tx.clientAddress.create({
          data: {
            clientId: contract.clientId,
            label: input.label.trim(),
            cep: input.cep.replace(/\D/g, ""),
            street: input.street.trim(),
            number: input.number.trim(),
            complement: input.complement?.trim() || null,
            neighborhood: input.neighborhood.trim(),
            city: input.city.trim(),
            state: input.state.trim().toUpperCase().slice(0, 2),
            reference: input.reference?.trim() || null,
          },
        });
      }

      let operationalContractId = contract.id;
      let projectId: string | undefined = contract.storeProjects[0]?.id;

      if (input.duplicateContract) {
        const year = new Date().getFullYear();
        const lastContract = await tx.contract.findFirst({
          where: { code: { startsWith: `C-${year}-` } },
          orderBy: { code: "desc" },
          select: { code: true },
        });
        const nextSequence = (Number(lastContract?.code.split("-").pop()) || 0) + 1;
        const duplicated = await tx.contract.create({
          data: {
            code: `C-${year}-${String(nextSequence).padStart(4, "0")}`,
            clientId: contract.clientId,
            addressId: address.id,
            value: contract.value,
            billingPeriod: contract.billingPeriod,
            startDate: contract.startDate,
            endDate: contract.endDate,
            status: "ATIVO",
            notes: contract.notes
              ? `${contract.notes}\n\nContrato criado para a loja ${address.label}, com base em ${contract.code}.`
              : `Contrato criado para a loja ${address.label}, com base em ${contract.code}.`,
            items: {
              create: contract.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            },
          },
        });
        operationalContractId = duplicated.id;
        projectId = undefined;
        await tx.auditLog.create({
          data: {
            userId: session.userId,
            action: "CRIACAO",
            entity: "Contrato",
            entityId: duplicated.id,
            changesJson: JSON.stringify({
              origin: "CENTRAL_PREVENTIVAS",
              baseContractId: contract.id,
              storeAddressId: address.id,
            }),
          },
        });
      } else {
        await tx.contract.update({
          where: { id: contract.id },
          data: { addressId: address.id },
        });
        await tx.clientStoreProject.updateMany({
          where: { contractId: contract.id },
          data: { addressId: address.id },
        });
      }

      if (!projectId) {
        const project = await tx.clientStoreProject.create({
          data: {
            clientId: contract.clientId,
            contractId: operationalContractId,
            addressId: address.id,
            name: `Projeto geral — ${address.label}`,
            description: "Projeto operacional criado pela Central de Preventivas.",
          },
        });
        projectId = project.id;
      }
      return { addressId: address.id, projectId, contractId: operationalContractId };
    });

    refreshPreventiveCentral();
    return { success: true, ...result };
  } catch (error: any) {
    logger.error("preventive_store_save_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar a loja." };
  }
}

export async function createProvisionalStore(input: {
  clientId: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
}) {
  try {
    const session = await requirePermission("contratos.write");
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, name: true },
    });
    if (!client) return { success: false, error: "Selecione o cliente ou grupo responsável pela loja." };
    if (!input.label.trim() || !input.street.trim() || !input.number.trim() || !input.city.trim() || !input.state.trim()) {
      return { success: false, error: "Preencha nome da loja, endereço, número, cidade e UF." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const address = await tx.clientAddress.create({
        data: {
          clientId: client.id,
          label: input.label.trim(),
          cep: input.cep.replace(/\D/g, ""),
          street: input.street.trim(),
          number: input.number.trim(),
          complement: input.complement?.trim() || null,
          neighborhood: input.neighborhood.trim(),
          city: input.city.trim(),
          state: input.state.trim().toUpperCase().slice(0, 2),
          reference: input.reference?.trim() || null,
        },
      });

      const year = new Date().getFullYear();
      const lastContract = await tx.contract.findFirst({
        where: { code: { startsWith: `C-${year}-` } },
        orderBy: { code: "desc" },
        select: { code: true },
      });
      const nextSequence = (Number(lastContract?.code.split("-").pop()) || 0) + 1;
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 90);

      const contract = await tx.contract.create({
        data: {
          code: `C-${year}-${String(nextSequence).padStart(4, "0")}`,
          clientId: client.id,
          addressId: address.id,
          value: 0,
          billingPeriod: "MENSAL",
          startDate,
          endDate,
          status: "PROVISORIO",
          notes: `Cadastro operacional provisório da loja ${address.label}. Regularizar condições comerciais e vigência antes da efetivação.`,
          items: {
            create: [{
              description: "Atendimento preventivo provisório",
              quantity: 1,
              unitPrice: 0,
            }],
          },
        },
      });

      const project = await tx.clientStoreProject.create({
        data: {
          clientId: client.id,
          contractId: contract.id,
          addressId: address.id,
          name: `Projeto geral — ${address.label}`,
          description: "Projeto operacional criado para loja com vínculo provisório.",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "Contrato",
          entityId: contract.id,
          changesJson: JSON.stringify({
            origin: "CENTRAL_PREVENTIVAS",
            status: "PROVISORIO",
            storeAddressId: address.id,
          }),
        },
      });

      return { contractId: contract.id, addressId: address.id, projectId: project.id };
    });

    refreshPreventiveCentral();
    return { success: true, ...result };
  } catch (error: any) {
    logger.error("preventive_provisional_store_create_failed", error);
    return { success: false, error: error.message || "Não foi possível criar a loja provisória." };
  }
}

export async function createStoreProject(input: {
  clientId: string;
  contractId: string;
  addressId?: string;
  name: string;
  description?: string;
}) {
  try {
    await requirePermission("clients.write");
    const name = input.name.trim();
    if (!name) return { success: false, error: "Informe o nome do projeto." };

    const contract = await prisma.contract.findFirst({
      where: { id: input.contractId, clientId: input.clientId, status: { in: ["ATIVO", "PROVISORIO"] } },
      select: { id: true, addressId: true },
    });
    if (!contract) return { success: false, error: "Contrato ativo ou provisório não encontrado para esta loja." };

    if (input.addressId) {
      const address = await prisma.clientAddress.findFirst({
        where: { id: input.addressId, clientId: input.clientId },
        select: { id: true },
      });
      if (!address) return { success: false, error: "O endereço selecionado não pertence a esta loja." };
    }

    const project = await prisma.clientStoreProject.create({
      data: {
        clientId: input.clientId,
        contractId: input.contractId,
        addressId: input.addressId || contract.addressId || null,
        name,
        description: input.description?.trim() || null,
      },
    });
    refreshPreventiveCentral();
    return { success: true, projectId: project.id };
  } catch (error: any) {
    logger.error("preventive_project_create_failed", error);
    return { success: false, error: error.message || "Não foi possível criar o projeto." };
  }
}

export async function saveProjectFloorPlan(input: {
  projectId: string;
  dataUrl: string;
  fileName: string;
  mimeType: string;
}) {
  try {
    await requirePermission("clients.write");
    if (!input.dataUrl.startsWith("data:image/")) {
      return { success: false, error: "Envie uma imagem ou SVG da planta." };
    }
    if (input.dataUrl.length > 6_500_000) {
      return { success: false, error: "A planta deve ter no máximo 4 MB." };
    }

    await prisma.clientStoreProject.update({
      where: { id: input.projectId },
      data: {
        floorPlanData: input.dataUrl,
        floorPlanFileName: input.fileName.slice(0, 180),
        floorPlanMimeType: input.mimeType,
      },
    });
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_floor_plan_save_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar a planta." };
  }
}

export async function createStoreAsset(input: {
  projectId: string;
  category: string;
  assetType?: string;
  name: string;
  brand?: string;
  model?: string;
  manufacturerCode?: string;
  serialNumber?: string;
  tag?: string;
  quantity?: number;
  unit?: string;
  criticality?: string;
  status?: string;
  location?: string;
  specifications?: string;
  attributes?: Record<string, string>;
  notes?: string;
  parentAssetId?: string;
  photos?: StoreAssetPhotoInput[];
}) {
  try {
    await requirePermission("clients.write");
    if (!input.name.trim()) return { success: false, error: "Informe o nome do item." };

    const parentAsset = input.parentAssetId ? await prisma.storeAsset.findFirst({
      where: { id: input.parentAssetId, projectId: input.projectId },
      select: { id: true, positionX: true, positionY: true },
    }) : null;
    if (input.parentAssetId && !parentAsset) return { success: false, error: "O equipamento principal não pertence a este projeto." };

    const photos = normalizeAssetPhotos(input.photos);
    const assetCount = await prisma.storeAsset.count({ where: { projectId: input.projectId } });
    const column = assetCount % 5;
    const row = Math.floor(assetCount / 5) % 4;
    const asset = await prisma.storeAsset.create({
      data: {
        projectId: input.projectId,
        category: input.category || "OUTROS",
        assetType: input.assetType?.trim() || null,
        name: input.name.trim(),
        brand: input.brand?.trim() || null,
        model: input.model?.trim() || null,
        manufacturerCode: input.manufacturerCode?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        tag: input.tag?.trim() || null,
        quantity: Math.max(1, Math.round(input.quantity || 1)),
        unit: input.unit?.trim().toUpperCase() || "UN",
        criticality: ["BAIXA", "NORMAL", "ALTA", "CRITICA"].includes(input.criticality || "")
          ? input.criticality!
          : "NORMAL",
        status: input.status || "ATIVO",
        location: input.location?.trim() || null,
        specificationsJson: JSON.stringify({
          description: input.specifications?.trim() || "",
          ...Object.fromEntries(
            Object.entries(input.attributes || {})
              .map(([key, value]) => [key.slice(0, 80), String(value || "").trim().slice(0, 500)])
              .filter(([, value]) => Boolean(value)),
          ),
        }),
        notes: input.notes?.trim() || null,
        parentAssetId: parentAsset?.id || null,
        positionX: parentAsset ? Math.min(96, parentAsset.positionX + ((assetCount % 3) - 1) * 3) : 12 + column * 19,
        positionY: parentAsset ? Math.min(96, parentAsset.positionY + 4 + (assetCount % 2) * 3) : 16 + row * 22,
        photos: photos.length ? {
          create: photos.map((photo, index) => ({ ...photo, isPrimary: index === 0 })),
        } : undefined,
      },
    });
    refreshPreventiveCentral();
    return { success: true, assetId: asset.id };
  } catch (error: any) {
    logger.error("preventive_asset_create_failed", error);
    return { success: false, error: error.message || "Não foi possível cadastrar o patrimônio." };
  }
}

export async function updateStoreAsset(input: {
  assetId: string;
  category: string;
  assetType?: string;
  name: string;
  brand?: string;
  model?: string;
  manufacturerCode?: string;
  serialNumber?: string;
  tag?: string;
  quantity?: number;
  unit?: string;
  criticality?: string;
  status?: string;
  location?: string;
  specifications?: string;
  attributes?: Record<string, string>;
  notes?: string;
}) {
  try {
    await requirePermission("clients.write");
    if (!input.name.trim()) return { success: false, error: "Informe o nome do item." };
    const existing = await prisma.storeAsset.findUnique({ where: { id: input.assetId }, select: { id: true } });
    if (!existing) return { success: false, error: "Item técnico não encontrado." };

    await prisma.storeAsset.update({
      where: { id: input.assetId },
      data: {
        category: input.category || "OUTROS",
        assetType: input.assetType?.trim() || null,
        name: input.name.trim(),
        brand: input.brand?.trim() || null,
        model: input.model?.trim() || null,
        manufacturerCode: input.manufacturerCode?.trim() || null,
        serialNumber: input.serialNumber?.trim() || null,
        tag: input.tag?.trim() || null,
        quantity: Math.max(1, Math.round(input.quantity || 1)),
        unit: input.unit?.trim().toUpperCase() || "UN",
        criticality: ["BAIXA", "NORMAL", "ALTA", "CRITICA"].includes(input.criticality || "")
          ? input.criticality!
          : "NORMAL",
        status: input.status || "ATIVO",
        location: input.location?.trim() || null,
        specificationsJson: JSON.stringify({
          description: input.specifications?.trim() || "",
          ...Object.fromEntries(
            Object.entries(input.attributes || {})
              .map(([key, value]) => [key.slice(0, 80), String(value || "").trim().slice(0, 500)])
              .filter(([, value]) => Boolean(value)),
          ),
        }),
        notes: input.notes?.trim() || null,
      },
    });
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_asset_update_failed", error);
    return { success: false, error: error.message || "Não foi possível atualizar o item técnico." };
  }
}

export async function updateStoreAssetPosition(input: { assetId: string; positionX: number; positionY: number }) {
  try {
    await requirePermission("clients.write");
    await prisma.storeAsset.update({
      where: { id: input.assetId },
      data: {
        positionX: Math.min(98, Math.max(2, input.positionX)),
        positionY: Math.min(98, Math.max(2, input.positionY)),
      },
    });
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_asset_position_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar a posição." };
  }
}

export async function addStoreAssetPhotos(input: { assetId: string; photos: StoreAssetPhotoInput[] }) {
  try {
    await requirePermission("clients.write");
    const photos = normalizeAssetPhotos(input.photos);
    if (!photos.length) return { success: false, error: "Selecione ao menos uma foto." };
    const existingCount = await prisma.storeAssetPhoto.count({ where: { assetId: input.assetId } });
    await prisma.storeAssetPhoto.createMany({
      data: photos.map((photo, index) => ({
        id: randomUUID(),
        assetId: input.assetId,
        ...photo,
        isPrimary: existingCount === 0 && index === 0,
      })),
    });
    refreshPreventiveCentral();
    return { success: true, added: photos.length };
  } catch (error: any) {
    logger.error("preventive_asset_photo_add_failed", error);
    return { success: false, error: error.message || "Não foi possível salvar as fotos." };
  }
}

export async function deleteStoreAssetPhoto(photoId: string) {
  try {
    await requirePermission("clients.write");
    await prisma.storeAssetPhoto.delete({ where: { id: photoId } });
    refreshPreventiveCentral();
    return { success: true };
  } catch (error: any) {
    logger.error("preventive_asset_photo_delete_failed", error);
    return { success: false, error: error.message || "Não foi possível excluir a foto." };
  }
}

export async function getOrCreateStorePortal(contractId: string) {
  try {
    await requirePermission("clients.write");
    const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!contract) return { success: false, error: "Contrato da loja não encontrado." };
    const portal = await prisma.storePortal.upsert({
      where: { contractId },
      update: {},
      create: { contractId, token: randomUUID() },
    });
    refreshPreventiveCentral();
    return { success: true, portal };
  } catch (error: any) {
    logger.error("preventive_store_portal_create_failed", error);
    return { success: false, error: error.message || "Não foi possível criar o portal da loja." };
  }
}

export async function setStorePortalEnabled(input: { contractId: string; enabled: boolean; allowTicketCreation: boolean }) {
  try {
    await requirePermission("clients.write");
    const portal = await prisma.storePortal.upsert({
      where: { contractId: input.contractId },
      update: { enabled: input.enabled, allowTicketCreation: input.allowTicketCreation },
      create: { contractId: input.contractId, token: randomUUID(), enabled: input.enabled, allowTicketCreation: input.allowTicketCreation },
    });
    refreshPreventiveCentral();
    return { success: true, portal };
  } catch (error: any) {
    logger.error("preventive_store_portal_update_failed", error);
    return { success: false, error: error.message || "Não foi possível atualizar o portal." };
  }
}

export async function rotateStorePortalToken(contractId: string) {
  try {
    await requirePermission("clients.write");
    const portal = await prisma.storePortal.update({
      where: { contractId },
      data: { token: randomUUID(), enabled: true },
    });
    refreshPreventiveCentral();
    return { success: true, portal };
  } catch (error: any) {
    logger.error("preventive_store_portal_rotate_failed", error);
    return { success: false, error: error.message || "Não foi possível gerar um novo link." };
  }
}

export async function createStoreTicket(input: {
  contractId: string;
  projectId?: string;
  assetId?: string;
  title: string;
  description: string;
  priority: string;
  photos?: StoreAssetPhotoInput[];
}) {
  try {
    const session = await requirePermission("os.write");
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      include: { address: true, contact: true },
    });
    if (!contract || !["ATIVO", "PROVISORIO"].includes(contract.status)) return { success: false, error: "Contrato ativo ou provisório não encontrado." };
    if (!input.title.trim() || !input.description.trim()) return { success: false, error: "Informe título e descrição do chamado." };
    if (!contract.addressId) return { success: false, error: "Defina o endereço desta loja antes de abrir o chamado." };
    const priorities = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
    if (!priorities.includes(input.priority)) return { success: false, error: "Prioridade inválida." };

    const project = input.projectId ? await prisma.clientStoreProject.findFirst({ where: { id: input.projectId, contractId: contract.id } }) : null;
    if (input.projectId && !project) return { success: false, error: "O projeto não pertence a esta loja." };
    const asset = input.assetId ? await prisma.storeAsset.findFirst({ where: { id: input.assetId, project: { contractId: contract.id } } }) : null;
    if (input.assetId && !asset) return { success: false, error: "O patrimônio não pertence a esta loja." };
    const photos = normalizeAssetPhotos(input.photos).slice(0, 5);
    const storedPhotos = await Promise.all(photos.map(async (photo) => ({
      ...photo,
      url: await saveBase64Asset(photo.dataUrl, `central-${contract.id}`),
    })));

    const created = await prisma.$transaction(async (tx) => {
      const code = await nextServiceOrderCode(tx);
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          code,
          clientId: contract.clientId,
          contractId: contract.id,
          addressId: contract.addressId,
          contactId: contract.contactId,
          storeProjectId: project?.id || asset?.projectId || null,
          storeAssetId: asset?.id || null,
          type: "CORRETIVA",
          operationKind: "CHAMADO_CONTRATO",
          referenceMonth: new Date().toISOString().slice(0, 7),
          priority: input.priority,
          status: "AGUARDANDO_AGENDAMENTO",
          requestSource: "CENTRAL_PREVENTIVA",
          problemReported: `${input.title.trim()}\n\n${input.description.trim()}`,
        },
      });
      const visit = await createInitialVisit(tx, {
        serviceOrderId: serviceOrder.id,
        status: serviceOrder.status,
        kind: "ATENDIMENTO",
        changedById: session.userId,
      });
      if (storedPhotos.length) {
        await tx.serviceOrderPhoto.createMany({
          data: storedPhotos.map((photo) => ({ serviceOrderId: serviceOrder.id, step: "EVIDENCIA", url: photo.url, caption: photo.caption || photo.fileName })),
        });
        await tx.evidence.createMany({
          data: storedPhotos.map((photo) => ({
            serviceOrderId: serviceOrder.id,
            visitId: visit.id,
            storeAssetId: asset?.id || null,
            authorId: session.userId,
            kind: "FOTO",
            stage: "DIAGNOSTICO",
            fileUrl: photo.url,
            fileName: photo.fileName,
            mimeType: photo.mimeType,
            caption: photo.caption || photo.fileName,
          })),
        });
      }
      if (asset?.id) {
        await tx.serviceOrderAsset.create({ data: { serviceOrderId: serviceOrder.id, storeAssetId: asset.id, isPrimary: true } });
      }
      await tx.serviceOrderStatusHistory.create({
        data: { serviceOrderId: serviceOrder.id, oldStatus: "NENHUM", newStatus: "AGUARDANDO_AGENDAMENTO", changedById: session.userId, justification: "Chamado aberto na Central da Preventiva." },
      });
      await tx.notification.create({
        data: { title: `Novo chamado ${code}`, message: `${input.title.trim()} — ${contract.address?.label || contract.code}`, type: "OPERACIONAL", link: "/ordens-servico" },
      });
      return serviceOrder;
    });
    refreshPreventiveCentral();
    revalidatePath("/ordens-servico");
    return { success: true, serviceOrderId: created.id, code: created.code };
  } catch (error: any) {
    logger.error("preventive_store_ticket_create_failed", error);
    return { success: false, error: error.message || "Não foi possível abrir o chamado." };
  }
}

export async function importClientEquipmentsToProject(projectId: string) {
  try {
    await requirePermission("clients.write");
    const project = await prisma.clientStoreProject.findUnique({
      where: { id: projectId },
      include: { client: { include: { equipments: true } }, assets: true },
    });
    if (!project) return { success: false, error: "Projeto não encontrado." };

    const importedSerials = new Set(project.assets.map((asset) => asset.serialNumber).filter(Boolean));
    const importedTags = new Set(project.assets.map((asset) => asset.tag).filter(Boolean));
    const equipments = project.client.equipments.filter(
      (equipment) => !importedSerials.has(equipment.serialNumber) && (!equipment.tag || !importedTags.has(equipment.tag)),
    );

    if (!equipments.length) return { success: true, imported: 0 };
    await prisma.storeAsset.createMany({
      data: equipments.map((equipment, index) => ({
        projectId,
        category: "CLIMATIZACAO",
        assetType: "UNIDADE_AR_CONDICIONADO",
        name: equipment.type,
        brand: equipment.brand,
        model: equipment.model,
        serialNumber: equipment.serialNumber,
        tag: equipment.tag,
        location: equipment.location,
        specificationsJson: JSON.stringify({ capacity: equipment.capacity || "" }),
        notes: equipment.notes,
        positionX: 12 + ((project.assets.length + index) % 5) * 19,
        positionY: 16 + (Math.floor((project.assets.length + index) / 5) % 4) * 22,
      })),
    });
    refreshPreventiveCentral();
    return { success: true, imported: equipments.length };
  } catch (error: any) {
    logger.error("preventive_equipment_import_failed", error);
    return { success: false, error: error.message || "Não foi possível importar os equipamentos." };
  }
}
