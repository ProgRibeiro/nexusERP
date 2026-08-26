import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBackupReadinessStatus } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [clientsCount, recsCount, payCount, ordersCount] = await Promise.all([
      prisma.client.count().catch(() => -1),
      prisma.accountsReceivable.count().catch(() => -1),
      prisma.accountsPayable.count().catch(() => -1),
      prisma.serviceOrder.count().catch(() => -1),
    ]);

    if (clientsCount < 0 || recsCount < 0 || payCount < 0 || ordersCount < 0) {
      return NextResponse.json(
        {
          status: "error",
          database: "schema_table_query_failed",
          counts: { clients: clientsCount, receivables: recsCount, payables: payCount, orders: ordersCount },
          release: process.env.APP_RELEASE || "local",
          slot: process.env.APP_SLOT || "local",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const backup = getBackupReadinessStatus();
    return NextResponse.json({
      status: "ok",
      database: "ok",
      integrity: {
        clients: clientsCount,
        receivables: recsCount,
        payables: payCount,
        orders: ordersCount,
      },
      backup,
      release: process.env.APP_RELEASE || "local",
      slot: process.env.APP_SLOT || "local",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable", backup: { status: "unknown" }, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
