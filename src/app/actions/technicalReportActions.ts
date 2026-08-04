"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function getStoreTechnicalDossier(contractId: string) {
  await requireAuth();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      address: true,
      contact: true,
      client: {
        select: {
          name: true,
          socialName: true,
          fancyName: true,
          cpfCnpj: true,
        },
      },
      storeProjects: {
        orderBy: { name: "asc" },
        include: {
          address: true,
          assets: {
            where: { parentAssetId: null },
            orderBy: [{ category: "asc" }, { name: "asc" }],
            include: {
              photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
              components: {
                orderBy: [{ assetType: "asc" }, { name: "asc" }],
                include: {
                  photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!contract) return null;

  return {
    generatedAt: new Date().toISOString(),
    store: {
      id: contract.id,
      code: contract.code,
      status: contract.status,
      label: contract.address?.label || contract.client.fancyName || contract.client.name,
      groupName: contract.client.socialName || contract.client.name,
      document: contract.client.cpfCnpj,
      address: contract.address,
      contact: contract.contact
        ? {
            name: contract.contact.name,
            role: contract.contact.role,
            phone: contract.contact.phone,
            email: contract.contact.email,
          }
        : null,
    },
    environments: contract.storeProjects.map((environment) => ({
      id: environment.id,
      name: environment.name,
      description: environment.description,
      floorPlanData: environment.floorPlanData,
      floorPlanFileName: environment.floorPlanFileName,
      assets: environment.assets.map((asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        photos: asset.photos.map((photo) => ({
          ...photo,
          createdAt: photo.createdAt.toISOString(),
        })),
        components: asset.components.map((component) => ({
          ...component,
          createdAt: component.createdAt.toISOString(),
          updatedAt: component.updatedAt.toISOString(),
          photos: component.photos.map((photo) => ({
            ...photo,
            createdAt: photo.createdAt.toISOString(),
          })),
        })),
      })),
    })),
  };
}
