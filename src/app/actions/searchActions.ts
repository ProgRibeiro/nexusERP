"use server";

import { prisma } from "@/lib/db";

export interface SearchResult {
  id: string;
  type: "cliente" | "os" | "orcamento" | "nota";
  title: string;
  subtitle: string;
  link: string;
}

export async function searchGlobalAction(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim();

  try {
    const results: SearchResult[] = [];

    // 1. Buscar Clientes
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: cleanQuery, mode: "insensitive" } },
          { cpfCnpj: { contains: cleanQuery, mode: "insensitive" } },
          { phone: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      take: 4,
    });

    clients.forEach((c) => {
      results.push({
        id: c.id,
        type: "cliente",
        title: c.name,
        subtitle: `CNPJ/CPF: ${c.cpfCnpj} • Telefone: ${c.phone}`,
        link: `/clientes?id=${c.id}`,
      });
    });

    // 2. Buscar Ordens de Serviço
    const serviceOrders = await prisma.serviceOrder.findMany({
      where: {
        OR: [
          { id: { contains: cleanQuery, mode: "insensitive" } },
          { problemReported: { contains: cleanQuery, mode: "insensitive" } },
          { status: { contains: cleanQuery, mode: "insensitive" } },
          { client: { name: { contains: cleanQuery, mode: "insensitive" } } },
        ],
      },
      include: {
        client: true,
      },
      take: 4,
    });

    serviceOrders.forEach((so) => {
      results.push({
        id: so.id,
        type: "os",
        title: `OS #${so.id.slice(0, 8)} - ${so.client.name}`,
        subtitle: `Status: ${so.status} • Serviço: ${(so.problemReported || "").slice(0, 40)}...`,
        link: `/ordens-servico?id=${so.id}`,
      });
    });

    // 3. Buscar Orçamentos
    const quotes = await prisma.quote.findMany({
      where: {
        OR: [
          { id: { contains: cleanQuery, mode: "insensitive" } },
          { status: { contains: cleanQuery, mode: "insensitive" } },
          { client: { name: { contains: cleanQuery, mode: "insensitive" } } },
        ],
      },
      include: {
        client: true,
      },
      take: 4,
    });

    quotes.forEach((q) => {
      results.push({
        id: q.id,
        type: "orcamento",
        title: `Orçamento #${q.id.slice(0, 8)} - ${q.client.name}`,
        subtitle: `Status: ${q.status} • Total: R$ ${q.total.toFixed(2)}`,
        link: `/orcamentos?id=${q.id}`,
      });
    });

    // 4. Buscar Notas Fiscais
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { code: { contains: cleanQuery, mode: "insensitive" } },
          { status: { contains: cleanQuery, mode: "insensitive" } },
          { serviceOrder: { client: { name: { contains: cleanQuery, mode: "insensitive" } } } },
        ],
      },
      include: {
        serviceOrder: {
          include: {
            client: true,
          },
        },
      },
      take: 4,
    });

    invoices.forEach((i) => {
      results.push({
        id: i.id,
        type: "nota",
        title: `NFS-e #${i.code || "Rascunho"} - ${i.serviceOrder.client.name}`,
        subtitle: `Status: ${i.status} • Valor: R$ ${i.value.toFixed(2)}`,
        link: `/faturamento?id=${i.id}`,
      });
    });

    return results;
  } catch (error) {
    console.error("Erro na busca global:", error);
    return [];
  }
}
