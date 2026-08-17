"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { calculateServicePrice } from "@/lib/servicePricing";

/**
 * Busca a lista de serviços do banco de dados, com filtro opcional de busca
 */
export async function getServices(query = "") {
  try {
    await requireAuth();

    const services = await prisma.service.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
        ],
      },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return services;
  } catch (error) {
    logger.error("Erro ao carregar serviços:", error);
    return [];
  }
}

/**
 * Cria um novo serviço no banco
 */
export async function createService(data: {
  name: string;
  description?: string;
  defaultPrice: number;
  serviceType?: string; workforceRegime?: string; supplierId?: string; referenceCode?: string; billingUnit?: string;
  materialCost?: number; laborCost?: number; equipmentCost?: number; otherDirectCost?: number; productivity?: number; estimatedHours?: number;
  payrollBurdenPercentage?: number; overheadPercentage?: number; riskPercentage?: number; profitPercentage?: number; serviceTaxPercentage?: number;
}) {
  try {
    await requirePermission("estoque.write");

    const normalizedName = data.name.trim();

    const exists = await prisma.service.findUnique({
      where: { name: normalizedName },
    });

    if (exists) {
      return { success: false, error: "Já existe um serviço cadastrado com este nome." };
    }

    const serviceType = data.serviceType === "TERCEIRIZADO" ? "TERCEIRIZADO" : "PROPRIO";
    if (serviceType === "TERCEIRIZADO" && !data.supplierId) return { success: false, error: "Selecione o prestador responsável." };
    const pricing = calculateServicePrice(data);
    const service = await prisma.service.create({
      data: {
        name: normalizedName,
        description: data.description || "",
        defaultPrice: pricing.salePrice,
        workforceRegime: serviceType === "TERCEIRIZADO" ? "TERCEIRIZADO" : (data.workforceRegime || "CLT"),
        serviceType, supplierId: serviceType === "TERCEIRIZADO" ? data.supplierId : null,
        referenceCode: data.referenceCode?.trim() || null, billingUnit: data.billingUnit || "SERVIÇO",
        materialCost: Math.max(0, Number(data.materialCost) || 0), laborCost: Math.max(0, Number(data.laborCost) || 0),
        equipmentCost: Math.max(0, Number(data.equipmentCost) || 0), otherDirectCost: Math.max(0, Number(data.otherDirectCost) || 0),
        productivity: Math.max(0.0001, Number(data.productivity) || 1), estimatedHours: Number(data.estimatedHours) > 0 ? Number(data.estimatedHours) : null,
        payrollBurdenPercentage: Math.max(0, Number(data.payrollBurdenPercentage) || 0), overheadPercentage: Math.max(0, Number(data.overheadPercentage) || 0),
        riskPercentage: Math.max(0, Number(data.riskPercentage) || 0), profitPercentage: Math.max(0, Number(data.profitPercentage) || 0), serviceTaxPercentage: Math.max(0, Number(data.serviceTaxPercentage) || 0),
      },
    });

    return { success: true, service };
  } catch (error: any) {
    logger.error("Erro ao criar serviço:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza um serviço existente
 */
export async function updateService(
  id: string,
  data: {
    name: string;
    description?: string;
    defaultPrice: number;
    serviceType?: string; workforceRegime?: string; supplierId?: string; referenceCode?: string; billingUnit?: string;
    materialCost?: number; laborCost?: number; equipmentCost?: number; otherDirectCost?: number; productivity?: number; estimatedHours?: number;
    payrollBurdenPercentage?: number; overheadPercentage?: number; riskPercentage?: number; profitPercentage?: number; serviceTaxPercentage?: number;
  }
) {
  try {
    await requirePermission("estoque.write");

    const normalizedName = data.name.trim();

    // Verifica duplicidade excluindo o atual
    const exists = await prisma.service.findFirst({
      where: {
        name: normalizedName,
        NOT: { id },
      },
    });

    if (exists) {
      return { success: false, error: "Já existe outro serviço cadastrado com este nome." };
    }

    const serviceType = data.serviceType === "TERCEIRIZADO" ? "TERCEIRIZADO" : "PROPRIO";
    if (serviceType === "TERCEIRIZADO" && !data.supplierId) return { success: false, error: "Selecione o prestador responsável." };
    const pricing = calculateServicePrice(data);
    const service = await prisma.service.update({
      where: { id },
      data: {
        name: normalizedName,
        description: data.description || "",
        defaultPrice: pricing.salePrice,
        workforceRegime: serviceType === "TERCEIRIZADO" ? "TERCEIRIZADO" : (data.workforceRegime || "CLT"),
        serviceType, supplierId: serviceType === "TERCEIRIZADO" ? data.supplierId : null,
        referenceCode: data.referenceCode?.trim() || null, billingUnit: data.billingUnit || "SERVIÇO",
        materialCost: Math.max(0, Number(data.materialCost) || 0), laborCost: Math.max(0, Number(data.laborCost) || 0),
        equipmentCost: Math.max(0, Number(data.equipmentCost) || 0), otherDirectCost: Math.max(0, Number(data.otherDirectCost) || 0),
        productivity: Math.max(0.0001, Number(data.productivity) || 1), estimatedHours: Number(data.estimatedHours) > 0 ? Number(data.estimatedHours) : null,
        payrollBurdenPercentage: Math.max(0, Number(data.payrollBurdenPercentage) || 0), overheadPercentage: Math.max(0, Number(data.overheadPercentage) || 0),
        riskPercentage: Math.max(0, Number(data.riskPercentage) || 0), profitPercentage: Math.max(0, Number(data.profitPercentage) || 0), serviceTaxPercentage: Math.max(0, Number(data.serviceTaxPercentage) || 0),
      },
    });

    return { success: true, service };
  } catch (error: any) {
    logger.error("Erro ao atualizar serviço:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Exclui um serviço do banco de dados
 */
export async function deleteService(id: string) {
  try {
    await requirePermission("estoque.write");

    await prisma.service.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    logger.error("Erro ao excluir serviço:", error);
    return { success: false, error: "Este serviço não pôde ser excluído pois está vinculado a orçamentos ou OSs." };
  }
}
