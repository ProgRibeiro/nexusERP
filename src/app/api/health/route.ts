import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBackupReadinessStatus } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const backup = getBackupReadinessStatus();
    return NextResponse.json({
      status: "ok",
      database: "ok",
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
