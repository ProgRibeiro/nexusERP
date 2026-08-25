import { NextResponse } from "next/server";
import { syncGoogleSheetBackgroundAction } from "@/app/actions/nexusOneImportActions";

export async function GET() {
  try {
    const res = await syncGoogleSheetBackgroundAction();
    return NextResponse.json({
      success: res.success,
      timestamp: new Date().toISOString(),
      summary: res,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Erro de sincronização." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
