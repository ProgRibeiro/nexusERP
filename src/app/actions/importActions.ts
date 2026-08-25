"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mutationFailure } from "@/lib/actionErrors";

export type ImportType = "clientes" | "servicos" | "materiais";
type ImportRecord = Record<string, unknown>;
type RowStatus = "CRIADO" | "ATUALIZADO" | "IGNORADO" | "ERRO";

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/** Lê arquivos no servidor para aplicar limite de tamanho e não travar o navegador. */
export async function parseImportFileAction(formData: FormData) {
  try {
    await requirePermission("admin.all");
    const file = formData.get("file");
    const importType = String(formData.get("type") || "clientes") as ImportType;
    if (!(file instanceof File)) return { success: false as const, error: "Arquivo não recebido." };
    if (file.size > 10 * 1024 * 1024) return { success: false as const, error: "O arquivo deve ter no máximo 10 MB." };
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "tsv", "xlsx"].includes(extension)) {
      return { success: false as const, error: "Formato permitido: CSV, TSV ou XLSX." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (extension === "csv" || extension === "tsv") {
      return { success: true as const, text: buffer.toString("utf8").replace(/^\uFEFF/, ""), fileName: file.name };
    }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    // ExcelJS ainda publica uma definição antiga de Buffer; em runtime o
    // Buffer nativo do Node é exatamente o formato aceito pelo leitor.
    await workbook.xlsx.load(buffer as never);
    const sheetTerms: Record<ImportType, string[]> = {
      clientes: ["cliente", "contato"],
      servicos: ["servico"],
      materiais: ["material", "estoque", "produto", "peca"],
    };
    const normalizeLabel = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const worksheet = workbook.worksheets.find((sheet) =>
      sheetTerms[importType].some((term) => normalizeLabel(sheet.name).includes(term))
    ) || workbook.worksheets[0];
    if (!worksheet) return { success: false as const, error: "A planilha não possui abas com dados." };
    if (worksheet.actualRowCount > 5001) return { success: false as const, error: "A planilha excede o limite de 5.000 registros." };
    if (worksheet.actualColumnCount > 100) return { success: false as const, error: "A planilha excede o limite de 100 colunas." };

    const headerTerms: Record<ImportType, string[]> = {
      clientes: ["cliente", "nome", "empresa", "cnpj", "cpf", "email", "telefone"],
      servicos: ["servico", "descricao", "nome", "preco", "valor", "categoria"],
      materiais: ["material", "produto", "peca", "nome", "codigo", "estoque"],
    };
    let headerRow = 1;
    let bestScore = -1;
    for (let rowNumber = 1; rowNumber <= Math.min(20, worksheet.actualRowCount); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const labels = Array.from({ length: worksheet.actualColumnCount }, (_, index) =>
        normalizeLabel(row.getCell(index + 1).text)
      );
      const score = headerTerms[importType].filter((term) => labels.some((label) => label.includes(term))).length;
      if (score > bestScore) {
        bestScore = score;
        headerRow = rowNumber;
      }
    }

    const lines: string[] = [];
    for (let rowNumber = headerRow; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values: string[] = [];
      for (let column = 1; column <= worksheet.actualColumnCount; column += 1) {
        values.push(row.getCell(column).text.replace(/[\t\r\n]+/g, " ").trim());
      }
      if (values.some(Boolean)) lines.push(values.join("\t"));
    }
    return { success: true as const, text: lines.join("\n"), fileName: file.name, sheetName: worksheet.name };
  } catch (error) {
    return mutationFailure("imports.file.parse", error, "Não foi possível ler a planilha. Verifique se o arquivo não está corrompido ou protegido por senha.");
  }
}

const optionalText = z.preprocess(
  (value) => (value === null || value === undefined ? "" : String(value).trim()),
  z.string()
);

const nonNegativeNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? 0 : Number(value)),
  z.number().finite().nonnegative("O valor não pode ser negativo.")
);

const clientImportSchema = z.object({
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2, "Nome obrigatório.")),
  cpfCnpj: z.preprocess((v) => String(v ?? "").replace(/\D/g, ""), z.string().refine(
    (v) => !v || v.length === 11 || v.length === 14,
    "CPF/CNPJ deve ter 11 ou 14 dígitos."
  )),
  socialName: optionalText,
  fancyName: optionalText,
  email: optionalText.refine((v) => !v || z.email().safeParse(v).success, "E-mail inválido."),
  phone: optionalText,
  notes: optionalText,
});

const serviceImportSchema = z.object({
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2, "Nome obrigatório.")),
  description: optionalText,
  category: optionalText,
  maintenanceType: optionalText,
  billingUnit: optionalText,
  estimatedHours: nonNegativeNumber,
  defaultPrice: nonNegativeNumber,
});

const productImportSchema = z.object({
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2, "Nome obrigatório.")),
  code: optionalText,
  costPrice: nonNegativeNumber,
  salePrice: nonNegativeNumber,
  stockQuantity: nonNegativeNumber,
  minStock: nonNegativeNumber,
  unit: z.preprocess((v) => String(v || "UN").trim().toUpperCase(), z.string().min(1).max(12)),
  estoque: optionalText,
  tipoEstoque: optionalText,
});

function schemaFor(type: ImportType) {
  if (type === "clientes") return clientImportSchema;
  if (type === "servicos") return serviceImportSchema;
  return productImportSchema;
}

function entityFor(type: ImportType) {
  return type === "clientes" ? "CLIENTE" : type === "servicos" ? "SERVICO" : "PRODUTO";
}

function rowKey(type: ImportType, row: ImportRecord) {
  if (type === "clientes") return clientDocument(row);
  if (type === "materiais" && row.code) return `code:${String(row.code).toLocaleLowerCase("pt-BR")}`;
  return `name:${String(row.name).toLocaleLowerCase("pt-BR")}`;
}

function clientDocument(row: ImportRecord) {
  const document = String(row.cpfCnpj || "").replace(/\D/g, "");
  if (document.length === 11 || document.length === 14) return document;
  const identity = String(row.name || row.socialName || row.phone || "cliente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `IMPORTADO-${identity || "sem-documento"}`;
}

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  return error instanceof Error ? error.message : "Erro desconhecido ao processar a linha.";
}

async function authorize(type: ImportType) {
  return requirePermission(type === "clientes" ? "clients.write" : "estoque.write");
}

/** Analisa a planilha sem escrever no banco. */
export async function previewImportAction(type: ImportType, rows: ImportRecord[]) {
  try {
    await authorize(type);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false as const, error: "Nenhuma linha encontrada." };
    }
    if (rows.length > 5000) {
      return { success: false as const, error: "O limite por lote é de 5.000 linhas." };
    }

    const validRows: ImportRecord[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    const seen = new Set<string>();
    let duplicates = 0;

    rows.forEach((row, index) => {
      const parsed = schemaFor(type).safeParse(row);
      if (!parsed.success) {
        errors.push({ row: index + 2, error: errorMessage(parsed.error) });
        return;
      }
      const normalized = parsed.data as ImportRecord;
      const key = rowKey(type, normalized);
      if (seen.has(key)) {
        duplicates += 1;
        errors.push({ row: index + 2, error: "Registro repetido dentro da própria planilha." });
        return;
      }
      seen.add(key);
      validRows.push(normalized);
    });

    let existing = 0;
    if (type === "clientes") {
      existing = await prisma.client.count({ where: { cpfCnpj: { in: validRows.map(clientDocument) } } });
    } else if (type === "servicos") {
      const names = validRows.map((r) => String(r.name));
      existing = await prisma.service.count({ where: { OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) } });
    } else {
      const names = validRows.map((r) => String(r.name));
      const codes = validRows.map((r) => String(r.code || "")).filter(Boolean);
      existing = await prisma.product.count({ where: { OR: [{ code: { in: codes } }, ...names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } }))] } });
    }

    return {
      success: true as const,
      preview: {
        total: rows.length,
        valid: validRows.length,
        newRows: Math.max(0, validRows.length - existing),
        updates: existing,
        duplicates,
        errors: errors.length,
        issues: errors.slice(0, 50),
      },
    };
  } catch (error) {
    return mutationFailure("imports.preview", error, "Não foi possível validar a planilha.");
  }
}

async function nextProductCodeSeed() {
  const products = await prisma.product.findMany({ select: { code: true } });
  return products.reduce((next, product) => {
    const match = /^P-(\d+)$/.exec(product.code);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

async function importRows(type: ImportType, rows: ImportRecord[]) {
  const session = await authorize(type);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Nenhuma linha encontrada.");
  if (rows.length > 5000) throw new Error("O limite por lote é de 5.000 linhas.");

  const batch = await prisma.importBatch.create({
    data: { type, totalRows: rows.length, createdById: session.userId },
  });
  const summary: ImportSummary = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: 0 };
  const issues: Array<{ row: number; error: string }> = [];
  const seen = new Set<string>();
  let productCode = type === "materiais" ? await nextProductCodeSeed() : 0;

  for (let index = 0; index < rows.length; index += 1) {
    const source = rows[index];
    const rowNumber = index + 2;
    let status: RowStatus = "ERRO";
    try {
      const normalized = schemaFor(type).parse(source) as ImportRecord;
      const key = rowKey(type, normalized);
      if (seen.has(key)) {
        status = "IGNORADO";
        summary.skipped += 1;
        await prisma.importRow.create({ data: { batchId: batch.id, rowNumber, status, entityType: entityFor(type), sourceJson: JSON.stringify(source), normalizedJson: JSON.stringify(normalized), error: "Duplicado no mesmo lote." } });
        continue;
      }
      seen.add(key);

      status = await prisma.$transaction(async (tx) => {
        let entityId = "";
        let transactionStatus: RowStatus;

        if (type === "clientes") {
          const cpfCnpj = clientDocument(normalized);
          const existing = await tx.client.findUnique({ where: { cpfCnpj }, select: { id: true } });
          const email = String(normalized.email || `sem-email+${cpfCnpj}@importado.local`);
          const phone = String(normalized.phone || "Não informado");
          const client = await tx.client.upsert({
            where: { cpfCnpj },
            update: { name: String(normalized.name), socialName: String(normalized.socialName || normalized.name), fancyName: String(normalized.fancyName || normalized.name), email, phone, notes: String(normalized.notes || "Importado por planilha.") },
            create: { cpfCnpj, name: String(normalized.name), socialName: String(normalized.socialName || normalized.name), fancyName: String(normalized.fancyName || normalized.name), email, phone, notes: String(normalized.notes || "Importado por planilha.") },
          });
          entityId = client.id;
          transactionStatus = existing ? "ATUALIZADO" : "CRIADO";
        } else if (type === "servicos") {
          const existing = await tx.service.findFirst({ where: { name: { equals: String(normalized.name), mode: "insensitive" } } });
          const service = existing
            ? await tx.service.update({ where: { id: existing.id }, data: { name: String(normalized.name), description: String(normalized.description || ""), category: String(normalized.category || "") || null, maintenanceType: String(normalized.maintenanceType || "") || null, billingUnit: String(normalized.billingUnit || "Serviço"), estimatedHours: Number(normalized.estimatedHours) || null, defaultPrice: Number(normalized.defaultPrice) } })
            : await tx.service.create({ data: { name: String(normalized.name), description: String(normalized.description || ""), category: String(normalized.category || "") || null, maintenanceType: String(normalized.maintenanceType || "") || null, billingUnit: String(normalized.billingUnit || "Serviço"), estimatedHours: Number(normalized.estimatedHours) || null, defaultPrice: Number(normalized.defaultPrice) } });
          entityId = service.id;
          transactionStatus = existing ? "ATUALIZADO" : "CRIADO";
        } else {
          const code = String(normalized.code || "");
          const existing = await tx.product.findFirst({ where: { OR: [...(code ? [{ code }] : []), { name: { equals: String(normalized.name), mode: "insensitive" } }] } });
          const generatedCode = code || `P-${String(productCode).padStart(4, "0")}`;
          
          const estoqueTypeUpper = String(normalized.estoque || normalized.tipoEstoque || source.estoque || source.tipoEstoque || "").toUpperCase();
          const isFuturo = estoqueTypeUpper.includes("FUTURO") || estoqueTypeUpper.includes("COMPRAR");
          const rawQty = Number(normalized.stockQuantity) || 0;
          const finalPresent = isFuturo ? 0 : rawQty;
          const finalFuture = isFuturo ? (rawQty > 0 ? rawQty : 1) : 0;

          const product = existing
            ? await tx.product.update({
                where: { id: existing.id },
                data: {
                  name: String(normalized.name),
                  costPrice: Number(normalized.costPrice),
                  salePrice: Number(normalized.salePrice),
                  stockQuantity: isFuturo ? existing.stockQuantity : finalPresent,
                  futureStock: isFuturo ? finalFuture : existing.futureStock,
                  minStock: Number(normalized.minStock),
                  unit: String(normalized.unit)
                }
              })
            : await tx.product.create({
                data: {
                  code: generatedCode,
                  name: String(normalized.name),
                  costPrice: Number(normalized.costPrice),
                  salePrice: Number(normalized.salePrice),
                  stockQuantity: finalPresent,
                  futureStock: finalFuture,
                  minStock: Number(normalized.minStock),
                  unit: String(normalized.unit)
                }
              });
          if (!existing && !code) productCode += 1;
          entityId = product.id;
          transactionStatus = existing ? "ATUALIZADO" : "CRIADO";
        }

        await tx.importRow.create({ data: { batchId: batch.id, rowNumber, status: transactionStatus, entityType: entityFor(type), entityId, sourceJson: JSON.stringify(source), normalizedJson: JSON.stringify(normalized) } });
        return transactionStatus;
      });

      summary[status === "CRIADO" ? "created" : "updated"] += 1;
    } catch (error) {
      const message = errorMessage(error);
      summary.errors += 1;
      issues.push({ row: rowNumber, error: message });
      await prisma.importRow.create({ data: { batchId: batch.id, rowNumber, status: "ERRO", entityType: entityFor(type), sourceJson: JSON.stringify(source), error: message } });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: summary.errors || summary.skipped ? "CONCLUIDO_COM_ERROS" : "CONCLUIDO",
      createdRows: summary.created,
      updatedRows: summary.updated,
      skippedRows: summary.skipped,
      errorRows: summary.errors,
      finishedAt: new Date(),
    },
  });

  if (type === "clientes") revalidatePath("/clientes");
  if (type === "servicos") revalidatePath("/servicos");
  if (type === "materiais") revalidatePath("/estoque");
  revalidatePath("/teia");
  return { success: true as const, count: summary.created + summary.updated, batchId: batch.id, summary, issues: issues.slice(0, 50) };
}

export async function importClientsAction(clients: ImportRecord[]) {
  try { return await importRows("clientes", clients); }
  catch (error) { return mutationFailure("imports.clients.execute", error, "Não foi possível importar os clientes."); }
}

export async function importServicesAction(services: ImportRecord[]) {
  try { return await importRows("servicos", services); }
  catch (error) { return mutationFailure("imports.services.execute", error, "Não foi possível importar os serviços."); }
}

export async function importProductsAction(products: ImportRecord[]) {
  try { return await importRows("materiais", products); }
  catch (error) { return mutationFailure("imports.products.execute", error, "Não foi possível importar os produtos."); }
}

export async function getImportHistoryAction() {
  try {
    await requirePermission("admin.all");
    const batches = await prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { createdBy: { select: { name: true } } },
    });
    return { success: true as const, batches: batches.map((batch) => ({ ...batch, createdAt: batch.createdAt.toISOString(), finishedAt: batch.finishedAt?.toISOString() || null })) };
  } catch (error) {
    return { ...mutationFailure("imports.history.list", error, "Não foi possível carregar o histórico de importações."), batches: [] };
  }
}
