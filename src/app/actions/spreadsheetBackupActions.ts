"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function generateFullSpreadsheetBackupBuffer() {
  await requirePermission("admin.all");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERP O Prestador";
  workbook.lastModifiedBy = "Sistema Automático";
  workbook.created = new Date();

  // Estilo de Cabeçalho Padrão
  const applyHeaderStyle = (sheet: ExcelJS.Worksheet, headers: string[]) => {
    const row = sheet.addRow(headers);
    row.font = { bold: true, color: { argb: "FFFFFF" }, size: 10 };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "155EEF" }, // Azul O Prestador
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 24;
  };

  // 1. ABA: ORDENS DE SERVIÇO (OS)
  const osSheet = workbook.addWorksheet("Ordens de Serviço");
  const osHeaders = [
    "ID OS",
    "Código",
    "Cliente",
    "CNPJ/CPF",
    "Descrição do Serviço",
    "Pedido de Compra",
    "Status Operacional",
    "Prioridade",
    "Tipo de Execução",
    "Mês Competência",
    "Data Agendada",
    "Data Conclusão",
    "Solicitante / Analista",
    "Observações",
  ];
  applyHeaderStyle(osSheet, osHeaders);

  const serviceOrders = await prisma.serviceOrder.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  for (const os of serviceOrders) {
    osSheet.addRow([
      os.id,
      os.code,
      os.client?.name || "N/A",
      os.client?.cpfCnpj || "N/A",
      os.problemReported || "N/A",
      os.purchaseOrder || "",
      os.status,
      os.priority,
      os.operationKind || "EQUIPE_PROPRIA",
      os.referenceMonth || "",
      os.scheduledDate ? os.scheduledDate.toISOString().slice(0, 10) : "",
      os.completedAt ? os.completedAt.toISOString().slice(0, 10) : "",
      os.requesterName || "",
      os.notes || "",
    ]);
  }

  // 2. ABA: ORÇAMENTOS
  const quoteSheet = workbook.addWorksheet("Orçamentos e Propostas");
  const quoteHeaders = [
    "ID Orçamento",
    "Número da Proposta",
    "Cliente",
    "CNPJ/CPF",
    "Status",
    "Data de Criação",
    "Validade",
    "Subtotal (R$)",
    "Desconto (R$)",
    "Valor Total (R$)",
    "Imposto (%)",
    "Imposto (R$)",
  ];
  applyHeaderStyle(quoteSheet, quoteHeaders);

  const quotes = await prisma.quote.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  for (const q of quotes) {
    quoteSheet.addRow([
      q.id,
      q.code,
      q.client?.name || "N/A",
      q.client?.cpfCnpj || "N/A",
      q.status,
      q.createdAt.toISOString().slice(0, 10),
      q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "",
      Number(q.subtotal || 0),
      Number(q.discount || 0),
      Number(q.total || 0),
      Number(q.taxPercentage || 0),
      Number(q.tax || 0),
    ]);
  }

  // 3. ABA: FATURAMENTO E PENDENTES DE PAGAMENTO (CONTAS A RECEBER)
  const finSheet = workbook.addWorksheet("Faturamento & Contas a Receber");
  const finHeaders = [
    "ID Título",
    "Título / Ref OS",
    "Cliente",
    "CNPJ/CPF",
    "Valor Total (R$)",
    "Valor Recebido (R$)",
    "Valor Pendente (R$)",
    "Status Pagamento",
    "Data de Emissão",
    "Previsão de Pagamento (Vencimento)",
    "Data do Pagamento",
    "Forma de Pagamento",
    "Categoria",
    "Observações",
  ];
  applyHeaderStyle(finSheet, finHeaders);

  const receivables = await prisma.accountsReceivable.findMany({
    include: { client: true, serviceOrder: true, invoice: true },
    orderBy: { dueDate: "asc" },
  });

  for (const fin of receivables) {
    finSheet.addRow([
      fin.id,
      fin.invoice?.code ? fin.invoice.code : `OS ${fin.serviceOrder?.code || fin.id}`,
      fin.client?.name || "N/A",
      fin.client?.cpfCnpj || "N/A",
      Number(fin.totalValue || 0),
      Number(fin.receivedValue || 0),
      Number(fin.pendingValue || 0),
      fin.status,
      fin.issueDate ? fin.issueDate.toISOString().slice(0, 10) : "",
      fin.dueDate ? fin.dueDate.toISOString().slice(0, 10) : "",
      fin.paymentDate ? fin.paymentDate.toISOString().slice(0, 10) : "",
      fin.paymentMethod || "",
      fin.category || "RECEITA_SERVICO",
      fin.notes || "",
    ]);
  }

  // Auto-ajustar largura das colunas para legibilidade perfeita
  [osSheet, quoteSheet, finSheet].forEach((sheet) => {
    sheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = Math.min(columnLength, 50);
        }
      });
      column.width = maxLength + 3;
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
