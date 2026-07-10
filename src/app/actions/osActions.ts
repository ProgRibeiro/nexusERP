"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface OSPartsInput {
  productId: string;
  quantity: number;
  salePrice: number;
  usedQuantity: number;
  status: "PREVISTO" | "UTILIZADO" | "DEVOLVIDO";
}

/**
 * Obtém a listagem de OSs com filtros flexíveis
 */
export async function getServiceOrders(filters?: {
  search?: string;
  status?: string;
  techId?: string;
  priority?: string;
}) {
  try {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.techId) {
      where.technicians = {
        some: {
          userId: filters.techId,
        },
      };
    }
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { client: { name: { contains: filters.search } } },
        { problemReported: { contains: filters.search } },
      ];
    }

    const serviceOrders = await prisma.serviceOrder.findMany({
      where,
      include: {
        client: true,
        technicians: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { code: "desc" },
    });

    return serviceOrders.map((os) => ({
      id: os.id,
      code: os.code,
      clientName: os.client.name,
      status: os.status,
      priority: os.priority,
      type: os.type,
      scheduledDate: os.scheduledDate,
      scheduledTime: os.scheduledTime,
      technicians: os.technicians.map((t) => t.user.name),
    }));
  } catch (error) {
    console.error("Erro ao obter ordens de serviço:", error);
    return [];
  }
}

/**
 * Obtém detalhes completos de uma OS específica
 */
export async function getServiceOrderDetails(id: string) {
  try {
    const os = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            addresses: true,
            contacts: true,
          },
        },
        address: true,
        contact: true,
        items: true,
        materials: {
          include: {
            product: true,
          },
        },
        photos: true,
        technicians: {
          include: {
            user: true,
          },
        },
        statusHistory: {
          include: {
            changedBy: true,
          },
          orderBy: { changedAt: "desc" },
        },
        completionReport: true,
        invoices: true,
      },
    });

    return os;
  } catch (error) {
    console.error(`Erro ao obter OS ${id}:`, error);
    return null;
  }
}

/**
 * Agenda data/horário e atribui equipe técnica para a OS
 */
export async function scheduleServiceOrder(
  osId: string,
  data: {
    scheduledDate: Date;
    scheduledTime: string;
    techIds: string[];
    priority?: string;
  },
  userId: string
) {
  try {
    // 1. Limpa técnicos antigos atribuídos
    await prisma.serviceOrderTechnician.deleteMany({
      where: { serviceOrderId: osId },
    });

    // 2. Insere os novos técnicos
    const techRelations = data.techIds.map((tId) => ({
      serviceOrderId: osId,
      userId: tId,
    }));

    if (techRelations.length > 0) {
      await prisma.serviceOrderTechnician.createMany({
        data: techRelations,
      });
    }

    // 3. Atualiza os dados de agendamento na OS
    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data: {
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        priority: data.priority || "MEDIA",
        status: "AGENDADA", // Transiciona automaticamente para Agendada
      },
    });

    // Grava histórico
    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: osId,
        oldStatus: "CRIADA",
        newStatus: "AGENDADA",
        changedById: userId,
        justification: `OS agendada para ${new Date(data.scheduledDate).toLocaleDateString(
          "pt-BR"
        )} às ${data.scheduledTime}.`,
      },
    });

    revalidatePath("/ordens-servico");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    console.error("Erro ao agendar OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Transiciona o status da OS com auditoria
 */
export async function updateOSStatus(
  osId: string,
  newStatus: string,
  userId: string,
  justification?: string
) {
  try {
    const os = await prisma.serviceOrder.findUnique({
      where: { id: osId },
    });

    if (!os) throw new Error("OS não encontrada.");

    const oldStatus = os.status;

    // Regra de bloqueio de faturamento
    if (newStatus === "FATURAMENTO") {
      const hasReport = await prisma.completionReport.findUnique({
        where: { serviceOrderId: osId },
      });
      if (!hasReport || !hasReport.approvedByClient) {
        throw new Error("A OS só pode seguir para faturamento quando o relatório de conclusão estiver aprovado pelo cliente.");
      }
    }

    const data: any = { status: newStatus };
    if (newStatus === "CONCLUIDA" || newStatus === "FATURAMENTO") {
      data.completedAt = new Date();
    }

    const updatedOS = await prisma.serviceOrder.update({
      where: { id: osId },
      data,
    });

    // Registrar histórico
    await prisma.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: osId,
        oldStatus,
        newStatus,
        changedById: userId,
        justification: justification || "Alteração manual de status.",
      },
    });

    // Se a OS for concluída, gerar relatório pendente na notificação
    if (newStatus === "CONCLUIDA") {
      await prisma.notification.create({
        data: {
          title: "Relatório de OS pendente",
          message: `A OS ${os.code} foi concluída pelo técnico. Favor enviar o relatório ao cliente.`,
          type: "OPERACIONAL",
          link: "/ordens-servico",
        },
      });
    }

    revalidatePath("/ordens-servico");
    revalidatePath("/execucao");
    return { success: true, os: updatedOS };
  } catch (error: any) {
    console.error("Erro ao alterar status da OS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza materiais da OS e executa baixa de estoque integrada
 */
export async function updateOSMaterials(
  osId: string,
  materials: OSPartsInput[],
  userId: string
) {
  try {
    // 1. Carregar materiais já cadastrados para esta OS para comparar
    const currentMaterials = await prisma.serviceOrderMaterial.findMany({
      where: { serviceOrderId: osId },
    });

    // Executar transações atômicas para atualizar estoque e tabelas
    await prisma.$transaction(async (tx) => {
      // Remover materiais antigos da OS que foram deletados da lista
      const inputProductIds = materials.map((m) => m.productId);
      const toDelete = currentMaterials.filter((cm) => !inputProductIds.includes(cm.productId));

      for (const matToDelete of toDelete) {
        // Se já estava UTILIZADO, precisamos devolver o estoque!
        if (matToDelete.status === "UTILIZADO" && matToDelete.usedQuantity > 0) {
          const prod = await tx.product.findUnique({ where: { id: matToDelete.productId } });
          if (prod) {
            await tx.product.update({
              where: { id: matToDelete.productId },
              data: { stockQuantity: prod.stockQuantity + matToDelete.usedQuantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: matToDelete.productId,
                type: "ENTRADA",
                quantity: matToDelete.usedQuantity,
                reason: "AJUSTE",
                serviceOrderId: osId,
                cost: matToDelete.costPrice,
              },
            });
          }
        }
        await tx.serviceOrderMaterial.delete({ where: { id: matToDelete.id } });
      }

      // Adicionar ou Atualizar materiais
      for (const matInput of materials) {
        const existing = currentMaterials.find((cm) => cm.productId === matInput.productId);
        const product = await tx.product.findUnique({ where: { id: matInput.productId } });

        if (!product) throw new Error("Produto do estoque não encontrado.");

        if (existing) {
          // Atualiza registro existente
          const oldStatus = existing.status;
          const oldUsedQty = existing.usedQuantity;

          await tx.serviceOrderMaterial.update({
            where: { id: existing.id },
            data: {
              quantity: matInput.quantity,
              salePrice: matInput.salePrice,
              usedQuantity: matInput.usedQuantity,
              status: matInput.status,
            },
          });

          // Tratar movimentação de estoque
          if (matInput.status === "UTILIZADO" && oldStatus !== "UTILIZADO") {
            // Estava previsto ou devolvido e agora foi utilizado -> Subtrair estoque
            await tx.product.update({
              where: { id: matInput.productId },
              data: { stockQuantity: product.stockQuantity - matInput.usedQuantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: matInput.productId,
                type: "SAIDA",
                quantity: matInput.usedQuantity,
                reason: "OS_UTILIZADO",
                serviceOrderId: osId,
                cost: product.costPrice,
              },
            });
          } else if (matInput.status === "UTILIZADO" && oldStatus === "UTILIZADO" && oldUsedQty !== matInput.usedQuantity) {
            // Ajustar a diferença de quantidade utilizada
            const diff = matInput.usedQuantity - oldUsedQty;
            await tx.product.update({
              where: { id: matInput.productId },
              data: { stockQuantity: product.stockQuantity - diff },
            });
            await tx.stockMovement.create({
              data: {
                productId: matInput.productId,
                type: diff > 0 ? "SAIDA" : "ENTRADA",
                quantity: Math.abs(diff),
                reason: "AJUSTE",
                serviceOrderId: osId,
                cost: product.costPrice,
              },
            });
          } else if (matInput.status !== "UTILIZADO" && oldStatus === "UTILIZADO") {
            // Cancelou o uso -> Devolve o estoque
            await tx.product.update({
              where: { id: matInput.productId },
              data: { stockQuantity: product.stockQuantity + oldUsedQty },
            });
            await tx.stockMovement.create({
              data: {
                productId: matInput.productId,
                type: "ENTRADA",
                quantity: oldUsedQty,
                reason: "OS_DEVOLVIDO",
                serviceOrderId: osId,
                cost: product.costPrice,
              },
            });
          }
        } else {
          // Cria novo registro de material na OS
          await tx.serviceOrderMaterial.create({
            data: {
              serviceOrderId: osId,
              productId: matInput.productId,
              quantity: matInput.quantity,
              costPrice: product.costPrice,
              salePrice: matInput.salePrice,
              usedQuantity: matInput.usedQuantity,
              status: matInput.status,
            },
          });

          // Se já marcou como UTILIZADO no cadastro inicial -> Subtrai estoque
          if (matInput.status === "UTILIZADO") {
            await tx.product.update({
              where: { id: matInput.productId },
              data: { stockQuantity: product.stockQuantity - matInput.usedQuantity },
            });
            await tx.stockMovement.create({
              data: {
                productId: matInput.productId,
                type: "SAIDA",
                quantity: matInput.usedQuantity,
                reason: "OS_UTILIZADO",
                serviceOrderId: osId,
                cost: product.costPrice,
              },
            });
          }
        }

        // Emitir alerta de estoque mínimo se aplicável
        const reloadedProduct = await tx.product.findUnique({ where: { id: matInput.productId } });
        if (reloadedProduct && reloadedProduct.stockQuantity <= reloadedProduct.minStock) {
          await tx.notification.create({
            data: {
              title: "Alerta de Estoque Mínimo",
              message: `O produto '${reloadedProduct.name}' atingiu o estoque crítico de ${reloadedProduct.stockQuantity} ${reloadedProduct.unit}.`,
              type: "ESTOQUE",
              link: "/estoque",
            },
          });
        }
      }

      // 6. Recalcular a margem real da OS
      // Margem Real = Total Venda dos Serviços/Itens + Total Venda das Peças Utilizadas - Custo Real das Peças Utilizadas
      const osItems = await tx.serviceOrderItem.findMany({ where: { serviceOrderId: osId } });
      const osMaterials = await tx.serviceOrderMaterial.findMany({ where: { serviceOrderId: osId } });

      const totalItemsValue = osItems.reduce((sum, item) => sum + item.total, 0);
      const usedMaterials = osMaterials.filter((m) => m.status === "UTILIZADO");
      
      const totalMaterialsSale = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * m.salePrice, 0);
      const totalMaterialsCost = usedMaterials.reduce((sum, m) => sum + m.usedQuantity * m.costPrice, 0);

      const totalOSRevenue = totalItemsValue + totalMaterialsSale;
      const totalOSCost = totalMaterialsCost;
      const marginReal = totalOSRevenue - totalOSCost;

      await tx.serviceOrder.update({
        where: { id: osId },
        data: {
          marginReal,
        },
      });
    });

    revalidatePath("/ordens-servico");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao atualizar materiais e estoque da OS:", error);
    return { success: false, error: error.message };
  }
}
