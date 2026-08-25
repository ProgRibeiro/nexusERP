import { NextResponse } from "next/server";
import { generateFullSpreadsheetBackupBuffer } from "@/app/actions/spreadsheetBackupActions";

export async function GET() {
  try {
    const buffer = await generateFullSpreadsheetBackupBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Backup_ERP_O_Prestador_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Erro ao gerar planilha de backup." },
      { status: 500 }
    );
  }
}
