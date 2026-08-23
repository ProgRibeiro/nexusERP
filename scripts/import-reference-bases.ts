import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db";

const source = process.argv[2] || "/Users/lucasribeiro/Downloads/LUCAS RIBEIRO - OrçaMais [4 Bases] - v3.0.8.xlsx";
const bases = ["SINAPI", "SICRO", "SEINFRA", "OUTRA"] as const;
const text = (v: unknown) => typeof v === "object" && v && "richText" in v ? (v as any).richText.map((x: any) => x.text || "").join("") : String(v ?? "").trim();
const num = (v: unknown) => Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0;

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(source);
  let total = 0;
  for (const base of bases) {
    const sheet = workbook.getWorksheet(base);
    if (!sheet) continue;
    const meta: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) {
      const row = sheet.getRow(i);
      const key = text(row.getCell(4).value).toUpperCase();
      if (key) meta[key] = text(row.getCell(5).value);
    }
    const state = meta["ESTADO"] || null;
    const referenceMonth = meta["MÊS DE REFERÊNCIA"] || meta["TABELA DE REFERÊNCIA"] || null;
    const regime = meta["FOLHA DE PAGAMENTO"] || null;
    const rows: any[] = [];
    for (let i = base === "OUTRA" ? 12 : 11; i <= sheet.actualRowCount; i++) {
      const v = sheet.getRow(i).values as any[];
      const code = text(v[base === "OUTRA" ? 3 : 3]);
      const description = text(v[base === "OUTRA" ? 4 : 4]);
      const unit = text(v[base === "OUTRA" ? 5 : 5]);
      const price = num(v[base === "OUTRA" ? 6 : 6]);
      const type = text(v[2]).toUpperCase();
      if (!code || !description || !price || code.startsWith("Insira")) continue;
      rows.push({ base, sourceOrganization: base === "OUTRA" ? (meta["ÓRÃO OU INSTITUIÇÃO"] || "OUTRA") : base, state, referenceMonth, regime, itemType: type === "C" ? "COMPOSICAO" : type === "I" ? "INSUMO" : "MANUAL", code, description, unit: unit || null, unitPrice: price });
    }
    for (let i = 0; i < rows.length; i += 500) await prisma.referencePriceItem.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    total += rows.length;
    console.log(`${base}: ${rows.length} registros`);
  }
  console.log(`Total processado: ${total}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
