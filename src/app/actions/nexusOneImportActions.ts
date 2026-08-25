"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface NexusOneRow {
  id: string;
  cliente: string;
  descricaoServico: string;
  pedidoCompra: string;
  cnae: string;
  dataAprovacao: string;
  valorAprovado: string;
  dataAgendamento: string;
  dataServico: string;
  tecnico: string;
  analista: string;
  prioridade: string;
  dataConclusao: string;
  status: string;
  numeroNf: string;
  emissaoNf: string;
  valorNf: string;
  previsaoPagamento: string;
  statusPagamento: string;
  dataPagamento: string;
  valorPago: string;
  formaPagamento: string;
  competencia: string;
  diasSemNf: string;
  diasAtrasoPag: string;
  sla: string;
  pdfNf: string;
  comprovantePag: string;
  observacoes: string;
  atualizadoEm: string;
  atualizadoPor: string;
  cnpjServico: string;
  tipoExecucao: string;
}

export interface NexusOneImportResult {
  success: boolean;
  totalRows: number;
  clientsCreated: number;
  ordersCreated: number;
  ordersUpdated: number;
  financesCreated: number;
  errors: string[];
}

function parseCurrency(val: string | undefined): number {
  if (!val) return 0;
  const clean = val.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseBrazilianDate(val: string | undefined): Date | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }
  const isoDate = new Date(trimmed);
  return isNaN(isoDate.getTime()) ? null : isoDate;
}

function formatCnpj(val: string | undefined): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return val.trim();
}

export async function importNexusOneBaseAction(rows: NexusOneRow[]): Promise<NexusOneImportResult> {
  try {
    await requirePermission("os.write");
  } catch {
    return {
      success: false,
      totalRows: rows.length,
      clientsCreated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      financesCreated: 0,
      errors: ["Sem permissão para importar ordens de serviço."],
    };
  }

  let clientsCreated = 0;
  let ordersCreated = 0;
  let ordersUpdated = 0;
  let financesCreated = 0;
  const errors: string[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row.cliente && !row.cnpjServico) continue;

    try {
      const cleanCnpj = formatCnpj(row.cnpjServico);
      const clientName = row.cliente || `Cliente CNPJ ${cleanCnpj}`;

      // 1. Encontrar ou criar cliente
      let client = null;
      if (cleanCnpj) {
        client = await prisma.client.findFirst({
          where: {
            OR: [
              { cpfCnpj: cleanCnpj },
              { cpfCnpj: row.cnpjServico?.trim() },
            ],
          },
        });
      }
      if (!client && clientName) {
        client = await prisma.client.findFirst({
          where: { name: { equals: clientName, mode: "insensitive" } },
        });
      }
      if (!client) {
        client = await prisma.client.create({
          data: {
            name: clientName,
            cpfCnpj: cleanCnpj || `CNPJ-${Date.now()}-${idx}`,
            email: "",
            phone: "",
            segment: "Varejo / Manutenção",
            notes: `Criado via Importador NEXUS ONE`,
          },
        });
        clientsCreated++;
      }

      // 2. Mapeamento de Status da Ordem de Serviço
      const statusUpper = (row.status || "").toUpperCase();
      let osStatus = "CRIADA";
      if (statusUpper.includes("FATURADO")) osStatus = "FATURADA";
      else if (statusUpper.includes("AGUARDANDO FATURAMENTO") || statusUpper.includes("FINALIZADO")) osStatus = "FATURAMENTO";
      else if (statusUpper.includes("AGENDADO")) osStatus = "AGENDADA";
      else if (statusUpper.includes("EM EXECUCAO") || statusUpper.includes("EXECUÇÃO")) osStatus = "EXECUCAO";
      else if (statusUpper.includes("POR AGENDAR")) osStatus = "AGUARDANDO_AGENDAMENTO";

      // 3. Mapeamento de Prioridade
      const prioUpper = (row.prioridade || "").toUpperCase();
      let priority = "MEDIA";
      if (prioUpper.includes("URGENTE") || prioUpper.includes("ALTA")) priority = "URGENTE";
      else if (prioUpper.includes("BAIXA")) priority = "BAIXA";

      // 4. Mapeamento de Execução
      const execUpper = (row.tipoExecucao || "").toUpperCase();
      const operationKind = execUpper.includes("TERCEIRIZADO") ? "TERCEIRIZADO" : "EQUIPE_PROPRIA";

      const osCode = `NX-${row.id || (idx + 1)}`;
      const valorAprovado = parseCurrency(row.valorAprovado);
      const valorNf = parseCurrency(row.valorNf);
      const scheduledDate = parseBrazilianDate(row.dataAgendamento) || parseBrazilianDate(row.dataServico) || parseBrazilianDate(row.dataAprovacao);
      const completedAt = parseBrazilianDate(row.dataConclusao);

      const notesCombined = [
        row.observacoes ? `Obs: ${row.observacoes}` : null,
        row.sla ? `SLA: ${row.sla}` : null,
        row.cnae ? `CNAE: ${row.cnae}` : null,
        row.tecnico ? `Técnico: ${row.tecnico}` : null,
        row.analista ? `Analista: ${row.analista}` : null,
      ].filter(Boolean).join(" | ");

      const faturamentoStatus = osStatus === "FATURADA" ? "NF_EMITIDA" : osStatus === "FATURAMENTO" ? "AGUARDANDO_FATURAMENTO" : "AGUARDANDO_FATURAMENTO";

      // 5. Upsert Ordem de Serviço
      const existingOS = await prisma.serviceOrder.findFirst({
        where: { code: osCode },
      });

      if (existingOS) {
        await prisma.serviceOrder.update({
          where: { id: existingOS.id },
          data: {
            clientId: client.id,
            problemReported: row.descricaoServico || "Manutenção predial e civil",
            purchaseOrder: row.pedidoCompra || null,
            status: osStatus,
            faturamentoStatus,
            priority,
            operationKind,
            referenceMonth: row.competencia || null,
            scheduledDate: scheduledDate || undefined,
            completedAt: completedAt || undefined,
            notes: notesCombined || undefined,
            requesterName: row.analista || undefined,
            requesterEmail: row.atualizadoPor || undefined,
          },
        });
        ordersUpdated++;
      } else {
        await prisma.serviceOrder.create({
          data: {
            code: osCode,
            clientId: client.id,
            type: "CORRETIVA",
            serviceCategory: "GERAL",
            problemReported: row.descricaoServico || "Manutenção predial e civil",
            purchaseOrder: row.pedidoCompra || null,
            status: osStatus,
            faturamentoStatus,
            priority,
            operationKind,
            referenceMonth: row.competencia || null,
            scheduledDate: scheduledDate || new Date(),
            completedAt: completedAt || null,
            notes: notesCombined || null,
            requesterName: row.analista || null,
            requesterEmail: row.atualizadoPor || null,
          },
        });
        ordersCreated++;
      }

      // 6. Upsert Título a Receber (Financeiro)
      const amountToCharge = valorNf > 0 ? valorNf : valorAprovado;
      if (amountToCharge > 0 || row.numeroNf) {
        const osObj = await prisma.serviceOrder.findFirst({ where: { code: osCode } });
        if (osObj) {
          const nfNum = row.numeroNf || `OS-${row.id}`;
          const issueDate = parseBrazilianDate(row.emissaoNf) || parseBrazilianDate(row.dataAprovacao) || new Date();
          const dueDate = parseBrazilianDate(row.previsaoPagamento) || new Date();
          const paidAt = parseBrazilianDate(row.dataPagamento);
          const valorPago = parseCurrency(row.valorPago);
          const isPaid = (row.statusPagamento || "").toUpperCase().includes("PAGO") || valorPago > 0;
          const receivedVal = isPaid ? (valorPago > 0 ? valorPago : amountToCharge) : 0;
          const pendingVal = isPaid ? 0 : amountToCharge;

          const existingFin = await prisma.accountsReceivable.findFirst({
            where: { serviceOrderId: osObj.id },
          });

          if (existingFin) {
            await prisma.accountsReceivable.update({
              where: { id: existingFin.id },
              data: {
                totalValue: amountToCharge,
                receivedValue: receivedVal,
                pendingValue: pendingVal,
                status: isPaid ? "PAGO" : "ABERTO",
                dueDate,
                paymentDate: isPaid ? (paidAt || new Date()) : null,
                paymentMethod: row.formaPagamento || "TRANSFERENCIA",
                notes: `NF: ${nfNum} | ${row.sla || ""}`.trim(),
              },
            });
          } else {
            await prisma.accountsReceivable.create({
              data: {
                clientId: client.id,
                serviceOrderId: osObj.id,
                totalValue: amountToCharge,
                receivedValue: receivedVal,
                pendingValue: pendingVal,
                status: isPaid ? "PAGO" : "ABERTO",
                issueDate,
                dueDate,
                paymentDate: isPaid ? (paidAt || new Date()) : null,
                paymentMethod: row.formaPagamento || "TRANSFERENCIA",
                category: "RECEITA_SERVICO",
                costCenter: "GERAL",
                notes: `NF: ${nfNum} | ${row.sla || ""}`.trim(),
              },
            });
            financesCreated++;
          }
        }
      }
    } catch (err: any) {
      errors.push(`Linha ${idx + 1} (${row.cliente || "Linha sem nome"}): ${err?.message || "Erro de processamento."}`);
    }
  }

  revalidatePath("/ordens-servico");
  revalidatePath("/financeiro");
  revalidatePath("/preventivas");

  return {
    success: errors.length === 0,
    totalRows: rows.length,
    clientsCreated,
    ordersCreated,
    ordersUpdated,
    financesCreated,
    errors,
  };
}

/** Tenta importar diretamente via URL pública do Google Spreadsheets em TSV/CSV */
export async function importGoogleSpreadsheetAction(publicUrl: string): Promise<NexusOneImportResult> {
  try {
    let fetchUrl = publicUrl;
    if (publicUrl.includes("docs.google.com/spreadsheets")) {
      const docIdMatch = publicUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = publicUrl.match(/gid=([0-9]+)/);
      const docId = docIdMatch ? docIdMatch[1] : null;
      const gid = gidMatch ? gidMatch[1] : "0";
      if (docId) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=tsv&gid=${gid}`;
      }
    }

    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) {
      return {
        success: false,
        totalRows: 0,
        clientsCreated: 0,
        ordersCreated: 0,
        ordersUpdated: 0,
        financesCreated: 0,
        errors: [`Não foi possível acessar a planilha do Google (Status ${res.status}). Verifique se o link possui permissão de leitura pública.`],
      };
    }

    const text = await res.text();
    return parseTsvAndImportNexusOne(text);
  } catch (err: any) {
    return {
      success: false,
      totalRows: 0,
      clientsCreated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      financesCreated: 0,
      errors: [`Erro ao carregar planilha: ${err?.message || "Falha na conexão."}`],
    };
  }
}

/** Recebe texto bruto TSV/CSV ou colado e executa a importação */
export async function parseTsvAndImportNexusOne(rawText: string): Promise<NexusOneImportResult> {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      success: false,
      totalRows: 0,
      clientsCreated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      financesCreated: 0,
      errors: ["O texto ou arquivo fornecido está vazio."],
    };
  }

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().toLowerCase());
    if (cols.includes("id") && (cols.includes("cliente") || cols.includes("status"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headers = lines[headerIdx].split(delimiter).map((h) =>
    h.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  );

  const parsedRows: NexusOneRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const colValues = lines[i].split(delimiter).map((c) => c.trim());
    if (colValues.length < 2) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = colValues[colIdx] || "";
    });

    parsedRows.push({
      id: rowObj["id"] || String(i),
      cliente: rowObj["cliente"] || "",
      descricaoServico: rowObj["descricao do servico"] || rowObj["descricao"] || "",
      pedidoCompra: rowObj["pedido de compra"] || rowObj["pedido"] || "",
      cnae: rowObj["cnae"] || "",
      dataAprovacao: rowObj["data aprovacao"] || "",
      valorAprovado: rowObj["valor aprovado"] || "",
      dataAgendamento: rowObj["data agendamento"] || "",
      dataServico: rowObj["data do servico"] || rowObj["data servico"] || "",
      tecnico: rowObj["tecnico"] || "",
      analista: rowObj["analista"] || "",
      prioridade: rowObj["prioridade"] || "",
      dataConclusao: rowObj["data conclusao"] || "",
      status: rowObj["status"] || "",
      numeroNf: rowObj["numero nf"] || rowObj["nf"] || "",
      emissaoNf: rowObj["emissao nf"] || "",
      valorNf: rowObj["valor nf"] || "",
      previsaoPagamento: rowObj["previsao de pagamento"] || rowObj["previsao pagamento"] || "",
      statusPagamento: rowObj["status do pagamento"] || rowObj["status pagamento"] || "",
      dataPagamento: rowObj["data do pagamento"] || rowObj["data pagamento"] || "",
      valorPago: rowObj["valor pago"] || "",
      formaPagamento: rowObj["forma de pagamento"] || "",
      competencia: rowObj["competencia"] || "",
      diasSemNf: rowObj["dias sem nf"] || "",
      diasAtrasoPag: rowObj["dias atraso pag."] || rowObj["dias atraso"] || "",
      sla: rowObj["sla"] || "",
      pdfNf: rowObj["pdf nf"] || "",
      comprovantePag: rowObj["comprovante pag."] || "",
      observacoes: rowObj["observacoes"] || "",
      atualizadoEm: rowObj["atualizado em"] || "",
      atualizadoPor: rowObj["atualizado por"] || "",
      cnpjServico: rowObj["cnpj do servico"] || rowObj["cnpj"] || "",
      tipoExecucao: rowObj["tipo de execucao"] || rowObj["execucao"] || "",
    });
  }

  return importNexusOneBaseAction(parsedRows);
}

export async function getGoogleSheetSyncConfigAction() {
  const urlSetting = await prisma.setting.findUnique({ where: { key: "google_sheet_sync_url" } });
  const autoSyncSetting = await prisma.setting.findUnique({ where: { key: "google_sheet_auto_sync_enabled" } });
  const lastSyncSetting = await prisma.setting.findUnique({ where: { key: "google_sheet_last_sync" } });

  return {
    url: urlSetting?.value || "https://docs.google.com/spreadsheets/d/16HxM9rw8P_xApUgRbv53Mof6USS1VV7Uo8OQ8zgHhJU/edit?gid=1888996763#gid=1888996763",
    autoSync: autoSyncSetting?.value === "true",
    lastSync: lastSyncSetting?.value || null,
  };
}

export async function saveGoogleSheetSyncConfigAction(url: string, autoSync: boolean) {
  await prisma.setting.upsert({
    where: { key: "google_sheet_sync_url" },
    update: { value: url },
    create: { key: "google_sheet_sync_url", value: url },
  });

  await prisma.setting.upsert({
    where: { key: "google_sheet_auto_sync_enabled" },
    update: { value: autoSync ? "true" : "false" },
    create: { key: "google_sheet_auto_sync_enabled", value: autoSync ? "true" : "false" },
  });

  return { success: true };
}

export async function syncGoogleSheetBackgroundAction() {
  const config = await getGoogleSheetSyncConfigAction();
  if (!config.url) return { success: false, totalRows: 0, clientsCreated: 0, ordersCreated: 0, ordersUpdated: 0, financesCreated: 0, errors: ["Nenhuma URL configurada."] };

  const res = await importGoogleSpreadsheetAction(config.url);
  if (res.success) {
    await prisma.setting.upsert({
      where: { key: "google_sheet_last_sync" },
      update: { value: new Date().toISOString() },
      create: { key: "google_sheet_last_sync", value: new Date().toISOString() },
    });
  }
  return res;
}

