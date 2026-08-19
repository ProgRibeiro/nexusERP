"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  BillingQueueItem,
  getBillingQueue,
  getInvoices,
  markInvoiceAsPaid,
  processBilling,
  processDirectBilling,
  saveInvoiceDocuments,
  updateBillingMirror,
  updateInvoiceProntuario,
} from "@/app/actions/billingActions";
import { ClientDTO, getClients } from "@/app/actions/clientActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildBillingDescription } from "@/lib/billingDescription";
import { PAYMENT_TERM_OPTIONS, calculateDueDate, getPaymentTermLabel } from "@/lib/paymentTerms";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Table, TableCell, TableRow } from "../ui/Table";
import {
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  Clipboard,
  DollarSign,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  Pencil,
  PlusCircle,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Tag,
  Upload,
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
  issueDate: Date;
  paymentTerms?: string | null;
  status: string;
  notes?: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  client?: { id: string; name: string; defaultPaymentTerms?: string | null; billingGroup?: string | null };
  serviceOrder?: { code: string; purchaseOrder: string | null } | null;
  receivables?: Array<{
    id: string;
    dueDate: Date;
    status: string;
    pendingValue: number;
    totalValue: number;
    paymentDate?: Date | null;
    paymentMethod?: string | null;
  }>;
}

const cleanDocument = (value: string) => value.replace(/\D/g, "");
const cleanCnae = (value: string) => value.replace(/\D/g, "");

export default function FaturamentoTab() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<MirrorRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clientsList, setClientsList] = useState<ClientDTO[]>([]);
  const [activeTab, setActiveTab] = useState<"mirror" | "history">("mirror");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MirrorRow | null>(null);

  // Estados de Registro de NF (Baixa com OS)
  const [registering, setRegistering] = useState<MirrorRow | null>(null);
  const [invoiceCode, setInvoiceCode] = useState("");
  const [registeredValue, setRegisteredValue] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [installments, setInstallments] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentTerms, setPaymentTerms] = useState("LIQUIDO_30");
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [registerPdfDataUrl, setRegisterPdfDataUrl] = useState<string>();
  const [registerXmlDataUrl, setRegisterXmlDataUrl] = useState<string>();
  const [registerPdfName, setRegisterPdfName] = useState("");
  const [registerXmlName, setRegisterXmlName] = useState("");

  // Estados de Faturamento Avulso / Direto (sem OS)
  const [isDirectBillingOpen, setIsDirectBillingOpen] = useState(false);
  const [directClientId, setDirectClientId] = useState("");
  const [directServiceDescription, setDirectServiceDescription] = useState("");
  const [directInvoiceCode, setDirectInvoiceCode] = useState("");
  const [directValue, setDirectValue] = useState("");
  const [directTaxPercent, setDirectTaxPercent] = useState("0");
  const [directInstallments, setDirectInstallments] = useState("1");
  const [directPaymentMethod, setDirectPaymentMethod] = useState("PIX");
  const [directPaymentTerms, setDirectPaymentTerms] = useState("LIQUIDO_30");
  const [directIssueDate, setDirectIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [directPdfDataUrl, setDirectPdfDataUrl] = useState<string>();
  const [directXmlDataUrl, setDirectXmlDataUrl] = useState<string>();
  const [directPdfName, setDirectPdfName] = useState("");
  const [directXmlName, setDirectXmlName] = useState("");

  // Estados de Prontuário / Edição de Nota Emitida & Baixa de Pagamento
  const [prontuarioInvoice, setProntuarioInvoice] = useState<InvoiceRecord | null>(null);
  const [editProntuarioCode, setEditProntuarioCode] = useState("");
  const [editProntuarioIssueDate, setEditProntuarioIssueDate] = useState("");
  const [editProntuarioPaymentTerms, setEditProntuarioPaymentTerms] = useState("");
  const [editProntuarioCustomDueDate, setEditProntuarioCustomDueDate] = useState("");
  const [editProntuarioValue, setEditProntuarioValue] = useState("");
  const [editProntuarioNotes, setEditProntuarioNotes] = useState("");

  // Quitação / Dar Baixa no Pagamento
  const [payDateModal, setPayDateModal] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payMethodModal, setPayMethodModal] = useState("PIX");

  // Estados de Histórico & Filtros
  const [documentInvoice, setDocumentInvoice] = useState<InvoiceRecord | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("TODOS");
  const [issueMonthFilter, setIssueMonthFilter] = useState("TODOS");
  const [documentStatus, setDocumentStatus] = useState("EMITIDA");
  const [pdfDataUrl, setPdfDataUrl] = useState<string>();
  const [xmlDataUrl, setXmlDataUrl] = useState<string>();
  const [pdfName, setPdfName] = useState("");
  const [xmlName, setXmlName] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [queue, history, clients] = await Promise.all([
        getBillingQueue(),
        getInvoices(),
        getClients(),
      ]);
      setRows(queue.map((item) => ({ ...item, selected: true })));
      setInvoices(history as unknown as InvoiceRecord[]);
      setClientsList(clients);
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
    return rows.filter(
      (item) =>
        item.code.toLowerCase().includes(term) ||
        item.quoteCode.toLowerCase().includes(term) ||
        item.legalName.toLowerCase().includes(term) ||
        item.clientDocument.includes(term) ||
        item.purchaseOrder.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const selectedRows = rows.filter((item) => item.selected);
  const readyRows = selectedRows.filter((item) => item.missingFields.length === 0);
  const pendingValue = rows.reduce((total, item) => total + item.value, 0);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.issueDate) {
        const d = new Date(inv.issueDate);
        if (!isNaN(d.getTime())) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthsSet.add(monthKey);
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const term = invoiceSearch.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesStatus = invoiceStatus === "TODOS" || invoice.status === invoiceStatus;

      let matchesMonth = true;
      if (issueMonthFilter !== "TODOS" && invoice.issueDate) {
        const d = new Date(invoice.issueDate);
        if (!isNaN(d.getTime())) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          matchesMonth = monthKey === issueMonthFilter;
        }
      }

      const searchable = `${invoice.code} ${invoice.client?.name || ""} ${
        invoice.serviceOrder?.code || "AVULSO"
      } ${invoice.serviceOrder?.purchaseOrder || ""} ${getPaymentTermLabel(
        invoice.paymentTerms
      )} ${invoice.client?.billingGroup || ""}`.toLowerCase();

      return matchesStatus && matchesMonth && (!term || searchable.includes(term));
    });
  }, [invoiceSearch, invoiceStatus, issueMonthFilter, invoices]);

  const monthlyStats = useMemo(() => {
    const totalBilled = filteredInvoices.reduce((sum, inv) => sum + Number(inv.value || 0), 0);
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + Number(inv.taxValue || 0), 0);
    const withPdf = filteredInvoices.filter((inv) => inv.pdfUrl).length;
    const withXml = filteredInvoices.filter((inv) => inv.xmlUrl).length;
    const directCount = filteredInvoices.filter((inv) => !inv.serviceOrder).length;

    return { totalBilled, totalTax, withPdf, withXml, directCount };
  }, [filteredInvoices]);

  const previewDueDate = useMemo(() => {
    if (!issueDate) return null;
    return calculateDueDate(issueDate, paymentTerms, 1);
  }, [issueDate, paymentTerms]);

  const directPreviewDueDate = useMemo(() => {
    if (!directIssueDate) return null;
    return calculateDueDate(directIssueDate, directPaymentTerms, 1);
  }, [directIssueDate, directPaymentTerms]);

  const prontuarioPreviewDueDate = useMemo(() => {
    if (editProntuarioCustomDueDate) return new Date(editProntuarioCustomDueDate);
    if (!editProntuarioIssueDate) return null;
    return calculateDueDate(editProntuarioIssueDate, editProntuarioPaymentTerms, 1);
  }, [editProntuarioIssueDate, editProntuarioPaymentTerms, editProntuarioCustomDueDate]);

  const fileToDataUrl = (file: File, allowed: string[]) =>
    new Promise<string>((resolve, reject) => {
      if (
        !allowed.includes(file.type) &&
        !(file.name.toLowerCase().endsWith(".xml") && allowed.includes("application/xml"))
      )
        return reject(new Error("Formato de arquivo inválido."));
      if (file.size > 4 * 1024 * 1024) return reject(new Error("O arquivo deve ter no máximo 4 MB."));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });

  const openDocuments = (invoice: InvoiceRecord) => {
    setDocumentInvoice(invoice);
    setDocumentStatus(invoice.status);
    setPdfDataUrl(undefined);
    setXmlDataUrl(undefined);
    setPdfName("");
    setXmlName("");
  };

  const saveDocuments = async () => {
    if (!documentInvoice) return;
    setActionLoading(true);
    const result = await saveInvoiceDocuments({
      invoiceId: documentInvoice.id,
      pdfDataUrl,
      xmlDataUrl,
      status: documentStatus as "EMITIDA" | "ENVIADA" | "CANCELADA" | "SUBSTITUIDA",
    });
    if (result.success) {
      toast("Documentos fiscais armazenados com segurança.", "success");
      setDocumentInvoice(null);
      await loadData();
    } else toast(result.error || "Erro ao salvar documentos.", "error");
    setActionLoading(false);
  };

  const openProntuario = (invoice: InvoiceRecord) => {
    setProntuarioInvoice(invoice);
    setEditProntuarioCode(invoice.code);
    setEditProntuarioIssueDate(
      invoice.issueDate ? new Date(invoice.issueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setEditProntuarioPaymentTerms(invoice.paymentTerms || "LIQUIDO_30");
    const recDueDate = invoice.receivables?.[0]?.dueDate
      ? new Date(invoice.receivables[0].dueDate).toISOString().slice(0, 10)
      : "";
    setEditProntuarioCustomDueDate(recDueDate);
    setEditProntuarioValue(String(invoice.value));
    setEditProntuarioNotes(invoice.notes || "");
    setPayDateModal(new Date().toISOString().slice(0, 10));
    setPayMethodModal("PIX");
  };

  const saveProntuarioChanges = async () => {
    if (!prontuarioInvoice) return;
    setActionLoading(true);
    try {
      const result = await updateInvoiceProntuario({
        invoiceId: prontuarioInvoice.id,
        invoiceCode: editProntuarioCode,
        issueDate: editProntuarioIssueDate,
        paymentTerms: editProntuarioPaymentTerms,
        customDueDate: editProntuarioCustomDueDate || undefined,
        totalValue: Number(editProntuarioValue) || prontuarioInvoice.value,
        notes: editProntuarioNotes,
      });

      if (!result.success) {
        toast(result.error || "Não foi possível atualizar o prontuário.", "error");
        return;
      }

      toast("Prontuário e datas de vencimento atualizadas com sucesso!", "success");
      setProntuarioInvoice(null);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!prontuarioInvoice) return;
    setActionLoading(true);
    try {
      const result = await markInvoiceAsPaid(prontuarioInvoice.id, payDateModal, payMethodModal);
      if (!result.success) {
        toast(result.error || "Erro ao dar baixa no recebimento.", "error");
        return;
      }
      toast("Baixa de pagamento efetuada e título quitado!", "success");
      setProntuarioInvoice(null);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const automaticDescriptionFor = (row: MirrorRow, purchaseOrder = row.purchaseOrder) =>
    buildBillingDescription({
      purchaseOrder,
      quoteCode: row.quoteCode,
      serviceOrderCode: row.code,
      serviceDescription: row.serviceDescription,
    });

  const updateEditing = (field: keyof MirrorRow, value: string) => {
    setEditing((current) => (current ? { ...current, [field]: value } : current));
  };

  const updatePurchaseOrder = (purchaseOrder: string) => {
    setEditing((current) => {
      if (!current) return current;
      const currentAutomatic = automaticDescriptionFor(current);
      const shouldRefreshDescription =
        !current.description.trim() ||
        current.description === currentAutomatic ||
        current.description === current.serviceDescription;
      return {
        ...current,
        purchaseOrder,
        description: shouldRefreshDescription
          ? automaticDescriptionFor(current, purchaseOrder)
          : current.description,
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
    const adjustedRow = {
      ...editing,
      clientDocument: document,
      cnae: cleanCnae(editing.cnae),
      cep: editing.cep.replace(/\D/g, ""),
      missingFields: missing,
    };
    setActionLoading(true);
    try {
      const result = await updateBillingMirror(editing.id, adjustedRow);
      if (!result.success) {
        toast(result.error || "Não foi possível salvar os dados do espelho.", "error");
        return;
      }
      setRows((current) => current.map((row) => (row.id === editing.id ? adjustedRow : row)));
      setEditing(null);
      toast("Espelho e pedido de compra salvos na OS.", "success");
    } finally {
      setActionLoading(false);
    }
  };

  const copyRow = async (row: MirrorRow) => {
    const cells = [
      row.legalName,
      cleanDocument(row.clientDocument),
      row.value.toFixed(2).replace(".", ","),
      row.description,
      cleanCnae(row.cnae),
      row.email,
      row.cep.replace(/\D/g, ""),
      row.addressNumber,
    ];
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
      selectedRows.forEach((row) =>
        notes.addRow([
          row.legalName.trim(),
          cleanDocument(row.clientDocument),
          row.value,
          row.description.trim(),
          cleanCnae(row.cnae),
          row.email.trim(),
          row.cep.replace(/\D/g, ""),
          row.addressNumber.trim(),
        ])
      );
      notes.getRow(1).height = 72;
      notes.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      notes.getRow(1).alignment = { vertical: "middle", wrapText: true };
      notes.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      notes.columns = [
        { width: 38 },
        { width: 18 },
        { width: 15 },
        { width: 55 },
        { width: 23 },
        { width: 32 },
        { width: 18 },
        { width: 20 },
      ];
      notes.getColumn(3).numFmt = "R$ #,##0.00";
      notes.views = [{ state: "frozen", ySplit: 1 }];
      notes.autoFilter = { from: "A1", to: "H1" };

      const control = workbook.addWorksheet("Controle ERP");
      control.addRow([
        "OS",
        "Orçamento",
        "Pedido de compra",
        "Tomador",
        "CPF/CNPJ",
        "Valor",
        "Descrição fiscal",
        "Situação",
      ]);
      selectedRows.forEach((row) =>
        control.addRow([
          row.code,
          row.quoteCode,
          row.purchaseOrder.trim(),
          row.legalName.trim(),
          cleanDocument(row.clientDocument),
          row.value,
          row.description.trim(),
          row.missingFields.length ? `Revisar: ${row.missingFields.join(", ")}` : "Pronta para emissão",
        ])
      );
      control.getRow(1).height = 28;
      control.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      control.getRow(1).alignment = { vertical: "middle" };
      control.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      control.columns = [
        { width: 18 },
        { width: 20 },
        { width: 24 },
        { width: 38 },
        { width: 20 },
        { width: 16 },
        { width: 65 },
        { width: 38 },
      ];
      control.getColumn(6).numFmt = "R$ #,##0.00";
      control.views = [{ state: "frozen", ySplit: 1 }];
      control.autoFilter = { from: "A1", to: "H1" };

      const instructions = workbook.addWorksheet("Instruções");
      instructions.getColumn(1).width = 110;
      instructions.addRow(["Instruções para emissão em lote"]);
      instructions.addRow(["1. Não apague nem altere a primeira linha da aba Notas."]);
      instructions.addRow(["2. Confira os registros sinalizados pelo ERP antes de enviar a planilha ao emissor."]);
      instructions.addRow(["3. CNAE pode ficar vazio para utilizar a atividade principal configurada no emissor."]);
      instructions.addRow([
        "4. E-mail, CEP e número são necessários quando o tomador ainda não existe no sistema externo.",
      ]);
      instructions.addRow([
        "5. A descrição fiscal combina pedido de compra, orçamento e resumo do serviço. O controle detalhado fica na aba Controle ERP.",
      ]);
      instructions.addRow(["6. Depois da emissão externa, retorne ao ERP e use Registrar nota emitida."]);
      instructions.getRow(1).font = { bold: true, size: 16, color: { argb: "FF1D4ED8" } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
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

  const [hasRetention, setHasRetention] = useState(false);
  const [retentionValue, setRetentionValue] = useState("0");
  const [netValueToReceive, setNetValueToReceive] = useState("0");
  const [expectedDueDate, setExpectedDueDate] = useState("");

  const openRegister = (row: MirrorRow) => {
    setRegistering(row);
    setInvoiceCode("");
    setRegisteredValue(String(row.value));
    setHasRetention(false);
    setRetentionValue("0");
    setNetValueToReceive(String(row.value));

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setExpectedDueDate(defaultDate.toISOString().slice(0, 10));

    setTaxPercent("0");
    setInstallments("1");
    setPaymentMethod("PIX");
    setPaymentTerms(row.defaultPaymentTerms || "LIQUIDO_30");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setRegisterPdfDataUrl(undefined);
    setRegisterXmlDataUrl(undefined);
    setRegisterPdfName("");
    setRegisterXmlName("");
  };

  const handleGrossOrRetentionChange = (gross: number, ret: number, isRetActive: boolean) => {
    const calculatedNet = isRetActive ? Math.max(0, gross - ret) : gross;
    setNetValueToReceive(String(calculatedNet));
  };

  const registerExternalInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const invoiceValue = Number(registeredValue);
    const retVal = hasRetention ? Number(retentionValue) : 0;
    const netVal = Number(netValueToReceive);

    if (!registering || !invoiceCode.trim() || invoiceValue <= 0) {
      toast("Informe o número da NF e um valor bruto válido para a nota.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const result = await processBilling({
        osId: registering.id,
        invoiceCode: invoiceCode.trim(),
        totalValue: invoiceValue,
<<<<<<< HEAD
        retentionValue: retVal,
        netValueToReceive: netVal > 0 ? netVal : invoiceValue - retVal,
        expectedDueDate,
        installments: Number(installments) || 1,
        paymentMethod,
        notes: `Nota emitida. Pedido de compra: ${registering.purchaseOrder || "não informado"}. Valor Bruto OS: ${formatCurrency(invoiceValue)}. Retenção: ${formatCurrency(retVal)}. Líquido: ${formatCurrency(netVal)}.`,
=======
        taxPercent: Number(taxPercent) || 0,
        installments: Number(installments) || 1,
        paymentMethod,
        paymentTerms,
        issueDate,
        pdfDataUrl: registerPdfDataUrl,
        xmlDataUrl: registerXmlDataUrl,
        notes: `Nota emitida no sistema externo. Regra de Pagamento: ${getPaymentTermLabel(
          paymentTerms
        )}. Pedido de compra: ${registering.purchaseOrder || "não informado"}. Valor original da OS: ${formatCurrency(
          registering.value
        )}.`,
>>>>>>> a8487e3 (feat(faturamento): anexo de NF, prontuario com edicao de vencimento, regra Hering 60d/clientes e faturamento avulso)
        userId: user?.id || "",
      });
      if (!result.success) {
        toast(result.error || "Não foi possível registrar a nota.", "error");
        return;
      }
<<<<<<< HEAD
      toast("Nota fiscal confirmada e Contas a Receber gerado com o valor líquido e vencimento configurado!", "success");
=======
      toast("Nota fiscal registrada com anexo e contas a receber geradas com sucesso!", "success");
>>>>>>> a8487e3 (feat(faturamento): anexo de NF, prontuario com edicao de vencimento, regra Hering 60d/clientes e faturamento avulso)
      setRegistering(null);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const openDirectBilling = () => {
    setIsDirectBillingOpen(true);
    setDirectClientId(clientsList[0]?.id || "");
    setDirectServiceDescription("");
    setDirectInvoiceCode("");
    setDirectValue("");
    setDirectTaxPercent("0");
    setDirectInstallments("1");
    setDirectPaymentMethod("PIX");
    const defaultTerms = clientsList[0]?.defaultPaymentTerms || "LIQUIDO_30";
    setDirectPaymentTerms(defaultTerms);
    setDirectIssueDate(new Date().toISOString().slice(0, 10));
    setDirectPdfDataUrl(undefined);
    setDirectXmlDataUrl(undefined);
    setDirectPdfName("");
    setDirectXmlName("");
  };

  const handleDirectClientChange = (clientId: string) => {
    setDirectClientId(clientId);
    const selected = clientsList.find((c) => c.id === clientId);
    if (selected?.defaultPaymentTerms) {
      setDirectPaymentTerms(selected.defaultPaymentTerms);
    }
  };

  const handleDirectBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directClientId || !directInvoiceCode.trim() || !Number(directValue) || Number(directValue) <= 0) {
      toast("Preencha o cliente, código da NF e um valor válido.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const result = await processDirectBilling({
        clientId: directClientId,
        serviceDescription: directServiceDescription.trim() || "Serviço / Terceirização Direta",
        invoiceCode: directInvoiceCode.trim(),
        totalValue: Number(directValue),
        taxPercent: Number(directTaxPercent) || 0,
        installments: Number(directInstallments) || 1,
        paymentMethod: directPaymentMethod,
        paymentTerms: directPaymentTerms,
        issueDate: directIssueDate,
        pdfDataUrl: directPdfDataUrl,
        xmlDataUrl: directXmlDataUrl,
        userId: user?.id || "",
      });

      if (!result.success) {
        toast(result.error || "Não foi possível registrar o faturamento avulso.", "error");
        return;
      }

      toast("Faturamento avulso registrado com sucesso no contas a receber!", "success");
      setIsDirectBillingOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !rows.length && !invoices.length)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs font-semibold text-zinc-500">Montando espelho das notas...</p>
      </div>
    );

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="bg-[#090a0c] p-6 text-white">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                <FileSpreadsheet size={15} /> Espelho e Controle de Faturamento
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Prontuário de Faturamento & Baixa de Notas</h2>
              <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                Fature OS concluídas ou registre **Faturamento Avulso (sem OS)** para terceirização e vendas. Gerencie prontuários, altere vencimentos e dê baixa de pagamento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasPermission("faturamento.write") && (
                <Button variant="success" onClick={openDirectBilling}>
                  <PlusCircle size={15} /> Faturamento Avulso (sem OS)
                </Button>
              )}
              <Button variant="secondary" onClick={() => void loadData()}>
                <RefreshCw size={14} /> Atualizar
              </Button>
              {hasPermission("faturamento.write") && (
                <Button variant="primary" loading={actionLoading} onClick={exportSpreadsheet}>
                  <Download size={15} /> Baixar planilha ({selectedRows.length})
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 sm:grid-cols-4 sm:divide-y-0 dark:divide-zinc-800">
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Aguardando NF (com OS)</span>
            <strong className="mt-1 block text-xl">{rows.length} OS</strong>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Valor em Faturamento</span>
            <strong className="mt-1 block text-xl text-emerald-600">{formatCurrency(pendingValue)}</strong>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Prontuário / Registradas</span>
            <strong className="mt-1 block text-xl text-blue-600">{invoices.length}</strong>
          </div>
          <div className="p-4">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Faturamentos Avulsos</span>
            <strong className="mt-1 block text-xl text-purple-600">{monthlyStats.directCount}</strong>
          </div>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setActiveTab("mirror")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "mirror"
              ? "bg-[#d4af37] text-[#0b0c0e]"
              : "text-zinc-400 hover:bg-white/[.05] hover:text-white"
          }`}
        >
          Espelho das OS ({rows.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "history"
              ? "bg-[#d4af37] text-[#0b0c0e]"
              : "text-zinc-400 hover:bg-white/[.05] hover:text-white"
          }`}
        >
          Prontuário de NFs & Vistoria mensal ({invoices.length})
        </button>
      </div>

      {activeTab === "mirror" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-black">Fila de Ordens de Serviço a Faturar</h3>
              <p className="text-xs text-zinc-500">
                Confira os dados antes de gerar a nota ou exportar a planilha para emissão em lote.
              </p>
            </div>
            <div className="w-full sm:w-96">
              <Input
                placeholder="Buscar OS, pedido de compra, tomador ou documento"
                icon={<Search size={14} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {!rows.length ? (
            <div className="py-16 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-sm font-bold">Nenhuma OS aguardando nota</p>
              <p className="text-xs text-zinc-500">Quando uma OS for concluída, ela aparecerá aqui.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 xl:hidden">
                {filteredRows.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        className="mt-1"
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((item) => (item.id === row.id ? { ...item, selected: e.target.checked } : item))
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <strong className="text-sm">{row.code}</strong>
                            <p className="text-[10px] text-zinc-500">
                              Concluída {row.completedAt ? formatDate(row.completedAt) : ""}
                            </p>
                          </div>
                          {row.missingFields.length ? (
                            <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 dark:bg-orange-950/30">
                              <AlertTriangle size={11} /> Revisar {row.missingFields.length}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/30">
                              <Check size={11} /> Pronta
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-bold">{row.legalName}</h4>
                          {row.billingGroup && (
                            <span className="rounded bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                              {row.billingGroup}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-xs text-zinc-500">{cleanDocument(row.clientDocument)}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-zinc-400">Valor OS</span>
                            <strong>{formatCurrency(row.value)}</strong>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-zinc-400">Pedido de compra</span>
                            <span
                              className={
                                row.purchaseOrder
                                  ? "font-semibold text-blue-700 dark:text-blue-300"
                                  : "text-orange-600"
                              }
                            >
                              {row.purchaseOrder || "Não informado"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-zinc-400">Regra do Cliente</span>
                            <span>{getPaymentTermLabel(row.defaultPaymentTerms)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-zinc-400">CEP / Nº</span>
                            <span>
                              {row.cep || "—"} / {row.addressNumber || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-bold uppercase text-zinc-400">E-mail</span>
                            <span className="block truncate">{row.email}</span>
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {row.description || "Descrição opcional não informada"}
                        </div>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditing({ ...row })}>
                            <Pencil size={13} /> Revisar
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void copyRow(row)}>
                            <Clipboard size={13} /> Copiar
                          </Button>
                          {hasPermission("faturamento.write") && (
                            <Button size="sm" variant="primary" onClick={() => openRegister(row)}>
                              <Send size={13} /> Registrar NF
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[1660px] text-left">
                  <thead>
                    <tr className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/50">
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every((row) => row.selected)}
                          onChange={(e) =>
                            setRows((current) => current.map((row) => ({ ...row, selected: e.target.checked })))
                          }
                        />
                      </th>
                      <th className="px-3 py-3">OS / Situação</th>
                      <th className="px-3 py-3">Pedido de compra</th>
                      <th className="px-3 py-3">Razão social ou tomador *</th>
                      <th className="px-3 py-3">Regra Cliente / Grupo</th>
                      <th className="px-3 py-3">Valor</th>
                      <th className="px-3 py-3">Descrição</th>
                      <th className="px-3 py-3">CNAE</th>
                      <th className="px-3 py-3">E-mail</th>
                      <th className="px-3 py-3">CEP / Nº</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="align-top hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setRows((current) =>
                                current.map((item) => (item.id === row.id ? { ...item, selected: e.target.checked } : item))
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-4">
                          <strong className="block">{row.code}</strong>
                          <span className="text-[10px] text-zinc-500">
                            Concluída {row.completedAt ? formatDate(row.completedAt) : ""}
                          </span>
                          {row.missingFields.length ? (
                            <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-600">
                              <AlertTriangle size={11} /> Revisar {row.missingFields.length}
                            </span>
                          ) : (
                            <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <Check size={11} /> Pronta
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={
                              row.purchaseOrder
                                ? "font-semibold text-blue-700 dark:text-blue-300"
                                : "text-orange-600"
                            }
                          >
                            {row.purchaseOrder || "Não informado"}
                          </span>
                        </td>
                        <td className="max-w-64 px-3 py-4">
                          <strong className="block font-semibold">{row.legalName}</strong>
                          <span className="font-mono text-[10px] text-zinc-400">{cleanDocument(row.clientDocument)}</span>
                        </td>
                        <td className="px-3 py-4">
                          {row.billingGroup && (
                            <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                              {row.billingGroup}
                            </span>
                          )}
                          <span className="block text-[10px] text-zinc-500">
                            {getPaymentTermLabel(row.defaultPaymentTerms)}
                          </span>
                        </td>
                        <td className="px-3 py-4 font-bold">{formatCurrency(row.value)}</td>
                        <td className="max-w-72 px-3 py-4 text-zinc-600 dark:text-zinc-400">
                          {row.description || <span className="italic text-zinc-400">Opcional</span>}
                        </td>
                        <td className="px-3 py-4 font-mono">{row.cnae || <span className="text-zinc-400">Principal</span>}</td>
                        <td
                          className={`max-w-64 px-3 py-4 ${
                            row.email.endsWith("@importado.local") ? "text-orange-600" : ""
                          }`}
                        >
                          {row.email}
                        </td>
                        <td className="px-3 py-4 font-mono">
                          {row.cep || "—"} / {row.addressNumber || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditing({ ...row })}
                              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                              title="Revisar dados"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => void copyRow(row)}
                              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                              title="Copiar linha"
                            >
                              <Clipboard size={14} />
                            </button>
                            {hasPermission("faturamento.write") && (
                              <button
                                onClick={() => openRegister(row)}
                                className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
                                title="Registrar nota emitida com anexo"
                              >
                                <Send size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 lg:flex-row lg:items-center lg:justify-between dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-[#d4af37]" />
                <h3 className="text-sm font-black">Prontuário de NFs Emitidas & Vistoria Mensal</h3>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Altere datas de vencimento, consulte prontuários de faturamento, dê baixa em recebimentos e baixe comprovantes (PDF/XML).
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Buscar NF, cliente, OS ou pedido"
                  icon={<Search size={14} />}
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
              </div>
              <Select
                value={issueMonthFilter}
                onChange={(e) => setIssueMonthFilter(e.target.value)}
                options={[
                  { value: "TODOS", label: "Todos os meses de emissão" },
                  ...availableMonths.map((m) => {
                    const [yyyy, mm] = m.split("-");
                    return { value: m, label: `Mês ${mm}/${yyyy}` };
                  }),
                ]}
              />
              <Select
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value)}
                options={[
                  { value: "TODOS", label: "Todos os status" },
                  { value: "EMITIDA", label: "Emitidas" },
                  { value: "ENVIADA", label: "Enviadas / Baixadas" },
                  { value: "CANCELADA", label: "Canceladas" },
                  { value: "SUBSTITUIDA", label: "Substituídas" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 border-b border-zinc-100 sm:grid-cols-5 sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800">
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Notas no filtro</p>
              <p className="mt-1 text-xl font-black">{filteredInvoices.length}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Total Faturado</p>
              <p className="mt-1 text-xl font-black text-emerald-600">{formatCurrency(monthlyStats.totalBilled)}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Total Impostos</p>
              <p className="mt-1 text-xl font-black text-amber-600">{formatCurrency(monthlyStats.totalTax)}</p>
            </div>
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase text-zinc-500">PDFs / XMLs Anexados</p>
              <p className="mt-1 text-xl font-black text-blue-500">
                {monthlyStats.withPdf} PDF / {monthlyStats.withXml} XML
              </p>
            </div>
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Faturamentos Avulsos</p>
              <p className="mt-1 text-xl font-black text-purple-600">{monthlyStats.directCount} sem OS</p>
            </div>
          </div>

          {filteredInvoices.length ? (
            <Table
              headers={[
                "Nota / Status",
                "Tomador / Grupo",
                "OS / Origem",
                "Valor & Impostos",
                "Emissão & Regra",
                "Vencimento / Baixa",
                "Comprovantes NF",
                "Ações / Prontuário",
              ]}
            >
              {filteredInvoices.map((invoice) => {
                const firstReceivable = invoice.receivables && invoice.receivables[0];
                const isPaid = firstReceivable?.status === "PAGO";
                const dueDateFormatted = firstReceivable?.dueDate
                  ? formatDate(firstReceivable.dueDate)
                  : "—";

                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <strong className="block font-mono text-sm">{invoice.code}</strong>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-500"
                            : invoice.status === "CANCELADA"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-[#d4af37]/10 text-[#b88d1b]"
                        }`}
                      >
                        {isPaid ? "PAGO / QUITADO" : invoice.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <strong className="block text-xs">{invoice.client?.name || "—"}</strong>
                      {invoice.client?.billingGroup && (
                        <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[8px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          {invoice.client.billingGroup}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {invoice.serviceOrder ? (
                        <>
                          <strong className="block text-xs">{invoice.serviceOrder.code}</strong>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {invoice.serviceOrder.purchaseOrder || "Sem pedido"}
                          </p>
                        </>
                      ) : (
                        <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          Avulso / sem OS
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <strong>{formatCurrency(invoice.value)}</strong>
                      <p className="text-[10px] text-zinc-500">Imposto {formatCurrency(invoice.taxValue)}</p>
                    </TableCell>
                    <TableCell>
                      <span className="block text-xs font-semibold">
                        {formatDate(invoice.issueDate || invoice.createdAt)}
                      </span>
                      <span className="mt-0.5 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {getPaymentTermLabel(invoice.paymentTerms)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className={isPaid ? "text-emerald-500" : "text-blue-500"} />
                        <strong
                          className={`text-xs ${
                            isPaid ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {dueDateFormatted}
                        </strong>
                      </div>
                      {isPaid && firstReceivable?.paymentDate && (
                        <span className="mt-0.5 block text-[8px] font-bold text-emerald-600">
                          Pago em {formatDate(firstReceivable.paymentDate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {invoice.pdfUrl ? (
                          <a
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-blue-950/30"
                            href={invoice.pdfUrl}
                          >
                            <FileText size={12} /> PDF
                          </a>
                        ) : (
                          <span className="text-[10px] text-orange-500">Sem PDF</span>
                        )}
                        {invoice.xmlUrl ? (
                          <a
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-bold text-[#b88d1b] hover:bg-amber-50 dark:border-zinc-700 dark:hover:bg-amber-950/30"
                            href={invoice.xmlUrl}
                          >
                            <FileCode2 size={12} /> XML
                          </a>
                        ) : (
                          <span className="text-[10px] text-orange-500">Sem XML</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {hasPermission("faturamento.write") && (
                          <Button size="sm" variant="secondary" onClick={() => openProntuario(invoice)}>
                            <Pencil size={12} /> Prontuário
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          ) : (
            <div className="py-14 text-center text-xs text-zinc-500">
              Nenhuma nota fiscal encontrada para os filtros selecionados.
            </div>
          )}
        </Card>
      )}

      {/* Modal de Faturamento Avulso / Direto (sem OS) */}
      <Modal
        isOpen={isDirectBillingOpen}
        onClose={() => setIsDirectBillingOpen(false)}
        title="Novo Faturamento Avulso / Direto (sem OS)"
        size="xl"
      >
        <form onSubmit={handleDirectBillingSubmit} className="space-y-5">
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-xs text-purple-900 dark:border-purple-950 dark:bg-purple-950/30 dark:text-purple-200">
            <strong>Faturamento Direto sem Ordem de Serviço</strong>
            <p className="mt-1">
              Use esta opção para faturar serviços de terceirização, consultoria ou itens diretos que não possuem OS cadastrada. O ERP criará o contas a receber e armazenará a NF no prontuário.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Cliente / Tomador *"
              required
              value={directClientId}
              onChange={(e) => handleDirectClientChange(e.target.value)}
              options={clientsList.map((c) => ({
                value: c.id,
                label: `${c.name} ${c.billingGroup ? `(${c.billingGroup})` : ""}`,
              }))}
            />
            <Input
              label="Código / Número da Nota Fiscal *"
              required
              placeholder="Ex: NF-9982"
              value={directInvoiceCode}
              onChange={(e) => setDirectInvoiceCode(e.target.value)}
            />
          </div>

          <Input
            label="Descrição do Serviço / Item Terceirizado *"
            required
            placeholder="Ex: Prestação de serviço de climatização terceirizada filial Sul"
            value={directServiceDescription}
            onChange={(e) => setDirectServiceDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Valor Total (R$) *"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={directValue}
              onChange={(e) => setDirectValue(e.target.value)}
            />
            <Input
              label="Imposto Retido (%)"
              type="number"
              step="0.1"
              value={directTaxPercent}
              onChange={(e) => setDirectTaxPercent(e.target.value)}
            />
            <Select
              label="Parcelas"
              value={directInstallments}
              onChange={(e) => setDirectInstallments(e.target.value)}
              options={[
                { value: "1", label: "1 parcela" },
                { value: "2", label: "2 parcelas" },
                { value: "3", label: "3 parcelas" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Data de Emissão *"
              type="date"
              required
              value={directIssueDate}
              onChange={(e) => setDirectIssueDate(e.target.value)}
            />
            <Select
              label="Regra de Pagamento *"
              value={directPaymentTerms}
              onChange={(e) => setDirectPaymentTerms(e.target.value)}
              options={PAYMENT_TERM_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
            <Select
              label="Forma de Pagamento"
              value={directPaymentMethod}
              onChange={(e) => setDirectPaymentMethod(e.target.value)}
              options={[
                { value: "PIX", label: "PIX" },
                { value: "BOLETO", label: "Boleto Bancário" },
                { value: "TRANSFERENCIA", label: "Transferência" },
                { value: "CARTAO", label: "Cartão de Crédito" },
              ]}
            />
          </div>

          {directPreviewDueDate && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 flex items-center gap-2">
              <Calendar size={14} className="text-blue-600" />
              <span>
                Vencimento calculado: <strong>{formatDate(directPreviewDueDate)}</strong> ({getPaymentTermLabel(directPaymentTerms)})
              </span>
            </div>
          )}

          {/* Anexos de PDF/XML no faturamento avulso */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="group cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center transition hover:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800">
              <FileText className="mx-auto text-blue-500" size={18} />
              <p className="mt-1 text-xs font-bold">Anexar DANFE (PDF)</p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">{directPdfName || "Selecione PDF (opcional)"}</p>
              <input
                className="hidden"
                type="file"
                accept="application/pdf,.pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setDirectPdfDataUrl(await fileToDataUrl(file, ["application/pdf"]));
                    setDirectPdfName(file.name);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "PDF inválido", "error");
                  }
                }}
              />
            </label>

            <label className="group cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center transition hover:border-[#d4af37] dark:border-zinc-700 dark:bg-zinc-800">
              <FileCode2 className="mx-auto text-[#d4af37]" size={18} />
              <p className="mt-1 text-xs font-bold">Anexar XML</p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">{directXmlName || "Selecione XML (opcional)"}</p>
              <input
                className="hidden"
                type="file"
                accept="application/xml,text/xml,.xml"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setDirectXmlDataUrl(await fileToDataUrl(file, ["application/xml", "text/xml"]));
                    setDirectXmlName(file.name);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "XML inválido", "error");
                  }
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button type="button" variant="secondary" onClick={() => setIsDirectBillingOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" loading={actionLoading}>
              <Receipt size={14} /> Faturar e Gerar Recebimento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Prontuário de Faturamento, Edição de Vencimento e Quitação */}
      <Modal
        isOpen={Boolean(prontuarioInvoice)}
        onClose={() => setProntuarioInvoice(null)}
        title="Prontuário de Faturamento & Edição de Vencimento"
        size="xl"
      >
        {prontuarioInvoice && (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Prontuário Fiscal</span>
                  <strong className="block text-base font-black">{prontuarioInvoice.code}</strong>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                    Cliente: {prontuarioInvoice.client?.name} · {prontuarioInvoice.serviceOrder ? `OS ${prontuarioInvoice.serviceOrder.code}` : "Faturamento Avulso"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valor Total</span>
                  <strong className="block text-base font-black text-emerald-600">
                    {formatCurrency(prontuarioInvoice.value)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Quitação Rápida / Dar Baixa no Recebimento */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3 dark:border-emerald-950 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <DollarSign size={16} />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Dar Baixa no Recebimento / Marcar como Pago</h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  Status Atual: {prontuarioInvoice.receivables?.[0]?.status || "ABERTO"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  label="Data do Pagamento Efetivo"
                  type="date"
                  value={payDateModal}
                  onChange={(e) => setPayDateModal(e.target.value)}
                />
                <Select
                  label="Meio de Pagamento"
                  value={payMethodModal}
                  onChange={(e) => setPayMethodModal(e.target.value)}
                  options={[
                    { value: "PIX", label: "PIX" },
                    { value: "BOLETO", label: "Boleto Bancário" },
                    { value: "TRANSFERENCIA", label: "Transferência" },
                    { value: "CARTAO", label: "Cartão de Crédito" },
                  ]}
                />
                <div className="flex items-end">
                  <Button variant="success" className="w-full" loading={actionLoading} onClick={handlePayInvoice}>
                    <CheckCircle2 size={14} /> Quitar / Baixar Título
                  </Button>
                </div>
              </div>
            </div>

            {/* Formulário de Edição do Prontuário & Alteração de Vencimento */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300">
                Ajustar Informações & Vencimento Customizado
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Código da Nota Fiscal"
                  value={editProntuarioCode}
                  onChange={(e) => setEditProntuarioCode(e.target.value)}
                />
                <Input
                  label="Valor da Nota (R$)"
                  type="number"
                  step="0.01"
                  value={editProntuarioValue}
                  onChange={(e) => setEditProntuarioValue(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Data de Emissão da NF"
                  type="date"
                  value={editProntuarioIssueDate}
                  onChange={(e) => setEditProntuarioIssueDate(e.target.value)}
                />
                <Select
                  label="Regra de Pagamento"
                  value={editProntuarioPaymentTerms}
                  onChange={(e) => setEditProntuarioPaymentTerms(e.target.value)}
                  options={PAYMENT_TERM_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
                <Input
                  label="Vencimento Customizado (Sobrescrever)"
                  type="date"
                  value={editProntuarioCustomDueDate}
                  onChange={(e) => setEditProntuarioCustomDueDate(e.target.value)}
                />
              </div>

              {prontuarioPreviewDueDate && (
                <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 flex items-center gap-2 dark:bg-zinc-800 dark:text-zinc-200">
                  <Calendar size={14} className="text-blue-500" />
                  <span>
                    Nova Data de Vencimento recalculada: <strong>{formatDate(prontuarioPreviewDueDate)}</strong>
                  </span>
                </div>
              )}

              <Textarea
                label="Observações / Histórico do Prontuário"
                rows={2}
                value={editProntuarioNotes}
                onChange={(e) => setEditProntuarioNotes(e.target.value)}
                placeholder="Anotações sobre negociação, alterações de prazo ou tratativa com cliente..."
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button variant="secondary" onClick={() => setProntuarioInvoice(null)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={actionLoading} onClick={saveProntuarioChanges}>
                <Pencil size={14} /> Salvar Alterações no Prontuário
              </Button>
            </div>
          </div>
<<<<<<< HEAD

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Número / código da NF emitida *" required placeholder="Ex: 12345" value={invoiceCode} onChange={(e) => setInvoiceCode(e.target.value)} />
            <Input
              label="Valor Bruto da OS / NF (R$) *"
              required
              min="0.01"
              step="0.01"
              type="number"
              value={registeredValue}
              onChange={(e) => {
                const val = e.target.value;
                setRegisteredValue(val);
                handleGrossOrRetentionChange(Number(val), Number(retentionValue), hasRetention);
              }}
            />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#12151d] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-200 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasRetention}
                  onChange={(e) => {
                    const active = e.target.checked;
                    setHasRetention(active);
                    handleGrossOrRetentionChange(Number(registeredValue), Number(retentionValue), active);
                  }}
                  className="rounded border-zinc-700 bg-zinc-900 text-[#d4af37] focus:ring-[#d4af37]"
                />
                <span>Haverá retenção de impostos na fonte? (INSS / ISS / IRRF / PIS / COFINS)</span>
              </label>
            </div>

            {hasRetention && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input
                  label="Valor da Retenção (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={retentionValue}
                  onChange={(e) => {
                    const ret = e.target.value;
                    setRetentionValue(ret);
                    handleGrossOrRetentionChange(Number(registeredValue), Number(ret), true);
                  }}
                  placeholder="0,00"
                />
                <Input
                  label="Valor Líquido a Receber (R$) *"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={netValueToReceive}
                  onChange={(e) => setNetValueToReceive(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}

            {!hasRetention && (
              <p className="text-[11px] text-zinc-400">
                Sem retenções fiscais salvas. O valor líquido a receber no Contas a Receber será <strong className="text-emerald-400">{formatCurrency(Number(registeredValue) || 0)}</strong>.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Data Prevista a Receber *"
              type="date"
              required
              value={expectedDueDate}
              onChange={(e) => setExpectedDueDate(e.target.value)}
            />
            <Select
              label="Parcelas"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              options={[
                { value: "1", label: "1 parcela (À vista / 30 dias)" },
                { value: "2", label: "2 parcelas" },
                { value: "3", label: "3 parcelas" },
                { value: "4", label: "4 parcelas" },
              ]}
            />
            <Select
              label="Forma de pagamento"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={[
                { value: "PIX", label: "PIX" },
                { value: "BOLETO", label: "Boleto bancário" },
                { value: "TRANSFERENCIA", label: "Transferência bancária" },
                { value: "CARTAO", label: "Cartão de crédito" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button type="button" variant="secondary" onClick={() => setRegistering(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" loading={actionLoading}>
              <Receipt size={14} /> Confirmar NF & Liberar Contas a Receber
            </Button>
          </div>
        </form>}
      </Modal>

      <Modal isOpen={Boolean(documentInvoice)} onClose={() => setDocumentInvoice(null)} title="Arquivar documentos da nota" size="lg">
        {documentInvoice && <div className="space-y-5">
          <div className="rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-[#b88d1b]">Nota fiscal</p><p className="mt-1 text-lg font-black">{documentInvoice.code}</p><p className="mt-1 text-xs text-zinc-500">{documentInvoice.client?.name} · {documentInvoice.serviceOrder?.code}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="group cursor-pointer rounded-2xl border border-dashed border-zinc-300 p-5 text-center transition hover:border-blue-500 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:bg-blue-950/10"><FileText className="mx-auto text-blue-500"/><p className="mt-3 text-xs font-black">PDF / DANFE / NFS-e</p><p className="mt-1 truncate text-[10px] text-zinc-500">{pdfName || (documentInvoice.pdfUrl ? "PDF já armazenado · selecione para substituir" : "Selecione um PDF de até 4 MB")}</p><input className="hidden" type="file" accept="application/pdf,.pdf" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;try{setPdfDataUrl(await fileToDataUrl(file,["application/pdf"]));setPdfName(file.name)}catch(error){toast(error instanceof Error?error.message:"Arquivo inválido","error")}}}/></label>
            <label className="group cursor-pointer rounded-2xl border border-dashed border-zinc-300 p-5 text-center transition hover:border-[#d4af37] hover:bg-[#d4af37]/5 dark:border-zinc-700"><FileCode2 className="mx-auto text-[#d4af37]"/><p className="mt-3 text-xs font-black">XML da nota fiscal</p><p className="mt-1 truncate text-[10px] text-zinc-500">{xmlName || (documentInvoice.xmlUrl ? "XML já armazenado · selecione para substituir" : "Selecione um XML de até 4 MB")}</p><input className="hidden" type="file" accept="application/xml,text/xml,.xml" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;try{setXmlDataUrl(await fileToDataUrl(file,["application/xml","text/xml"]));setXmlName(file.name)}catch(error){toast(error instanceof Error?error.message:"Arquivo inválido","error")}}}/></label>
=======
        )}
      </Modal>

      {/* Modal de Revisar Dados do Espelho */}
      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Revisar dados do espelho" size="xl">
        {editing && (
          <div className="space-y-5">
            <div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              <strong>{editing.code}</strong> · As alterações serão salvas na OS e reutilizadas no espelho e nas próximas exportações.
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <Input
                label="Pedido de compra / PO do cliente"
                maxLength={120}
                placeholder="Ex: PC-45872, PO-2026-118 ou autorização do cliente"
                value={editing.purchaseOrder}
                onChange={(e) => updatePurchaseOrder(e.target.value)}
              />
              <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-300">
                Ao informar o pedido, a descrição fiscal é atualizada automaticamente com o pedido, o orçamento e o resumo do serviço.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Razão social ou Nome do tomador *"
                value={editing.legalName}
                onChange={(e) => updateEditing("legalName", e.target.value)}
              />
              <Input
                label="CPF/CNPJ *"
                value={editing.clientDocument}
                onChange={(e) => updateEditing("clientDocument", e.target.value)}
              />
              <Input
                label="Valor *"
                type="number"
                value={editing.value}
                onChange={(e) =>
                  setEditing((current) => (current ? { ...current, value: Number(e.target.value) || 0 } : current))
                }
              />
              <Input
                label="CNAE (somente números, opcional)"
                value={editing.cnae}
                onChange={(e) => updateEditing("cnae", e.target.value)}
              />
              <Input
                label="E-mail"
                type="email"
                value={editing.email}
                onChange={(e) => updateEditing("email", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="CEP" value={editing.cep} onChange={(e) => updateEditing("cep", e.target.value)} />
                <Input label="Número" value={editing.addressNumber} onChange={(e) => updateEditing("addressNumber", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Descrição fiscal resumida</p>
                  <p className="text-[10px] text-zinc-500">
                    Orçamento: {editing.quoteCode || "não vinculado"} · OS: {editing.code}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                  onClick={() =>
                    setEditing((current) =>
                      current ? { ...current, description: automaticDescriptionFor(current) } : current
                    )
                  }
                >
                  Gerar resumo automático
                </button>
              </div>
              <Textarea
                rows={3}
                maxLength={240}
                value={editing.description}
                onChange={(e) => updateEditing("description", e.target.value)}
                hint={`${editing.description.length}/240 caracteres · Esta é a descrição enviada para a planilha fiscal.`}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={actionLoading} onClick={() => void saveEditing()}>
                Salvar informações fiscais
              </Button>
            </div>
>>>>>>> a8487e3 (feat(faturamento): anexo de NF, prontuario com edicao de vencimento, regra Hering 60d/clientes e faturamento avulso)
          </div>
        )}
      </Modal>

      {/* Modal Completo de Dar Baixa Fiscal e Registrar NF com Anexo */}
      <Modal
        isOpen={Boolean(registering)}
        onClose={() => setRegistering(null)}
        title="Dar Baixa Fiscal & Registrar Nota Fiscal Emitida"
        size="xl"
      >
        {registering && (
          <form onSubmit={registerExternalInvoice} className="space-y-5">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300">
              <strong>{registering.code} · {registering.legalName}</strong>
              <p className="mt-1">
                Registre a nota fiscal emitida, anexe o comprovante (PDF/XML) e selecione a regra de pagamento para gerar as contas a receber com os vencimentos exatos.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Número / Código da NF emitida *"
                required
                placeholder="Ex: 12345"
                value={invoiceCode}
                onChange={(e) => setInvoiceCode(e.target.value)}
              />
              <Input
                label="Valor Efetivo da Nota (R$) *"
                required
                min="0.01"
                step="0.01"
                type="number"
                value={registeredValue}
                onChange={(e) => setRegisteredValue(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Data de Emissão da NF *"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
              <Select
                label="Forma / Regra de Vencimento *"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                options={PAYMENT_TERM_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            {previewDueDate && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                <div className="flex items-center gap-2 font-bold">
                  <Calendar size={15} className="text-blue-600" />
                  Data de Vencimento Estimada: {formatDate(previewDueDate)}
                </div>
                <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
                  {paymentTerms === "HERING_60" ? (
                    <span>
                      ⭐ <strong>Regra Especial Hering 60d:</strong> Notas até dia 10 pagas no dia 10. Notas após dia 10 pagas no dia 25 (após 60d).
                    </span>
                  ) : (
                    <span>
                      Vencimento calculado com base em <strong>{getPaymentTermLabel(paymentTerms)}</strong>.
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Imposto Total Retido (%)"
                type="number"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
              />
              <Select
                label="Parcelamento"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                options={[
                  { value: "1", label: "1 parcela" },
                  { value: "2", label: "2 parcelas" },
                  { value: "3", label: "3 parcelas" },
                ]}
              />
              <Select
                label="Meio de Recebimento"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: "PIX", label: "PIX" },
                  { value: "BOLETO", label: "Boleto Bancário" },
                  { value: "TRANSFERENCIA", label: "Transferência" },
                  { value: "CARTAO", label: "Cartão de Crédito" },
                ]}
              />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-blue-600" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Anexo da Nota Fiscal (DANFE PDF & XML)
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="group cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-white p-3.5 text-center transition hover:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800">
                  <FileText className="mx-auto text-blue-500" size={20} />
                  <p className="mt-2 text-xs font-bold">Anexar DANFE / PDF</p>
                  <p className="mt-1 truncate text-[10px] text-zinc-500">
                    {registerPdfName || "Selecione arquivo PDF (até 4 MB)"}
                  </p>
                  <input
                    className="hidden"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setRegisterPdfDataUrl(await fileToDataUrl(file, ["application/pdf"]));
                        setRegisterPdfName(file.name);
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Arquivo PDF inválido", "error");
                      }
                    }}
                  />
                </label>

                <label className="group cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-white p-3.5 text-center transition hover:border-[#d4af37] dark:border-zinc-700 dark:bg-zinc-800">
                  <FileCode2 className="mx-auto text-[#d4af37]" size={20} />
                  <p className="mt-2 text-xs font-bold">Anexar XML da NF</p>
                  <p className="mt-1 truncate text-[10px] text-zinc-500">
                    {registerXmlName || "Selecione arquivo XML (até 4 MB)"}
                  </p>
                  <input
                    className="hidden"
                    type="file"
                    accept="application/xml,text/xml,.xml"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setRegisterXmlDataUrl(await fileToDataUrl(file, ["application/xml", "text/xml"]));
                        setRegisterXmlName(file.name);
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Arquivo XML inválido", "error");
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setRegistering(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="success" loading={actionLoading}>
                <Receipt size={14} /> Dar Baixa e Salvar Nota
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
