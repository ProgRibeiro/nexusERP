"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";

export interface ProductDTO {
  id: string;
  code: string;
  name: string;
  type: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  futureStock: number;
  minStock: number;
  unit: string;
  supplierId: string | null;
  supplierName: string | null;
}

/**
 * Obtém a lista de produtos cadastrados
 */
export async function getProducts(search?: string): Promise<ProductDTO[]> {
  try {
    await requireAuth();

    const products = await prisma.product.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
            ],
          }
        : undefined,
      include: {
        supplier: true,
      },
      orderBy: { name: "asc" },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      type: p.type,
      costPrice: Number(p.costPrice),
      salePrice: Number(p.salePrice),
      stockQuantity: p.stockQuantity,
      futureStock: p.futureStock || 0,
      minStock: p.minStock,
      unit: p.unit,
      supplierId: p.supplierId,
      supplierName: p.supplier?.name || null,
    }));
  } catch (error) {
    logger.error("Erro ao obter produtos do estoque:", error);
    return [];
  }
}

/**
 * Cadastra um novo produto no estoque master
 */
export async function createProduct(data: {
  code: string;
  name: string;
  type?: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  futureStock?: number;
  minStock: number;
  unit?: string;
  supplierId?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("estoque.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client

    const existing = await prisma.product.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error(`Já existe um produto cadastrado com o código ${data.code}.`);
    }

    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type || "PECA",
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQuantity: data.stockQuantity,
        futureStock: data.futureStock || 0,
        minStock: data.minStock,
        unit: data.unit || "UN",
        supplierId: data.supplierId || null,
      },
    });

    // Se a quantidade inicial for > 0, registra a entrada inicial
    if (data.stockQuantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "ENTRADA",
          quantity: data.stockQuantity,
          reason: "COMPRA",
          cost: data.costPrice,
          date: new Date(),
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "CRIACAO",
        entity: "Produto",
        entityId: product.id,
        changesJson: JSON.stringify(product),
      },
    });

    revalidatePath("/estoque");
    return { success: true, product };
  } catch (error: any) {
    logger.error("Erro ao cadastrar produto:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Lança movimentação de estoque manual (Entrada/Saída de Peças)
 */
export async function adjustProductStock(data: {
  productId: string;
  type: "ENTRADA" | "SAIDA";
  quantity: number;
  reason: "COMPRA" | "AJUSTE" | "PERDA";
  notes?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("estoque.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) throw new Error("Produto não encontrado.");

    let newStock = product.stockQuantity;
    if (data.type === "ENTRADA") {
      newStock += data.quantity;
    } else {
      newStock -= data.quantity;
      if (newStock < 0) {
        throw new Error(`Estoque insuficiente! Saldo atual é de apenas ${product.stockQuantity} ${product.unit}.`);
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: data.productId },
      data: {
        stockQuantity: newStock,
      },
    });

    // Registrar movimentação
    const movement = await prisma.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        cost: Number(product.costPrice),
        date: new Date(),
      },
    });

    // Notificação se estoque cair abaixo do mínimo
    if (newStock <= product.minStock) {
      await prisma.notification.create({
        data: {
          title: "Estoque Mínimo Alerta",
          message: `O produto '${product.name}' atingiu o saldo mínimo configurado de ${newStock} ${product.unit}.`,
          type: "ESTOQUE",
          link: "/estoque",
        },
      });
    }

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "EDICAO",
        entity: "Produto",
        entityId: data.productId,
        changesJson: JSON.stringify({
          type: data.type,
          qty: data.quantity,
          oldStock: product.stockQuantity,
          newStock,
          reason: data.reason,
        }),
      },
    });

    revalidatePath("/estoque");
    return { success: true, product: updatedProduct };
  } catch (error: any) {
    logger.error("Erro ao ajustar estoque:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Carrega histórico de movimentações de estoque
 */
export async function getStockMovements(productId?: string) {
  try {
    await requireAuth();

    const movements = await prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: true,
        serviceOrder: true,
      },
      orderBy: { date: "desc" },
    });

    return movements.map((m) => ({
      id: m.id,
      productName: m.product.name,
      productCode: m.product.code,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      osCode: m.serviceOrder?.code || null,
      date: m.date,
      cost: m.cost,
    }));
  } catch (error) {
    logger.error("Erro ao obter movimentações de estoque:", error);
    return [];
  }
}

/**
 * Obtém todos os fornecedores cadastrados
 */
export async function getSuppliers() {
  try {
    await requireAuth();

    return await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  } catch (error) {
    logger.error("Erro ao obter fornecedores:", error);
    return [];
  }
}

/**
 * Atualiza os dados de um item/peça no estoque
 */
export async function updateProduct(data: {
  id: string;
  code: string;
  name: string;
  type?: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  unit?: string;
  userId: string;
}) {
  try {
    const session = await requirePermission("estoque.write");
    data.userId = session.userId; // nunca confiar no valor vindo do client

    const existing = await prisma.product.findFirst({
      where: { code: data.code }
    });

    if (existing && existing.id !== data.id) {
      throw new Error(`Já existe outro produto cadastrado com o código ${data.code}.`);
    }

    const oldProduct = await prisma.product.findUnique({
      where: { id: data.id }
    });
    if (!oldProduct) {
      throw new Error("Produto não encontrado.");
    }

    const updated = await prisma.product.update({
      where: { id: data.id },
      data: {
        code: data.code,
        name: data.name,
        type: data.type || "PECA",
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQuantity: data.stockQuantity,
        minStock: data.minStock,
        unit: data.unit || "UN",
      },
    });

    // Registra movimentação de ajuste se o estoque foi modificado manualmente
    if (oldProduct.stockQuantity !== data.stockQuantity) {
      const difference = data.stockQuantity - oldProduct.stockQuantity;
      await prisma.stockMovement.create({
        data: {
          productId: updated.id,
          type: difference > 0 ? "ENTRADA" : "SAIDA",
          quantity: Math.abs(difference),
          reason: "AJUSTE",
          cost: data.costPrice,
          date: new Date(),
        },
      });
    }

    // Registra log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: "EDICAO",
        entity: "Produto",
        entityId: updated.id,
        changesJson: JSON.stringify({ antes: oldProduct, depois: updated }),
      },
    });

    revalidatePath("/estoque");
    return { success: true, product: updated };
  } catch (error: any) {
    logger.error("Erro ao atualizar produto:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Converte quantidade de Estoque Futuro (A Comprar/Pedido) para Estoque Presente (Físico/Entregue)
 */
export async function convertFutureStockToPresentAction(data: {
  productId: string;
  quantityToConvert: number;
}) {
  try {
    const session = await requirePermission("estoque.write");

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      return { success: false, error: "Produto não encontrado." };
    }

    const qtyToMove = Math.min(data.quantityToConvert, product.futureStock);
    if (qtyToMove <= 0) {
      return { success: false, error: "Quantidade inválida para conversão." };
    }

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        futureStock: Math.max(0, product.futureStock - qtyToMove),
        stockQuantity: product.stockQuantity + qtyToMove,
      },
    });

    // Registra a entrada física no almoxarifado
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "ENTRADA",
        quantity: qtyToMove,
        reason: "COMPRA",
        cost: Number(product.costPrice),
        date: new Date(),
      },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "ENTRADA_FUTURA_CONVERTIDA",
        entity: "Produto",
        entityId: product.id,
        changesJson: JSON.stringify({
          convertido: qtyToMove,
          novoEstoquePresente: updated.stockQuantity,
          novoEstoqueFuturo: updated.futureStock,
        }),
      },
    });

    revalidatePath("/estoque");
    return { success: true, product: updated, convertedQuantity: qtyToMove };
  } catch (error: any) {
    logger.error("Erro ao converter estoque futuro em presente:", error);
    return { success: false, error: error.message || "Erro ao processar entrada do produto." };
  }
}
