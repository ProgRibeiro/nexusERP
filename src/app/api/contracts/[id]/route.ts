import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...contract,
      value: Number(contract.value),
      items: contract.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    logger.error("contract_api_failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
