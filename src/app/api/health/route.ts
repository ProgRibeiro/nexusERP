import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      release: process.env.APP_RELEASE || "local",
      slot: process.env.APP_SLOT || "local",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
