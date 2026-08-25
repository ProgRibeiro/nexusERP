"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { saveBase64Asset } from "@/lib/storage";

export interface XmlBatchMatchResult {
  xmlName: string;
  invoiceCode: string;
  issueDate?: string;
  totalValue: number;
  clientDoc?: string;
  matchedOsCode?: string;
  matchedOsId?: string;
  matchedInvoiceId?: string;
  status: "VINCULADO" | "CRIADO_NOVO" | "ERRO";
  message: string;
}

export interface XmlBatchImportSummary {
  totalProcessed: number;
  matchedCount: number;
  createdCount: number;
  errorCount: number;
  results: XmlBatchMatchResult[];
}

/**
 * Lê e analisa múltiplos arquivos XML de NFe/NFSe e vincula às OSs e Notas Fiscais no ERP.
 */
export async function attachBatchXmlAction(
  xmlFiles: { name: string; base64OrText: string }[]
): Promise<XmlBatchImportSummary> {
  const session = await requirePermission("faturamento.write");

  const results: XmlBatchMatchResult[] = [];
  let matchedCount = 0;
  let createdCount = 0;
  let errorCount = 0;

  for (const item of xmlFiles) {
    try {
      const content = item.base64OrText.includes("base64,")
        ? Buffer.from(item.base64OrText.split("base64,")[1], "base64").toString("utf-8")
        : item.base64OrText;

      // Extrai número da nota (<nNF> ou <NumeroNF> ou <Numero>)
      const nNfMatch = content.match(/<(?:nNF|NumeroNF|Numero)>(\d+)<\/(?:nNF|NumeroNF|Numero)>/i);
      const invoiceCode = nNfMatch ? nNfMatch[1].trim() : "";

      // Extrai valor total (<vNF> ou <ValorNf> ou <ValorServicos>)
      const vNfMatch = content.match(/<(?:vNF|ValorNf|ValorServicos|ValorTotal)>([\d.]+)<\/(?:vNF|ValorNf|ValorServicos|ValorTotal)>/i);
      const totalValue = vNfMatch ? parseFloat(vNfMatch[1]) : 0;

      // Extrai CNPJ/CPF do tomador
      const cnpjMatch = content.match(/<(?:CNPJ|CPF)>(\d+)<\/(?:CNPJ|CPF)>/i);
      const clientDoc = cnpjMatch ? cnpjMatch[1].trim() : "";

      // Extrai data de emissão
      const dateMatch = content.match(/<(?:dhEmi|dEmi|DataEmissao)>([^<]+)<\/(?:dhEmi|dEmi|DataEmissao)>/i);
      const issueDate = dateMatch ? dateMatch[1].trim() : new Date().toISOString().slice(0, 10);

      // Extrai menção à OS na observação (<infCpl> ou <OutrasInformacoes>)
      const osMatch = content.match(/\b(OS-\d{4}-\d+|\d{4}-\d+)\b/i);
      const mentionedOsCode = osMatch ? osMatch[1].toUpperCase() : undefined;

      if (!invoiceCode) {
        results.push({
          xmlName: item.name,
          invoiceCode: "—",
          totalValue,
          status: "ERRO",
          message: "Número da NF não encontrado no XML.",
        });
        errorCount++;
        continue;
      }

      // Procura NF existente pelo número da nota
      let existingInvoice = await prisma.invoice.findUnique({
        where: { code: invoiceCode },
        include: { serviceOrder: true },
      });

      // Procura OS pelo código mencionado ou cliente/valor
      let matchedOs = mentionedOsCode
        ? await prisma.serviceOrder.findFirst({
            where: {
              OR: [
                { code: mentionedOsCode },
                { code: `OS-${mentionedOsCode}` },
              ],
            },
          })
        : null;

      if (!matchedOs && existingInvoice?.serviceOrderId) {
        matchedOs = await prisma.serviceOrder.findUnique({
          where: { id: existingInvoice.serviceOrderId },
        });
      }

      if (!matchedOs && clientDoc) {
        matchedOs = await prisma.serviceOrder.findFirst({
          where: {
            client: { cpfCnpj: { contains: clientDoc } },
            status: { in: ["FATURAMENTO", "CONCLUIDA", "RELATORIO_ENVIADO"] },
          },
          orderBy: { createdAt: "desc" },
        });
      }

      // Salva o arquivo XML fisicamente
      const base64Content = item.base64OrText.includes("base64,")
        ? item.base64OrText
        : `data:text/xml;base64,${Buffer.from(content).toString("base64")}`;

      const xmlUrl = await saveBase64Asset(base64Content, `xml-${invoiceCode}-${Date.now()}`);

      if (existingInvoice) {
        await prisma.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            xmlUrl,
            status: "EMITIDA",
          },
        });

        if (matchedOs) {
          await prisma.serviceOrder.update({
            where: { id: matchedOs.id },
            data: {
              status: "FATURADA",
              faturamentoStatus: "NF_EMITIDA",
            },
          });
        }

        matchedCount++;
        results.push({
          xmlName: item.name,
          invoiceCode,
          issueDate,
          totalValue: Number(existingInvoice.value),
          clientDoc,
          matchedOsCode: matchedOs?.code,
          matchedOsId: matchedOs?.id,
          matchedInvoiceId: existingInvoice.id,
          status: "VINCULADO",
          message: `XML da NF ${invoiceCode} vinculado à nota existente e OS ${matchedOs?.code || "sem OS"}.`,
        });
      } else if (matchedOs) {
        const newInvoice = await prisma.invoice.create({
          data: {
            code: invoiceCode,
            serviceOrderId: matchedOs.id,
            clientId: matchedOs.clientId,
            value: totalValue > 0 ? totalValue : 100,
            taxValue: 0,
            status: "EMITIDA",
            issueDate: new Date(issueDate),
            paymentTerms: "LIQUIDO_30",
            xmlUrl,
            notes: `Nota cadastrada automaticamente via lote XML (${item.name}).`,
          },
        });

        await prisma.serviceOrder.update({
          where: { id: matchedOs.id },
          data: {
            status: "FATURADA",
            faturamentoStatus: "NF_EMITIDA",
            invoiceId: newInvoice.id,
          },
        });

        // Garante criação do contas a receber
        await prisma.accountsReceivable.create({
          data: {
            clientId: matchedOs.clientId,
            serviceOrderId: matchedOs.id,
            invoiceId: newInvoice.id,
            totalValue: totalValue > 0 ? totalValue : 100,
            receivedValue: 0,
            pendingValue: totalValue > 0 ? totalValue : 100,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "ABERTO",
            category: "RECEITA_SERVICO",
            costCenter: "GERAL",
            notes: `Gerado via vinculação em lote de XML da NF ${invoiceCode}`,
          },
        });

        await prisma.serviceOrderStatusHistory.create({
          data: {
            serviceOrderId: matchedOs.id,
            oldStatus: matchedOs.status,
            newStatus: "FATURADA",
            changedById: session.userId,
            justification: `Nota fiscal ${invoiceCode} vinculada automaticamente via lote de arquivos XML.`,
          },
        });

        createdCount++;
        results.push({
          xmlName: item.name,
          invoiceCode,
          issueDate,
          totalValue: totalValue > 0 ? totalValue : 100,
          clientDoc,
          matchedOsCode: matchedOs.code,
          matchedOsId: matchedOs.id,
          matchedInvoiceId: newInvoice.id,
          status: "CRIADO_NOVO",
          message: `Nova NF ${invoiceCode} criada e vinculada à OS ${matchedOs.code}.`,
        });
      } else {
        results.push({
          xmlName: item.name,
          invoiceCode,
          issueDate,
          totalValue,
          clientDoc,
          status: "ERRO",
          message: `Nenhuma OS ou Cliente correspondente ao CNPJ ${clientDoc || "não informado"} foi encontrado para a NF ${invoiceCode}.`,
        });
        errorCount++;
      }
    } catch (err: any) {
      errorCount++;
      results.push({
        xmlName: item.name,
        invoiceCode: "—",
        totalValue: 0,
        status: "ERRO",
        message: `Falha ao processar arquivo XML: ${err.message}`,
      });
    }
  }

  revalidatePath("/faturamento");
  revalidatePath("/ordens-servico");
  revalidatePath("/financeiro");

  return {
    totalProcessed: xmlFiles.length,
    matchedCount,
    createdCount,
    errorCount,
    results,
  };
}
