"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type DataGraphNodeType = "CLIENTE" | "CONTATO" | "EQUIPAMENTO" | "ORCAMENTO" | "OS" | "CONTRATO" | "NOTA" | "RECEBER" | "PAGAR" | "PRODUTO";

export interface DataGraphNode {
  id: string;
  entityId: string;
  type: DataGraphNodeType;
  label: string;
  subtitle: string;
  status?: string;
  value?: number;
  tab: string;
  params?: Record<string, string>;
}

export interface DataGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível montar a teia de dados.";
}

export async function getDataGraphAction(clientId?: string, search?: string) {
  try {
    await requirePermission("clients.read");
    const term = search?.trim();
    const clients = await prisma.client.findMany({
      where: term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { fancyName: { contains: term, mode: "insensitive" } }, { cpfCnpj: { contains: term.replace(/\D/g, "") } }] } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, name: true, cpfCnpj: true, status: true },
    });

    const focusId = clientId || clients[0]?.id;
    if (!focusId) return { success: true as const, clients, focusId: null, nodes: [], edges: [], truncated: false };

    const client = await prisma.client.findUnique({
      where: { id: focusId },
      include: {
        contacts: { orderBy: { updatedAt: "desc" }, take: 6 },
        equipments: { orderBy: { updatedAt: "desc" }, take: 8 },
        quotes: { orderBy: { updatedAt: "desc" }, take: 12 },
        contracts: { orderBy: { updatedAt: "desc" }, take: 8 },
        accountsReceivable: { orderBy: { updatedAt: "desc" }, take: 12 },
        serviceOrders: {
          orderBy: { updatedAt: "desc" },
          take: 16,
          include: {
            invoices: { orderBy: { updatedAt: "desc" }, take: 4 },
            accountsPayable: { orderBy: { updatedAt: "desc" }, take: 4 },
            materials: { take: 6, include: { product: true } },
          },
        },
      },
    });
    if (!client) return { success: false as const, error: "Cliente não encontrado.", clients, nodes: [], edges: [] };

    const nodes = new Map<string, DataGraphNode>();
    const edges = new Map<string, DataGraphEdge>();
    const addNode = (node: DataGraphNode) => nodes.set(node.id, node);
    const addEdge = (source: string, target: string, label: string) => edges.set(`${source}:${target}:${label}`, { id: `${source}:${target}:${label}`, source, target, label });
    const clientNode = `CLIENTE:${client.id}`;

    addNode({ id: clientNode, entityId: client.id, type: "CLIENTE", label: client.fancyName || client.name, subtitle: client.cpfCnpj || "Documento não informado", status: client.status, tab: "clientes", params: { id: client.id } });

    client.contacts.forEach((contact) => {
      const id = `CONTATO:${contact.id}`;
      addNode({ id, entityId: contact.id, type: "CONTATO", label: contact.name, subtitle: contact.role || contact.email, tab: "clientes", params: { id: client.id } });
      addEdge(clientNode, id, "contato");
    });
    client.equipments.forEach((equipment) => {
      const id = `EQUIPAMENTO:${equipment.id}`;
      addNode({ id, entityId: equipment.id, type: "EQUIPAMENTO", label: `${equipment.brand} ${equipment.model}`, subtitle: equipment.location || equipment.serialNumber, tab: "clientes", params: { id: client.id } });
      addEdge(clientNode, id, "equipamento");
    });
    client.quotes.forEach((quote) => {
      const id = `ORCAMENTO:${quote.id}`;
      addNode({ id, entityId: quote.id, type: "ORCAMENTO", label: quote.code, subtitle: "Orçamento comercial", status: quote.status, value: Number(quote.total), tab: "orcamentos" });
      addEdge(clientNode, id, "orçamento");
    });
    client.contracts.forEach((contract) => {
      const id = `CONTRATO:${contract.id}`;
      addNode({ id, entityId: contract.id, type: "CONTRATO", label: contract.code, subtitle: `Ciclo ${contract.billingPeriod.toLowerCase()}`, status: contract.status, value: Number(contract.value), tab: "contratos" });
      addEdge(clientNode, id, "contrato");
    });
    client.accountsReceivable.forEach((receivable) => {
      const id = `RECEBER:${receivable.id}`;
      addNode({ id, entityId: receivable.id, type: "RECEBER", label: `Receber ${String(receivable.id).slice(-5)}`, subtitle: `Vence ${receivable.dueDate.toLocaleDateString("pt-BR")}`, status: receivable.status, value: Number(receivable.pendingValue), tab: "financeiro", params: { tab: "receber" } });
      const preferredSource = receivable.invoiceId ? `NOTA:${receivable.invoiceId}` : receivable.serviceOrderId ? `OS:${receivable.serviceOrderId}` : receivable.quoteId ? `ORCAMENTO:${receivable.quoteId}` : clientNode;
      const source = nodes.has(preferredSource) ? preferredSource : clientNode;
      addEdge(source, id, "gera recebimento");
    });
    client.serviceOrders.forEach((order) => {
      const orderId = `OS:${order.id}`;
      addNode({ id: orderId, entityId: order.id, type: "OS", label: order.code, subtitle: order.type.replaceAll("_", " "), status: order.status, tab: "ordens-servico", params: { id: order.id } });
      const quoteSource = order.quoteId ? `ORCAMENTO:${order.quoteId}` : "";
      const contractSource = order.contractId ? `CONTRATO:${order.contractId}` : "";
      const orderSource = quoteSource && nodes.has(quoteSource) ? quoteSource : contractSource && nodes.has(contractSource) ? contractSource : clientNode;
      addEdge(orderSource, orderId, orderSource === quoteSource ? "virou OS" : orderSource === contractSource ? "acionou OS" : "solicitou OS");

      order.invoices.forEach((invoice) => {
        const id = `NOTA:${invoice.id}`;
        addNode({ id, entityId: invoice.id, type: "NOTA", label: invoice.code, subtitle: `Emitida ${invoice.issueDate.toLocaleDateString("pt-BR")}`, status: invoice.status, value: invoice.value, tab: "faturamento" });
        addEdge(orderId, id, "faturada por");
      });
      order.accountsPayable.forEach((payable) => {
        const id = `PAGAR:${payable.id}`;
        addNode({ id, entityId: payable.id, type: "PAGAR", label: payable.providerName, subtitle: payable.description, status: payable.status, value: Number(payable.value), tab: "financeiro", params: { tab: "pagar" } });
        addEdge(orderId, id, "gerou custo");
      });
      order.materials.forEach((material) => {
        const id = `PRODUTO:${material.product.id}`;
        addNode({ id, entityId: material.product.id, type: "PRODUTO", label: material.product.name, subtitle: `${material.quantity} ${material.product.unit} · ${material.status}`, status: material.product.stockQuantity <= material.product.minStock ? "ESTOQUE BAIXO" : "EM ESTOQUE", value: Number(material.salePrice), tab: "estoque" });
        addEdge(orderId, id, "utiliza");
      });
    });

    // Algumas relações podem apontar para registros fora do recorte recente.
    // A aresta só é exibida se suas duas pontas estiverem presentes.
    const visibleEdges = [...edges.values()].filter((edge) => nodes.has(edge.source) && nodes.has(edge.target));
    return {
      success: true as const,
      clients,
      focusId,
      nodes: [...nodes.values()],
      edges: visibleEdges,
      truncated: client.quotes.length === 12 || client.serviceOrders.length === 16 || client.accountsReceivable.length === 12,
    };
  } catch (error) {
    logger.error("Erro ao carregar teia de dados", error);
    return { success: false as const, error: message(error), clients: [], nodes: [], edges: [] };
  }
}

export async function getImportGraphHistoryAction() {
  try {
    await requirePermission("admin.all");
    const batches = await prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { createdBy: { select: { name: true } } } });
    return { success: true as const, batches: batches.map((batch) => ({ id: batch.id, type: batch.type, status: batch.status, total: batch.totalRows, created: batch.createdRows, updated: batch.updatedRows, skipped: batch.skippedRows, errors: batch.errorRows, createdAt: batch.createdAt.toISOString(), user: batch.createdBy?.name || "Sistema" })) };
  } catch {
    return { success: false as const, batches: [] };
  }
}

export async function getImportBatchDetailsAction(batchId: string) {
  try {
    await requirePermission("admin.all");
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) return { success: false as const, error: "Lote inválido.", rows: [] };
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        type: true,
        status: true,
        rows: {
          orderBy: { rowNumber: "asc" },
          take: 100,
          select: { id: true, rowNumber: true, status: true, entityType: true, entityId: true, normalizedJson: true, error: true },
        },
      },
    });
    if (!batch) return { success: false as const, error: "Lote não encontrado.", rows: [] };
    return {
      success: true as const,
      batch: { id: batch.id, type: batch.type, status: batch.status },
      rows: batch.rows.map((row) => {
        let label = `${row.entityType} · linha ${row.rowNumber}`;
        if (row.normalizedJson) {
          try {
            const data = JSON.parse(row.normalizedJson) as Record<string, unknown>;
            label = String(data.name || data.code || data.cpfCnpj || label);
          } catch { /* mantém o rótulo seguro */ }
        }
        return { ...row, label };
      }),
    };
  } catch (error) {
    logger.error("Erro ao detalhar lote de importação", error);
    return { success: false as const, error: message(error), rows: [] };
  }
}
