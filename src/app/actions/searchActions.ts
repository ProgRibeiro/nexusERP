"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface SearchResult {
  id: string;
  type: "cliente" | "lead" | "equipamento" | "os" | "orcamento" | "nota" | "receber" | "pagar" | "contrato" | "produto" | "usuario";
  title: string;
  subtitle: string;
  link: string;
}

function hasPerm(permissions: string[], roleName: string, code: string): boolean {
  return roleName === "Administrador" || permissions.includes("admin.all") || permissions.includes(code);
}

/** Prefix matches rank above mid-string matches; original category order is preserved otherwise (stable sort). */
function byRelevance(cleanQuery: string) {
  const q = cleanQuery.toLowerCase();
  return (r: SearchResult) => (r.title.toLowerCase().startsWith(q) ? 0 : 1);
}

export async function searchGlobalAction(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

    const cleanQuery = query.trim();
    const terms = cleanQuery.split(/\s+/).filter(Boolean).slice(0, 6);

  try {
    const session = await requireAuth();
    const { permissions, roleName } = session;

    const results: SearchResult[] = [];

    // 1. Buscar Clientes
    if (hasPerm(permissions, roleName, "clients.read")) {
      const clients = await prisma.client.findMany({
        where: {
          AND: terms.map((term) => ({ OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            { socialName: { contains: term, mode: "insensitive" as const } },
            { cpfCnpj: { contains: term } },
            { phone: { contains: term } },
            { email: { contains: term, mode: "insensitive" as const } },
            { contacts: { some: { OR: [{ name: { contains: term, mode: "insensitive" as const } }, { email: { contains: term, mode: "insensitive" as const } }, { phone: { contains: term } }, { whatsapp: { contains: term } }] } } },
            { addresses: { some: { OR: [{ street: { contains: term, mode: "insensitive" as const } }, { city: { contains: term, mode: "insensitive" as const } }, { cep: { contains: term } }] } } },
          ] })),
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
    }

    // 2. Leads e oportunidades comerciais
    if (hasPerm(permissions, roleName, "crm.read")) {
      const leads = await prisma.lead.findMany({
        where: { AND: terms.map((term) => ({ OR: [
          { name: { contains: term, mode: "insensitive" } },
          { company: { contains: term, mode: "insensitive" } },
          { phone: { contains: term } },
          { email: { contains: term, mode: "insensitive" } },
          { notes: { contains: term, mode: "insensitive" } },
        ] })) },
        include: { pipelineStage: true },
        take: 4,
      });
      leads.forEach((lead) => results.push({
        id: lead.id,
        type: "lead",
        title: `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
        subtitle: `${lead.pipelineStage?.name || lead.status} • ${lead.phone}`,
        link: `/crm?id=${lead.id}`,
      }));
    }

    // 3. Equipamentos instalados também encontram o cliente relacionado.
    if (hasPerm(permissions, roleName, "clients.read")) {
      const equipments = await prisma.clientEquipment.findMany({
        where: { AND: terms.map((term) => ({ OR: [
          { client: { name: { contains: term, mode: "insensitive" } } },
          { type: { contains: term, mode: "insensitive" } },
          { brand: { contains: term, mode: "insensitive" } },
          { model: { contains: term, mode: "insensitive" } },
          { serialNumber: { contains: term, mode: "insensitive" } },
          { capacity: { contains: term, mode: "insensitive" } },
          { tag: { contains: term, mode: "insensitive" } },
          { location: { contains: term, mode: "insensitive" } },
        ] })) },
        include: { client: true },
        take: 4,
      });
      equipments.forEach((equipment) => results.push({
        id: equipment.clientId,
        type: "equipamento",
        title: `${equipment.type} ${equipment.capacity || ""} · ${equipment.client.name}`.trim(),
        subtitle: `${equipment.brand} ${equipment.model} • Série ${equipment.serialNumber}`,
        link: `/clientes?id=${equipment.clientId}`,
      }));
    }

    // 4. Buscar Ordens de Serviço
    if (hasPerm(permissions, roleName, "os.read")) {
      const serviceOrders = await prisma.serviceOrder.findMany({
        where: {
          AND: terms.map((term) => ({ OR: [
            { id: { contains: term } },
            { code: { contains: term, mode: "insensitive" } },
            { problemReported: { contains: term, mode: "insensitive" } },
            { technicalDiagnosis: { contains: term, mode: "insensitive" } },
            { status: { contains: term, mode: "insensitive" } },
            { client: { name: { contains: term, mode: "insensitive" } } },
          ] })),
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
          title: `${so.code} - ${so.client.name}`,
          subtitle: `Status: ${so.status} • Serviço: ${(so.problemReported || "").slice(0, 40)}...`,
          link: `/ordens-servico?id=${so.id}`,
        });
      });
    }

    // 5. Buscar Orçamentos
    if (hasPerm(permissions, roleName, "quotes.read")) {
      const quotes = await prisma.quote.findMany({
        where: {
          AND: terms.map((term) => ({ OR: [
            { id: { contains: term } },
            { code: { contains: term, mode: "insensitive" } },
            { status: { contains: term, mode: "insensitive" } },
            { notes: { contains: term, mode: "insensitive" } },
            { client: { name: { contains: term, mode: "insensitive" } } },
            { items: { some: { description: { contains: term, mode: "insensitive" } } } },
          ] })),
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
          title: `${q.code} - ${q.client.name}`,
          subtitle: `Status: ${q.status} • Total: R$ ${q.total.toFixed(2)}`,
          link: `/orcamentos?id=${q.id}`,
        });
      });
    }

    // 6. Buscar Notas Fiscais
    if (hasPerm(permissions, roleName, "faturamento.read")) {
      const invoices = await prisma.invoice.findMany({
        where: {
          OR: [
            { code: { contains: cleanQuery } },
            { status: { contains: cleanQuery } },
            { serviceOrder: { client: { name: { contains: cleanQuery } } } },
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
    }

    // 7. Contas a receber e a pagar
    if (hasPerm(permissions, roleName, "financeiro.read")) {
      const [receivables, payables] = await Promise.all([
        prisma.accountsReceivable.findMany({
          where: { AND: terms.map((term) => ({ OR: [
            { client: { name: { contains: term, mode: "insensitive" } } },
            { serviceOrder: { code: { contains: term, mode: "insensitive" } } },
            { invoice: { code: { contains: term, mode: "insensitive" } } },
            { status: { contains: term, mode: "insensitive" } },
            { notes: { contains: term, mode: "insensitive" } },
          ] })) },
          include: { client: true, serviceOrder: true, invoice: true },
          take: 4,
        }),
        prisma.accountsPayable.findMany({
          where: { AND: terms.map((term) => ({ OR: [
            { providerName: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { serviceOrder: { code: { contains: term, mode: "insensitive" } } },
            { status: { contains: term, mode: "insensitive" } },
            { category: { contains: term, mode: "insensitive" } },
          ] })) },
          include: { serviceOrder: true },
          take: 4,
        }),
      ]);
      receivables.forEach((item) => results.push({
        id: item.id,
        type: "receber",
        title: `Receber de ${item.client.name}`,
        subtitle: `${item.invoice?.code || item.serviceOrder?.code || "Sem documento"} • R$ ${Number(item.pendingValue).toFixed(2)} • ${item.status}`,
        link: `/financeiro?tab=receber&id=${item.id}`,
      }));
      payables.forEach((item) => results.push({
        id: item.id,
        type: "pagar",
        title: `Pagar ${item.providerName}`,
        subtitle: `${item.description} • R$ ${Number(item.value).toFixed(2)} • ${item.status}`,
        link: `/financeiro?tab=pagar&id=${item.id}`,
      }));
    }

    // 8. Buscar Contratos
    if (hasPerm(permissions, roleName, "contratos.read")) {
      const contracts = await prisma.contract.findMany({
        where: {
          OR: [
            { code: { contains: cleanQuery } },
            { status: { contains: cleanQuery } },
            { client: { name: { contains: cleanQuery } } },
          ],
        },
        include: { client: true },
        take: 4,
      });

      contracts.forEach((c) => {
        results.push({
          id: c.id,
          type: "contrato",
          title: `Contrato ${c.code} - ${c.client.name}`,
          subtitle: `Status: ${c.status} • Valor: R$ ${Number(c.value).toFixed(2)}`,
          link: `/contratos?id=${c.id}`,
        });
      });
    }

    // 6. Buscar Produtos / Peças
    if (hasPerm(permissions, roleName, "estoque.read")) {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { code: { contains: cleanQuery } },
            { name: { contains: cleanQuery } },
          ],
        },
        take: 4,
      });

      products.forEach((p) => {
        results.push({
          id: p.id,
          type: "produto",
          title: `${p.name} (${p.code})`,
          subtitle: `Saldo: ${p.stockQuantity} ${p.unit} • Venda: R$ ${Number(p.salePrice).toFixed(2)}`,
          link: `/estoque?id=${p.id}`,
        });
      });
    }

    // 7. Buscar Usuários (apenas administradores)
    if (hasPerm(permissions, roleName, "admin.all")) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery } },
            { email: { contains: cleanQuery } },
          ],
        },
        include: { role: true },
        take: 4,
      });

      users.forEach((u) => {
        results.push({
          id: u.id,
          type: "usuario",
          title: u.name,
          subtitle: `${u.email} • ${u.role?.name || "Sem perfil"}`,
          link: `/configuracoes?userId=${u.id}`,
        });
      });
    }

    return results.sort((a, b) => byRelevance(cleanQuery)(a) - byRelevance(cleanQuery)(b));
  } catch (error) {
    logger.error("Erro na busca global:", error);
    return [];
  }
}
