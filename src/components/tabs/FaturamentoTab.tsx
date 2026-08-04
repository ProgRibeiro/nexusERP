"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { BillingQueueItem, getBillingQueue, getInvoices, processBilling, updateBillingMirror } from "@/app/actions/billingActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildBillingDescription } from "@/lib/billingDescription";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Table, TableCell, TableRow } from "../ui/Table";
import {
  AlertTriangle, Check, CheckCircle2, Clipboard, Download, FileSpreadsheet,
  FileText, Loader2, Pencil, Receipt, RefreshCw, Search, Send, XCircle,
} from "lucide-react";

interface MirrorRow extends BillingQueueItem {
  selected: boolean;
}

interface InvoiceRecord {
  id: string;
  code: string;
  value: number;
  taxValue: number;
  createdAt: Date;
  pdfUrl: string | null;
  client?: { name: string };
  serviceOrder?: { code: string; purchaseOrder: string | null };
}

const cleanDocument = (value: string) => value.replace(/\D/g, "");
const cleanCnae = (value: string) => value.replace(/\D/g, "");

export default function FaturamentoTab() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<MirrorRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"mirror" | "history">("mirror");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MirrorRow | null>(null);
  const [registering, setRegistering] = useState<MirrorRow | null>(null);
  const [invoiceCode, setInvoiceCode] = useState("");
  const [registeredValue, setRegisteredValue] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("PIX");

  const loadData = async () => {
    setLoading(true);
    try {
      const [queue, history] = await Promise.all([getBillingQueue(), getInvoices()]);
      setRows(queue.map((item) => ({ ...item, selected: true })));
      setInvoices(history as InvoiceRecord[]);
    } catch (error) {
      console.error(error);
      toast("Não foi possível carregar o espelho fiscal.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pathname !== "/faturamento") return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((item) => item.code.toLowerCase().includes(term) || item.quoteCode.toLowerCase().includes(term) || item.legalName.toLowerCase().includes(term) || item.clientDocument.includes(term) || item.purchaseOrder.toLowerCase().includes(term) || item.description.toLowerCase().includes(term));
  }, [rows, search]);

  const selectedRows = rows.filter((item) => item.selected);
  const readyRows = selectedRows.filter((item) => item.missingFields.length === 0);
  const pendingValue = rows.reduce((total, item) => total + item.value, 0);

  const automaticDescriptionFor = (row: MirrorRow, purchaseOrder = row.purchaseOrder) => buildBillingDescription({
    purchaseOrder,
    quoteCode: row.quoteCode,
    serviceOrderCode: row.code,
    serviceDescription: row.serviceDescription,
  });

  const updateEditing = (field: keyof MirrorRow, value: string) => {
    setEditing((current) => current ? { ...current, [field]: value } : current);
  };

  const updatePurchaseOrder = (purchaseOrder: string) => {
    setEditing((current) => {
      if (!current) return current;
      const currentAutomatic = automaticDescriptionFor(current);
      const shouldRefreshDescription = !current.description.trim()
        || current.description === currentAutomatic
        || current.description === current.serviceDescription;
      return {
        ...current,
        purchaseOrder,
        description: shouldRefreshDescription ? automaticDescriptionFor(current, purchaseOrder) : current.description,
      };
    });
  };

  const saveEditing = async () => {
    if (!editing) return;
    const document = cleanDocument(editing.clientDocument);
    const missing: string[] = [];
    if (!editing.legalName.trim()) missing.push("Razão social / tomador");
    if (![11, 14].includes(document.length)) missing.push("CPF/CNPJ válido");
    if (editing.value <= 0) missing.push("Valor");
    if (!editing.email.trim() || editing.email.endsWith("@importado.local")) missing.push("E-mail válido");
    if (!editing.cep.trim()) missing.push("CEP");
    if (!editing.addressNumber.trim()) missing.push("Número do endereço");
    const adjustedRow = { ...editing, clientDocument: document, cnae: cleanCnae(editing.cnae), cep: editing.cep.replace(/\D/g, ""), missingFields: missing };
    setActionLoading(true);
    try {
      const result = await updateBillingMirror(editing.id, adjustedRow);
      if (!result.success) {
        toast(result.error || "Não foi possível salvar os dados do espelho.", "error");
        return;
      }
      setRows((current) => current.map((row) => row.id === editing.id ? adjustedRow : row));
      setEditing(null);
      toast("Espelho e pedido de compra salvos na OS.", "success");
    } finally {
      setActionLoading(false);
    }
  };

  const copyRow = async (row: MirrorRow) => {
    const cells = [row.legalName, cleanDocument(row.clientDocument), row.value.toFixed(2).replace(".", ","), row.description, cleanCnae(row.cnae), row.email, row.cep.replace(/\D/g, ""), row.addressNumber];
    await navigator.clipboard.writeText(cells.join("\t"));
    toast(`Dados da ${row.code} copiados na ordem da planilha.`, "success");
  };

  const exportSpreadsheet = async () => {
    if (!selectedRows.length) {
      toast("Selecione pelo menos uma OS para exportar.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "NX ERP";
      const notes = workbook.addWorksheet("Notas");
      const headers = [
        "Razão social ou Nome do tomador\n*Obrigatório*",
        "CPF",
        "Valor",
        "Descrição\n*Opcional",
        "CNAE (Atividade)\n*Apenas números, sem hífen, barra ou pontos. Exemplo: 3304000. Ao deixar a célula em branco, usaremos a atividade principal",
        "email",
        "CEP do endereço\n*Obrigatório apenas para novos cadastros de CNPJ",
        "Número do endereço\n*Obrigatório apenas para novos cadastros de CNPJ",
      ];
      notes.addRow(headers);
      selectedRows.forEach((row) => notes.addRow([
        row.legalName.trim(), cleanDocument(row.clientDocument), row.value,
        row.description.trim(), cleanCnae(row.cnae), row.email.trim(),
        row.cep.replace(/\D/g, ""), row.addressNumber.trim(),
      ]));
      notes.getRow(1).height = 72;
      notes.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      notes.getRow(1).alignment = { vertical: "middle", wrapText: true };
      notes.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      notes.columns = [{ width: 38 }, { width: 18 }, { width: 15 }, { width: 55 }, { width: 23 }, { width: 32 }, { width: 18 }, { width: 20 }];
      notes.getColumn(3).numFmt = 'R$ #,##0.00';
      notes.views = [{ state: "frozen", ySplit: 1 }];
      notes.autoFilter = { from: "A1", to: "H1" };

      const control = workbook.addWorksheet("Controle ERP");
      control.addRow(["OS", "Orçamento", "Pedido de compra", "Tomador", "CPF/CNPJ", "Valor", "Descrição fiscal", "Situação"]);
      selectedRows.forEach((row) => control.addRow([
        row.code,
        row.quoteCode,
        row.purchaseOrder.trim(),
        row.legalName.trim(),
        cleanDocument(row.clientDocument),
        row.value,
        row.description.trim(),
        row.missingFields.length ? `Revisar: ${row.missingFields.join(", ")}` : "Pronta para emissão",
      ]));
      control.getRow(1).height = 28;
      control.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      control.getRow(1).alignment = { vertical: "middle" };
      control.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      control.columns = [{ width: 18 }, { width: 20 }, { width: 24 }, { width: 38 }, { width: 20 }, { width: 16 }, { width: 65 }, { width: 38 }];
      control.getColumn(6).numFmt = 'R$ #,##0.00';
      control.views = [{ state: "frozen", ySplit: 1 }];
      control.autoFilter = { from: "A1", to: "H1" };

      const instructions = workbook.addWorksheet("Instruções");
      instructions.getColumn(1).width = 110;
      instructions.addRow(["Instruções para emissão em lote"]);
      instructions.addRow(["1. Não apague nem altere a primeira linha da aba Notas."]);
      instructions.addRow(["2. Confira os registros sinalizados pelo ERP antes de enviar a planilha ao emissor."]);
      instructions.addRow(["3. CNAE pode ficar vazio para utilizar a atividade principal configurada no emissor."]);
      instructions.addRow(["4. E-mail, CEP e número são necessários quando o tomador ainda não existe no sistema externo."]);
      instructions.addRow(["5. A descrição fiscal combina pedido de compra, orçamento e resumo do serviço. O controle detalhado fica na aba Controle ERP."]);
      instructions.addRow(["6. Depois da emissão externa, retorne ao ERP e use Registrar nota emitida."]);
      instructions.getRow(1).font = { bold: true, size: 16, color: { argb: "FF1D4ED8" } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `espelho-notas-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast(`${selectedRows.length} OS exportada(s) no formato da planilha.`, "success");
    } catch (error) {
      console.error(error);
      toast("Erro ao gerar a planilha de notas.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openRegister = (row: MirrorRow) => {
    setRegistering(row);
    setInvoiceCode("");
    setRegisteredValue(String(row.value));
    setTaxPercent("0");
    setInstallments("1");
    setPaymentMethod("PIX");
  };

  const registerExternalInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const invoiceValue = Number(registeredValue);
    if (!registering || !invoiceCode.trim() || invoiceValue <= 0) {
      toast("Informe o número da NF e um valor válido para a nota.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const result = await processBilling({ osId: registering.id, invoiceCode: invoiceCode.trim(), totalValue: invoiceValue, taxPercent: Number(taxPercent) || 0, installments: Number(installments) || 1, paymentMethod, notes: `Nota emitida no sistema externo. Pedido de compra: ${registering.purchaseOrder || "não informado"}. Valor original da OS: ${formatCurrency(registering.value)}.`, userId: user?.id || "" });
      if (!result.success) {
        toast(result.error || "Não foi possível registrar a nota.", "error");
        return;
      }
      toast("Nota externa registrada e contas a receber geradas.", "success");
      setRegistering(null);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !rows.length && !invoices.length) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="text-xs font-semibold text-zinc-500">Montando espelho das notas...</p></div>;

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="bg-gradient-to-r from-slate-950 to-blue-900 p-6 text-white">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div><div className="flex items-center gap-2 text-xs font-bold text-blue-200"><FileSpreadsheet size={15} /> Espelho para emissão externa</div><h2 className="mt-2 text-2xl font-black">OS concluídas aguardando nota fiscal</h2><p className="mt-1 max-w-3xl text-sm text-blue-100/75">O ERP organiza e confere os dados. A emissão acontece no seu sistema fiscal; depois, registre aqui o número da nota.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void loadData()}><RefreshCw size={14} /> Atualizar</Button>{hasPermission("faturamento.write") && <Button variant="primary" loading={actionLoading} onClick={exportSpreadsheet}><Download size={15} /> Baixar planilha ({selectedRows.length})</Button>}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 sm:grid-cols-4 sm:divide-y-0 dark:divide-zinc-800">
          <div className="p-4"><span className="text-[10px] font-bold uppercase text-zinc-500">Na fila</span><strong className="mt-1 block text-xl">{rows.length} OS</strong></div>
          <div className="p-4"><span className="text-[10px] font-bold uppercase text-zinc-500">Valor pendente</span><strong className="mt-1 block text-xl text-emerald-600">{formatCurrency(pendingValue)}</strong></div>
          <div className="p-4"><span className="text-[10px] font-bold uppercase text-zinc-500">Prontas para exportar</span><strong className="mt-1 block text-xl text-blue-600">{readyRows.length}</strong></div>
          <div className="p-4"><span className="text-[10px] font-bold uppercase text-zinc-500">Precisam revisão</span><strong className="mt-1 block text-xl text-orange-600">{selectedRows.length - readyRows.length}</strong></div>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button onClick={() => setActiveTab("mirror")} className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === "mirror" ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>Espelho das OS ({rows.length})</button>
        <button onClick={() => setActiveTab("history")} className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === "history" ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>Notas registradas ({invoices.length})</button>
      </div>

      {activeTab === "mirror" ? <Card className="space-y-4 p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"><div><h3 className="text-sm font-black">Dados para a planilha de notas</h3><p className="text-xs text-zinc-500">Os campos seguem a mesma ordem do arquivo enviado. O pedido de compra acompanha o controle interno.</p></div><div className="w-full sm:w-96"><Input placeholder="Buscar OS, pedido de compra, tomador ou documento" icon={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        {!rows.length ? <div className="py-16 text-center"><CheckCircle2 size={32} className="mx-auto text-emerald-500" /><p className="mt-3 text-sm font-bold">Nenhuma OS aguardando nota</p><p className="text-xs text-zinc-500">Quando uma OS for concluída, ela aparecerá aqui.</p></div> : <>
          <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 xl:hidden">
            {filteredRows.map((row) => (
              <article key={row.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-3">
                  <input className="mt-1" type="checkbox" checked={row.selected} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: e.target.checked } : item))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><strong className="text-sm">{row.code}</strong><p className="text-[10px] text-zinc-500">Concluída {row.completedAt ? formatDate(row.completedAt) : ""}</p></div>
                      {row.missingFields.length ? <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 dark:bg-orange-950/30"><AlertTriangle size={11} /> Revisar {row.missingFields.length}</span> : <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/30"><Check size={11} /> Pronta</span>}
                    </div>
                    <h4 className="mt-3 truncate text-sm font-bold">{row.legalName}</h4>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{cleanDocument(row.clientDocument)}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                      <div><span className="block text-[9px] font-bold uppercase text-zinc-400">Valor OS</span><strong>{formatCurrency(row.value)}</strong></div>
                      <div><span className="block text-[9px] font-bold uppercase text-zinc-400">Pedido de compra</span><span className={row.purchaseOrder ? "font-semibold text-blue-700 dark:text-blue-300" : "text-orange-600"}>{row.purchaseOrder || "Não informado"}</span></div>
                      <div><span className="block text-[9px] font-bold uppercase text-zinc-400">CNAE</span><span>{row.cnae || "Principal"}</span></div>
                      <div><span className="block text-[9px] font-bold uppercase text-zinc-400">CEP / Nº</span><span>{row.cep || "—"} / {row.addressNumber || "—"}</span></div>
                      <div><span className="block text-[9px] font-bold uppercase text-zinc-400">E-mail</span><span className="block truncate">{row.email}</span></div>
                    </div>
                    <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{row.description || "Descrição opcional não informada"}</div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing({ ...row })}><Pencil size={13} /> Revisar</Button><Button size="sm" variant="secondary" onClick={() => void copyRow(row)}><Clipboard size={13} /> Copiar</Button>{hasPermission("faturamento.write") && <Button size="sm" variant="primary" onClick={() => openRegister(row)}><Send size={13} /> Registrar NF</Button>}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1660px] w-full text-left">
              <thead><tr className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/50"><th className="px-4 py-3 w-12"><input type="checkbox" checked={rows.length > 0 && rows.every((row) => row.selected)} onChange={(e) => setRows((current) => current.map((row) => ({ ...row, selected: e.target.checked })))} /></th><th className="px-3 py-3">OS / Situação</th><th className="px-3 py-3">Pedido de compra</th><th className="px-3 py-3">Razão social ou tomador *</th><th className="px-3 py-3">CPF/CNPJ</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">CNAE</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">CEP</th><th className="px-3 py-3">Número</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                {filteredRows.map((row) => <tr key={row.id} className="align-top hover:bg-blue-50/30 dark:hover:bg-blue-950/10"><td className="px-4 py-4"><input type="checkbox" checked={row.selected} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: e.target.checked } : item))} /></td><td className="px-3 py-4"><strong className="block">{row.code}</strong><span className="text-[10px] text-zinc-500">Concluída {row.completedAt ? formatDate(row.completedAt) : ""}</span>{row.missingFields.length ? <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-600"><AlertTriangle size={11} /> Revisar {row.missingFields.length}</span> : <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Check size={11} /> Pronta</span>}</td><td className="px-3 py-4"><span className={row.purchaseOrder ? "font-semibold text-blue-700 dark:text-blue-300" : "text-orange-600"}>{row.purchaseOrder || "Não informado"}</span></td><td className="max-w-64 px-3 py-4 font-semibold">{row.legalName}</td><td className="px-3 py-4 font-mono">{cleanDocument(row.clientDocument)}</td><td className="px-3 py-4 font-bold">{formatCurrency(row.value)}</td><td className="max-w-72 px-3 py-4 text-zinc-600 dark:text-zinc-400">{row.description || <span className="italic text-zinc-400">Opcional</span>}</td><td className="px-3 py-4 font-mono">{row.cnae || <span className="text-zinc-400">Principal</span>}</td><td className={`max-w-64 px-3 py-4 ${row.email.endsWith("@importado.local") ? "text-orange-600" : ""}`}>{row.email}</td><td className="px-3 py-4 font-mono">{row.cep || "—"}</td><td className="px-3 py-4">{row.addressNumber || "—"}</td><td className="px-4 py-4"><div className="flex justify-end gap-1"><button onClick={() => setEditing({ ...row })} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Revisar dados"><Pencil size={14} /></button><button onClick={() => void copyRow(row)} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Copiar linha"><Clipboard size={14} /></button>{hasPermission("faturamento.write") && <button onClick={() => openRegister(row)} className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700" title="Registrar nota emitida"><Send size={14} /></button>}</div></td></tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </Card> : <Card className="p-0 overflow-hidden">
        <div className="border-b border-zinc-100 p-5 dark:border-zinc-800"><h3 className="text-sm font-black">Histórico de notas registradas</h3><p className="text-xs text-zinc-500">Notas emitidas externamente e confirmadas no ERP.</p></div>
        {invoices.length ? <Table headers={["Nota", "Tomador", "OS", "Pedido de compra", "Valor", "Imposto", "Registro", "Arquivo"]}>{invoices.map((invoice) => <TableRow key={invoice.id}><TableCell className="font-bold">{invoice.code}</TableCell><TableCell>{invoice.client?.name || "—"}</TableCell><TableCell>{invoice.serviceOrder?.code || "—"}</TableCell><TableCell>{invoice.serviceOrder?.purchaseOrder || "—"}</TableCell><TableCell className="font-bold">{formatCurrency(invoice.value)}</TableCell><TableCell>{formatCurrency(invoice.taxValue)}</TableCell><TableCell>{formatDate(invoice.createdAt)}</TableCell><TableCell>{invoice.pdfUrl ? <a className="flex items-center gap-1 font-bold text-blue-600" href={invoice.pdfUrl}><FileText size={13} /> Arquivo</a> : "—"}</TableCell></TableRow>)}</Table> : <div className="py-14 text-center text-xs text-zinc-500">Nenhuma nota externa registrada.</div>}
      </Card>}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Revisar dados do espelho" size="xl">
        {editing && <div className="space-y-5">
          <div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><strong>{editing.code}</strong> · As alterações serão salvas na OS e reutilizadas no espelho e nas próximas exportações.</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <Input label="Pedido de compra / PO do cliente" maxLength={120} placeholder="Ex: PC-45872, PO-2026-118 ou autorização do cliente" value={editing.purchaseOrder} onChange={(e) => updatePurchaseOrder(e.target.value)} />
            <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-300">Ao informar o pedido, a descrição fiscal é atualizada automaticamente com o pedido, o orçamento e o resumo do serviço.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Razão social ou Nome do tomador *" value={editing.legalName} onChange={(e) => updateEditing("legalName", e.target.value)} />
            <Input label="CPF/CNPJ *" value={editing.clientDocument} onChange={(e) => updateEditing("clientDocument", e.target.value)} />
            <Input label="Valor *" type="number" value={editing.value} onChange={(e) => setEditing((current) => current ? { ...current, value: Number(e.target.value) || 0 } : current)} />
            <Input label="CNAE (somente números, opcional)" value={editing.cnae} onChange={(e) => updateEditing("cnae", e.target.value)} />
            <Input label="E-mail" type="email" value={editing.email} onChange={(e) => updateEditing("email", e.target.value)} />
            <div className="grid grid-cols-2 gap-3"><Input label="CEP" value={editing.cep} onChange={(e) => updateEditing("cep", e.target.value)} /><Input label="Número" value={editing.addressNumber} onChange={(e) => updateEditing("addressNumber", e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Descrição fiscal resumida</p><p className="text-[10px] text-zinc-500">Orçamento: {editing.quoteCode || "não vinculado"} · OS: {editing.code}</p></div>
              <button type="button" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300" onClick={() => setEditing((current) => current ? { ...current, description: automaticDescriptionFor(current) } : current)}>Gerar resumo automático</button>
            </div>
            <Textarea rows={3} maxLength={240} value={editing.description} onChange={(e) => updateEditing("description", e.target.value)} hint={`${editing.description.length}/240 caracteres · Esta é a descrição enviada para a planilha fiscal.`} />
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" loading={actionLoading} onClick={() => void saveEditing()}>Salvar informações fiscais</Button></div>
        </div>}
      </Modal>

      <Modal isOpen={Boolean(registering)} onClose={() => setRegistering(null)} title="Registrar nota emitida externamente" size="lg">
        {registering && <form onSubmit={registerExternalInvoice} className="space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300"><strong>{registering.code} · {registering.legalName}</strong><p className="mt-1">Use esta etapa somente depois que a nota já tiver sido emitida no sistema externo. O ERP registrará a nota e criará as contas a receber pelo valor informado abaixo.</p></div>
          <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs ${registering.purchaseOrder ? "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-300" : "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300"}`}>
            <div><span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">Pedido de compra</span><strong>{registering.purchaseOrder || "Não informado"}</strong></div>
            {!registering.purchaseOrder && <button type="button" className="shrink-0 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-[10px] font-bold text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-zinc-900 dark:text-orange-300" onClick={() => { setRegistering(null); setEditing({ ...registering }); }}>Informar agora</button>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="Número / código da NF emitida *" required placeholder="Ex: 12345" value={invoiceCode} onChange={(e) => setInvoiceCode(e.target.value)} /><Input label="Valor efetivo da nota (R$) *" required min="0.01" step="0.01" type="number" value={registeredValue} onChange={(e) => setRegisteredValue(e.target.value)} /></div>
          <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800"><span className="text-zinc-500">Valor original calculado pela OS: </span><strong>{formatCurrency(registering.value)}</strong></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Input label="Imposto total (%)" type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /><Select label="Parcelas" value={installments} onChange={(e) => setInstallments(e.target.value)} options={[{ value: "1", label: "1 parcela" }, { value: "2", label: "2 parcelas" }, { value: "3", label: "3 parcelas" }]} /><Select label="Forma de pagamento" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={[{ value: "PIX", label: "PIX" }, { value: "BOLETO", label: "Boleto" }, { value: "TRANSFERENCIA", label: "Transferência" }, { value: "CARTAO", label: "Cartão" }]} /></div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><Button type="button" variant="secondary" onClick={() => setRegistering(null)}>Cancelar</Button><Button type="submit" variant="success" loading={actionLoading}><Receipt size={14} /> Confirmar NF e valor</Button></div>
        </form>}
      </Modal>
    </div>
  );
}
