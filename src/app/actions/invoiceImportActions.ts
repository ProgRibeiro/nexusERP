"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { mutationFailure } from "@/lib/actionErrors";
import { calculateDueDate, PAYMENT_TERM_OPTIONS } from "@/lib/paymentTerms";

type ImportState = "PRONTA" | "DUPLICADA" | "ERRO";

export interface IssuedInvoiceImportRow {
  rowNumber: number;
  invoiceCode: string;
  clientDocument: string;
  clientName: string;
  issueDate: string;
  totalValue: number;
  taxValue: number;
  invoiceStatus: string;
  paymentTerms: string;
  dueDate: string;
  paymentStatus: string;
  paymentDate: string;
  paymentMethod: string;
  serviceOrderCode: string;
  notes: string;
  matchedClientName?: string;
  state: ImportState;
  error?: string;
}

export interface IssuedInvoiceImportPreview {
  fileName: string;
  total: number;
  ready: number;
  duplicates: number;
  errors: number;
  rows: IssuedInvoiceImportRow[];
}

interface ParsedTable {
  rows: unknown[][];
  fileName: string;
}

const COLUMN_ALIASES = {
  invoiceCode: ["numero nota", "numero nf", "numero nfs e", "nota fiscal", "nfs e", "nf", "nota", "codigo nota"],
  clientDocument: ["cnpj cpf", "cpf cnpj", "cnpj", "cpf", "documento tomador", "documento cliente", "documento"],
  clientName: ["razao social", "nome cliente", "nome tomador", "tomador", "cliente", "empresa"],
  issueDate: ["data emissao", "emissao", "data da nota", "data nota", "competencia"],
  totalValue: ["valor total", "valor nota", "valor nf", "total nota", "total", "valor"],
  taxValue: ["valor imposto", "impostos", "imposto", "iss retido", "valor iss", "iss"],
  invoiceStatus: ["status nota", "situacao nota", "status nf", "situacao nf", "situacao"],
  paymentTerms: ["condicao pagamento", "regra pagamento", "prazo pagamento", "condicao", "prazo"],
  dueDate: ["data vencimento", "vencimento", "vence em"],
  paymentStatus: ["status pagamento", "situacao pagamento", "status recebimento", "pago"],
  paymentDate: ["data pagamento", "data recebimento", "recebimento", "pagamento"],
  paymentMethod: ["forma pagamento", "meio pagamento", "forma recebimento", "meio recebimento"],
  serviceOrderCode: ["ordem servico", "numero os", "codigo os", "os"],
  notes: ["observacoes", "observacao", "descricao servico", "descricao", "historico"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDocument(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,(?=\d{3}(?:\D|$))/g, "");
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toIsoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 25000 && value < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const br = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(raw);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    const date = new Date(year, Number(br[2]) - 1, Number(br[1]), 12);
    if (date.getFullYear() === year && date.getMonth() === Number(br[2]) - 1 && date.getDate() === Number(br[1])) {
      return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
    return "";
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
    if (date.getFullYear() === Number(iso[1]) && date.getMonth() === Number(iso[2]) - 1 && date.getDate() === Number(iso[3])) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }
  }
  return "";
}

function asLocalDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

function parseDelimited(content: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function readTable(file: File): Promise<ParsedTable> {
  if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "tsv", "xlsx"].includes(extension)) {
    throw new Error("Formato permitido: CSV, TSV ou XLSX.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "csv" || extension === "tsv") {
    const content = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const delimiter = extension === "tsv" ? "\t" : ((content.match(/;/g)?.length || 0) >= (content.match(/,/g)?.length || 0) ? ";" : ",");
    return { rows: parseDelimited(content, delimiter), fileName: file.name };
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const worksheet = workbook.worksheets.find((sheet) => normalizeText(sheet.name).match(/nota|fiscal|fatur/)) || workbook.worksheets[0];
  if (!worksheet) throw new Error("A planilha não possui abas com dados.");
  if (worksheet.actualRowCount > 5001) throw new Error("A planilha excede o limite de 5.000 registros.");
  if (worksheet.actualColumnCount > 100) throw new Error("A planilha excede o limite de 100 colunas.");
  const rows: unknown[][] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = Array.from({ length: worksheet.actualColumnCount }, (_, index) => {
      const cell = row.getCell(index + 1);
      return cell.value instanceof Date ? cell.value : cell.text.trim();
    });
    if (values.some((value) => String(value ?? "").trim())) rows.push(values);
  }
  return { rows, fileName: file.name };
}

function locateHeader(rows: unknown[][]) {
  let bestIndex = -1;
  let bestMap: Partial<Record<ColumnKey, number>> = {};
  let bestScore = 0;
  rows.slice(0, 20).forEach((row, rowIndex) => {
    const map: Partial<Record<ColumnKey, number>> = {};
    row.forEach((value, columnIndex) => {
      const label = normalizeText(value);
      (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
        if (map[key] === undefined && COLUMN_ALIASES[key].some((alias) => {
          if (label === alias) return true;
          const aliasTokens = alias.split(" ");
          if (aliasTokens.length < 2) return false;
          const labelTokens = new Set(label.split(" ").filter((token) => !["a", "as", "o", "os", "da", "das", "de", "do", "dos"].includes(token)));
          return aliasTokens.every((token) => labelTokens.has(token));
        })) {
          map[key] = columnIndex;
        }
      });
    });
    const score = Object.keys(map).length;
    if (score > bestScore) {
      bestIndex = rowIndex;
      bestMap = map;
      bestScore = score;
    }
  });
  if (bestIndex < 0 || bestMap.invoiceCode === undefined || bestMap.issueDate === undefined || bestMap.totalValue === undefined) {
    throw new Error("Não encontrei as colunas obrigatórias: número da nota, data de emissão e valor total.");
  }
  if (bestMap.clientDocument === undefined && bestMap.clientName === undefined) {
    throw new Error("Inclua uma coluna de CNPJ/CPF ou nome do cliente.");
  }
  return { headerIndex: bestIndex, columns: bestMap };
}

function cell(row: unknown[], columns: Partial<Record<ColumnKey, number>>, key: ColumnKey) {
  const index = columns[key];
  return index === undefined ? "" : row[index];
}

function normalizePaymentTerms(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "LIQUIDO_30";
  const explicit = PAYMENT_TERM_OPTIONS.find((option) => normalizeText(option.value) === text || normalizeText(option.label) === text);
  if (explicit) return explicit.value;
  if (text.includes("vista") || text.includes("imediato")) return "A_VISTA";
  if (text.includes("hering")) return "HERING_60";
  const days = text.match(/\d+/)?.[0];
  return days && ["15", "21", "30", "45", "60"].includes(days) ? `LIQUIDO_${days}` : "LIQUIDO_30";
}

function normalizeInvoiceStatus(value: unknown) {
  const text = normalizeText(value);
  if (text.includes("cancel")) return "CANCELADA";
  if (text.includes("substit")) return "SUBSTITUIDA";
  if (text.includes("enviad")) return "ENVIADA";
  return "EMITIDA";
}

function isPaid(value: unknown, paymentDate: string) {
  const text = normalizeText(value);
  return Boolean(paymentDate) || text === "pago" || text === "recebido" || text === "quitado" || text === "sim" || text === "1";
}

async function resolveImportRows(table: ParsedTable): Promise<IssuedInvoiceImportPreview> {
  const { headerIndex, columns } = locateHeader(table.rows);
  const sourceRows = table.rows.slice(headerIndex + 1).filter((row) => row.some((value) => String(value ?? "").trim()));
  if (!sourceRows.length) throw new Error("A planilha não possui notas abaixo do cabeçalho.");
  if (sourceRows.length > 5000) throw new Error("O limite por lote é de 5.000 notas.");

  const clients = await prisma.client.findMany({ select: { id: true, name: true, socialName: true, fancyName: true, cpfCnpj: true } });
  const invoices = await prisma.invoice.findMany({ select: { code: true } });
  const serviceOrders = await prisma.serviceOrder.findMany({ select: { id: true, code: true, clientId: true } });
  const clientByDocument = new Map(clients.filter((client) => client.cpfCnpj).map((client) => [normalizeDocument(client.cpfCnpj), client]));
  const clientByName = new Map<string, typeof clients[number]>();
  clients.forEach((client) => [client.name, client.socialName, client.fancyName].filter(Boolean).forEach((name) => clientByName.set(normalizeText(name), client)));
  const existingCodes = new Set(invoices.map((invoice) => normalizeText(invoice.code)));
  const orderByCode = new Map(serviceOrders.map((order) => [normalizeText(order.code), order]));
  const seenCodes = new Set<string>();

  const rows = sourceRows.map((source, index): IssuedInvoiceImportRow => {
    const rowNumber = headerIndex + index + 2;
    const invoiceCode = String(cell(source, columns, "invoiceCode") ?? "").trim();
    const clientDocument = normalizeDocument(cell(source, columns, "clientDocument"));
    const clientName = String(cell(source, columns, "clientName") ?? "").trim();
    const issueDate = toIsoDate(cell(source, columns, "issueDate"));
    const totalValue = parseMoney(cell(source, columns, "totalValue"));
    const taxValue = parseMoney(cell(source, columns, "taxValue"));
    const paymentDate = toIsoDate(cell(source, columns, "paymentDate"));
    const dueDate = toIsoDate(cell(source, columns, "dueDate"));
    const serviceOrderCode = String(cell(source, columns, "serviceOrderCode") ?? "").trim();
    const matchedClient = (clientDocument ? clientByDocument.get(clientDocument) : undefined) || clientByName.get(normalizeText(clientName));
    const matchedOrder = serviceOrderCode ? orderByCode.get(normalizeText(serviceOrderCode)) : undefined;
    const codeKey = normalizeText(invoiceCode);
    const errors: string[] = [];
    if (!invoiceCode) errors.push("Número da nota não informado.");
    if (!issueDate) errors.push("Data de emissão inválida.");
    if (!Number.isFinite(totalValue) || totalValue <= 0) errors.push("Valor total inválido.");
    if (!matchedClient) errors.push("Cliente não encontrado pelo CNPJ/CPF ou nome.");
    if (serviceOrderCode && !matchedOrder) errors.push(`OS ${serviceOrderCode} não encontrada.`);
    if (matchedOrder && matchedClient && matchedOrder.clientId !== matchedClient.id) errors.push("A OS pertence a outro cliente.");
    const duplicate = Boolean(codeKey && (existingCodes.has(codeKey) || seenCodes.has(codeKey)));
    if (codeKey) seenCodes.add(codeKey);
    return {
      rowNumber,
      invoiceCode,
      clientDocument,
      clientName,
      issueDate,
      totalValue: Number.isFinite(totalValue) ? totalValue : 0,
      taxValue: Number.isFinite(taxValue) && taxValue >= 0 ? taxValue : 0,
      invoiceStatus: normalizeInvoiceStatus(cell(source, columns, "invoiceStatus")),
      paymentTerms: normalizePaymentTerms(cell(source, columns, "paymentTerms")),
      dueDate,
      paymentStatus: isPaid(cell(source, columns, "paymentStatus"), paymentDate) ? "PAGO" : "ABERTO",
      paymentDate,
      paymentMethod: String(cell(source, columns, "paymentMethod") ?? "").trim().toUpperCase() || "OUTROS",
      serviceOrderCode,
      notes: String(cell(source, columns, "notes") ?? "").trim(),
      matchedClientName: matchedClient?.name,
      state: errors.length ? "ERRO" : duplicate ? "DUPLICADA" : "PRONTA",
      error: errors.length ? errors.join(" ") : duplicate ? "Nota já cadastrada ou repetida na planilha." : undefined,
    };
  });

  return {
    fileName: table.fileName,
    total: rows.length,
    ready: rows.filter((row) => row.state === "PRONTA").length,
    duplicates: rows.filter((row) => row.state === "DUPLICADA").length,
    errors: rows.filter((row) => row.state === "ERRO").length,
    rows,
  };
}

export async function previewIssuedInvoicesFileAction(formData: FormData) {
  try {
    await requirePermission("faturamento.write");
    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false as const, error: "Selecione a planilha de notas." };
    const preview = await resolveImportRows(await readTable(file));
    return { success: true as const, preview };
  } catch (error) {
    return mutationFailure("invoices.import.preview", error, "Não foi possível analisar a planilha de notas.");
  }
}

export async function importIssuedInvoicesAction(fileName: string, submittedRows: IssuedInvoiceImportRow[]) {
  try {
    const session = await requirePermission("faturamento.write");
    if (!Array.isArray(submittedRows) || !submittedRows.length) throw new Error("Nenhuma nota pronta para importar.");
    if (submittedRows.length > 5000) throw new Error("O limite por lote é de 5.000 notas.");
    const clients = await prisma.client.findMany({ select: { id: true, name: true, socialName: true, fancyName: true, cpfCnpj: true } });
    const serviceOrders = await prisma.serviceOrder.findMany({ select: { id: true, code: true, clientId: true, status: true } });
    const clientByDocument = new Map(clients.filter((client) => client.cpfCnpj).map((client) => [normalizeDocument(client.cpfCnpj), client]));
    const clientByName = new Map<string, typeof clients[number]>();
    clients.forEach((client) => [client.name, client.socialName, client.fancyName].filter(Boolean).forEach((name) => clientByName.set(normalizeText(name), client)));
    const orderByCode = new Map(serviceOrders.map((order) => [normalizeText(order.code), order]));
    const batch = await prisma.importBatch.create({
      data: { type: "notas_fiscais", fileName: fileName.slice(0, 255), totalRows: submittedRows.length, createdById: session.userId },
    });
    const summary = { total: submittedRows.length, created: 0, skipped: 0, errors: 0 };
    const issues: Array<{ row: number; error: string }> = [];
    const seen = new Set<string>();

    for (const source of submittedRows) {
      const rowNumber = Number(source.rowNumber) || summary.created + summary.skipped + summary.errors + 2;
      try {
        const invoiceCode = String(source.invoiceCode || "").trim();
        const codeKey = normalizeText(invoiceCode);
        const client = (source.clientDocument ? clientByDocument.get(normalizeDocument(source.clientDocument)) : undefined)
          || clientByName.get(normalizeText(source.clientName || source.matchedClientName));
        const order = source.serviceOrderCode ? orderByCode.get(normalizeText(source.serviceOrderCode)) : undefined;
        const issueDate = toIsoDate(source.issueDate);
        const totalValue = Number(source.totalValue);
        const taxValue = Number(source.taxValue) || 0;
        if (!invoiceCode) throw new Error("Número da nota não informado.");
        if (!client) throw new Error("Cliente não encontrado.");
        if (!issueDate) throw new Error("Data de emissão inválida.");
        if (!Number.isFinite(totalValue) || totalValue <= 0) throw new Error("Valor total inválido.");
        if (order && order.clientId !== client.id) throw new Error("A OS pertence a outro cliente.");
        if (source.serviceOrderCode && !order) throw new Error(`OS ${source.serviceOrderCode} não encontrada.`);
        const existing = await prisma.invoice.findFirst({ where: { code: { equals: invoiceCode, mode: "insensitive" } }, select: { id: true } });
        if (existing || seen.has(codeKey)) {
          summary.skipped += 1;
          seen.add(codeKey);
          await prisma.importRow.create({ data: { batchId: batch.id, rowNumber, status: "IGNORADO", entityType: "NOTA_FISCAL", entityId: existing?.id, sourceJson: JSON.stringify(source), normalizedJson: JSON.stringify({ invoiceCode }), error: "Nota já cadastrada ou repetida no lote." } });
          continue;
        }
        seen.add(codeKey);
        const issueDateValue = asLocalDate(issueDate);
        const paymentTerms = normalizePaymentTerms(source.paymentTerms);
        const paymentDate = toIsoDate(source.paymentDate);
        const paid = isPaid(source.paymentStatus, paymentDate);
        const dueDateIso = toIsoDate(source.dueDate);
        const dueDate = dueDateIso ? asLocalDate(dueDateIso) : calculateDueDate(issueDateValue, paymentTerms, 1);
        const invoiceStatus = normalizeInvoiceStatus(source.invoiceStatus);
        const receivableStatus = invoiceStatus === "CANCELADA" || invoiceStatus === "SUBSTITUIDA"
          ? "CANCELADO"
          : paid ? "PAGO" : dueDate < new Date() ? "VENCIDO" : "ABERTO";

        const created = await prisma.$transaction(async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              code: invoiceCode,
              clientId: client.id,
              serviceOrderId: order?.id || null,
              issueDate: issueDateValue,
              value: totalValue,
              taxValue: Math.max(0, taxValue),
              status: invoiceStatus,
              paymentTerms,
              notes: source.notes?.trim() || "Nota já emitida, importada da planilha de controle.",
            },
          });
          const receivable = await tx.accountsReceivable.create({
            data: {
              clientId: client.id,
              serviceOrderId: order?.id || null,
              invoiceId: invoice.id,
              totalValue,
              receivedValue: paid ? totalValue : 0,
              pendingValue: paid ? 0 : totalValue,
              issueDate: issueDateValue,
              dueDate,
              paymentDate: paid ? asLocalDate(paymentDate || dueDateIso || issueDate) : null,
              paymentMethod: source.paymentMethod?.trim().toUpperCase() || "OUTROS",
              status: receivableStatus,
              category: "RECEITA_SERVICO",
              costCenter: "GERAL",
              notes: `NF ${invoiceCode} importada da planilha. ${source.notes || ""}`.trim(),
            },
          });
          if (paid && receivableStatus === "PAGO") {
            await tx.financialTransaction.create({
              data: {
                type: "RECEITA",
                value: totalValue,
                date: asLocalDate(paymentDate || dueDateIso || issueDate),
                category: "RECEITA_SERVICO",
                costCenter: "GERAL",
                accountsReceivableId: receivable.id,
                description: `Recebimento da NF ${invoiceCode} importado da planilha.`,
              },
            });
          }
          if (order) {
            await tx.serviceOrder.update({
              where: { id: order.id },
              data: { invoiceId: invoice.id, faturamentoStatus: invoiceStatus === "ENVIADA" ? "NF_ENVIADA" : "NF_EMITIDA", ...(order.status === "FATURAMENTO" ? { status: "FATURADA" } : {}) },
            });
            if (order.status === "FATURAMENTO") {
              await tx.serviceOrderStatusHistory.create({
                data: { serviceOrderId: order.id, oldStatus: order.status, newStatus: "FATURADA", changedById: session.userId, justification: `NF ${invoiceCode} já emitida e importada por planilha.` },
              });
            }
          }
          await tx.importRow.create({
            data: { batchId: batch.id, rowNumber, status: "CRIADO", entityType: "NOTA_FISCAL", entityId: invoice.id, sourceJson: JSON.stringify(source), normalizedJson: JSON.stringify({ invoiceCode, clientId: client.id, serviceOrderId: order?.id || null, issueDate, totalValue, dueDate: dueDate.toISOString(), paid }) },
          });
          return invoice;
        });
        summary.created += 1;
        void created;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido ao importar a nota.";
        summary.errors += 1;
        issues.push({ row: rowNumber, error: message });
        await prisma.importRow.create({ data: { batchId: batch.id, rowNumber, status: "ERRO", entityType: "NOTA_FISCAL", sourceJson: JSON.stringify(source), error: message } });
      }
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: summary.errors || summary.skipped ? "CONCLUIDO_COM_ERROS" : "CONCLUIDO", createdRows: summary.created, skippedRows: summary.skipped, errorRows: summary.errors, finishedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: session.userId, action: "CRIACAO", entity: "ImportacaoNotasFiscais", entityId: batch.id, changesJson: JSON.stringify({ fileName, ...summary }) },
    });
    revalidatePath("/faturamento");
    revalidatePath("/financeiro");
    revalidatePath("/ordens-servico");
    revalidatePath("/teia");
    revalidatePath("/");
    return { success: true as const, batchId: batch.id, summary, issues: issues.slice(0, 50) };
  } catch (error) {
    return mutationFailure("invoices.import.execute", error, "Não foi possível importar as notas fiscais.");
  }
}
