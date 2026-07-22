import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../src/lib/db");
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Informe o caminho do arquivo XLSX.");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await readFile(filePath)) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Planilha sem uma aba de dados.");

  const expected = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    expected.push({
      name: row.getCell(1).text.trim(),
      category: row.getCell(2).text.trim() || null,
      maintenanceType: row.getCell(3).text.trim() || null,
      description: row.getCell(4).text.trim(),
      billingUnit: row.getCell(5).text.trim() || "Serviço",
      defaultPrice: Number(row.getCell(6).text),
      estimatedHours: Number(row.getCell(7).text) || null,
    });
  }

  const services = await prisma.service.findMany({
    where: { name: { in: expected.map((service) => service.name) } },
  });
  const byName = new Map(services.map((service) => [service.name, service]));
  const mismatches: Array<{ name: string; field: string; expected: unknown; actual: unknown }> = [];

  for (const expectedService of expected) {
    const actual = byName.get(expectedService.name);
    if (!actual) {
      mismatches.push({ name: expectedService.name, field: "registro", expected: "presente", actual: "ausente" });
      continue;
    }
    for (const field of ["category", "maintenanceType", "description", "billingUnit", "defaultPrice", "estimatedHours"] as const) {
      if (String(actual[field] ?? "") !== String(expectedService[field] ?? "")) {
        mismatches.push({ name: expectedService.name, field, expected: expectedService[field], actual: actual[field] });
      }
    }
  }

  const latestBatch = await prisma.importBatch.findFirst({
    where: { type: "servicos" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rows: true } } },
  });

  const result = {
    success: mismatches.length === 0 && services.length === expected.length,
    expectedRows: expected.length,
    matchedServices: services.length,
    mismatches,
    latestBatch: latestBatch ? {
      id: latestBatch.id,
      status: latestBatch.status,
      totalRows: latestBatch.totalRows,
      createdRows: latestBatch.createdRows,
      updatedRows: latestBatch.updatedRows,
      skippedRows: latestBatch.skippedRows,
      errorRows: latestBatch.errorRows,
      auditedRows: latestBatch._count.rows,
    } : null,
  };

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (!result.success) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
