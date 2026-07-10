import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("id");

    if (!contractId) {
      return NextResponse.json({ error: "Missing contract ID" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        items: true,
        serviceOrders: {
          orderBy: { scheduledDate: "desc" },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Buscar contas a receber vinculadas a esta carteira de OSs ou com categoria CONTRATO para este cliente
    const osIds = contract.serviceOrders.map((os) => os.id);

    const receivables = await prisma.accountsReceivable.findMany({
      where: {
        OR: [
          { serviceOrderId: { in: osIds } },
          {
            clientId: contract.clientId,
            category: "CONTRATO",
          },
        ],
      },
      orderBy: { dueDate: "desc" },
    });

    return NextResponse.json({
      items: contract.items,
      serviceOrders: contract.serviceOrders.map((os) => ({
        id: os.id,
        code: os.code,
        status: os.status,
        scheduledDate: os.scheduledDate,
      })),
      receivables: receivables.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        status: r.status,
        totalValue: r.totalValue,
      })),
    });
  } catch (error: any) {
    console.error("Erro na API de detalhes do contrato:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
