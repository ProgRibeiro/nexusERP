"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  getClientDetails,
  updateClient,
  consultarCNPJAction,
  addClientContact,
  addClientAddress,
  addClientEquipment,
  ClientDetailsDTO
} from "@/app/actions/clientActions";
import { exportClientData, anonymizeClient } from "@/app/actions/lgpdActions";
import { formatCurrency, formatCpfCnpj, formatPhone, formatDate, formatDateTime } from "@/lib/utils";
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Laptop,
  History,
  PlusCircle,
  Plus,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Wrench,
  FileText,
  DollarSign,
  Receipt,
  User,
  ExternalLink,
  Download,
  ShieldAlert,
  ShieldCheck,
  FileSignature,
  Camera,
  Package,
  ClipboardList,
  Image as ImageIcon,
  Calendar,
  CheckCircle2,
  Clock3,
  Pencil
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { StatusBadge } from "../ui/StatusBadge";
import { Table, TableRow, TableCell } from "../ui/Table";

interface ClienteDetailTabProps {
  id: string;
}

export default function ClienteDetailTab({ id }: ClienteDetailTabProps) {
  const { hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [details, setDetails] = useState<ClientDetailsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"central" | "resumo" | "contacts" | "addresses" | "equipments" | "quotes" | "os" | "financeiro" | "fiscal" | "history">("resumo");
  const [centralTab, setCentralTab] = useState<"pendencias" | "patrimonio" | "preventivas">("pendencias");

  // Creation modals
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  // Forms
  const [contactForm, setContactForm] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    whatsapp: "",
    isFinancial: false,
    isTechnical: false,
    isApproval: false,
  });

  const [addressForm, setAddressForm] = useState({
    label: "Instalação",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "SP",
    cep: "",
    reference: "",
  });

  const [equipmentForm, setEquipmentForm] = useState({
    type: "Ar Condicionado Split",
    brand: "",
    model: "",
    serialNumber: "",
    capacity: "",
    tag: "",
    location: "",
    notes: "",
  });

  const [editClientForm, setEditClientForm] = useState({
    name: "",
    socialName: "",
    fancyName: "",
    cpfCnpj: "",
    stateRegistration: "",
    municipalRegistration: "",
    email: "",
    phone: "",
    whatsapp: "",
    segment: "",
    origin: "",
    notes: "",
  });

  async function loadDetails() {
    setLoading(true);
    try {
      const data = await getClientDetails(id);
      setDetails(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar prontuário do cliente", "error");
    } finally {
      setLoading(false);
    }
  }

  // LGPD Compliance States & Actions
  const [lgpdExporting, setLgpdExporting] = useState(false);
  const [lgpdAnonymizing, setLgpdAnonymizing] = useState(false);

  const handleExportLgpd = async () => {
    setLgpdExporting(true);
    try {
      const res = await exportClientData(id);
      if (res.success && res.data) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `prontuario-lgpd-${res.data.cpfCnpj || id}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast("Prontuário de dados LGPD exportado com sucesso!", "success");
      } else {
        toast(res.error || "Erro ao exportar prontuário", "error");
      }
    } catch (err) {
      toast("Erro de conexão ao exportar dados", "error");
    } finally {
      setLgpdExporting(false);
    }
  };

  const handleAnonymizeLgpd = async () => {
    if (!confirm("⚠️ ATENÇÃO: Esta ação é irreversível e irá mascarar permanentemente todos os dados pessoais do cliente em conformidade com a LGPD. Deseja continuar?")) {
      return;
    }

    setLgpdAnonymizing(true);
    try {
      const res = await anonymizeClient(id);
      if (res.success) {
        toast("Dados do cliente anonimizados com sucesso!", "success");
        loadDetails();
      } else {
        toast(res.error || "Erro ao anonimizar cliente", "error");
      }
    } catch (err) {
      toast("Erro de conexão ao anonimizar cliente", "error");
    } finally {
      setLgpdAnonymizing(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  const openEditClient = () => {
    if (!details) return;
    setEditClientForm({
      name: details.name || "",
      socialName: details.socialName || "",
      fancyName: details.fancyName || "",
      cpfCnpj: details.cpfCnpj || "",
      stateRegistration: details.stateRegistration || "",
      municipalRegistration: details.municipalRegistration || "",
      email: details.email || "",
      phone: details.phone || "",
      whatsapp: details.whatsapp || "",
      segment: details.segment || "",
      origin: details.origin || "",
      notes: details.notes || "",
    });
    setIsEditClientOpen(true);
  };

  const handleEditCnpjSearch = async () => {
    const document = editClientForm.cpfCnpj.replace(/\D/g, "");
    if (document.length !== 14) {
      toast(document.length === 11 ? "A busca automática está disponível apenas para CNPJ." : "Digite os 14 números do CNPJ.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const result = await consultarCNPJAction(document);
      if (!result.success || !result.data) {
        toast(result.error || "CNPJ não localizado.", "warning");
        return;
      }
      setEditClientForm((current) => ({
        ...current,
        cpfCnpj: result.data!.cnpj,
        name: result.data!.tradeName || result.data!.corporateName || current.name,
        socialName: result.data!.corporateName || current.socialName,
        fancyName: result.data!.tradeName || current.fancyName,
        email: result.data!.email || current.email,
        phone: result.data!.phone || current.phone,
      }));
      toast("Dados do CNPJ preenchidos. Confira e salve o cadastro.", "success");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleUpdateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const result = await updateClient({ id, ...editClientForm });
      if (!result.success) {
        toast(result.error || "Não foi possível atualizar o cliente.", "error");
        return;
      }
      setIsEditClientOpen(false);
      await loadDetails();
      toast("Cadastro do cliente atualizado.", "success");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.phone) return;

    setActionLoading(true);
    try {
      const res = await addClientContact({ clientId: id, ...contactForm });
      if (res.success) {
        toast("Contato adicionado com sucesso!", "success");
        setIsAddContactOpen(false);
        setContactForm({
          name: "",
          role: "",
          email: "",
          phone: "",
          whatsapp: "",
          isFinancial: false,
          isTechnical: false,
          isApproval: false,
        });
        loadDetails();
      } else {
        toast(res.error || "Erro ao adicionar contato", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressForm.street || !addressForm.number || !addressForm.city) return;

    setActionLoading(true);
    try {
      const res = await addClientAddress({ clientId: id, ...addressForm });
      if (res.success) {
        toast("Endereço adicionado com sucesso!", "success");
        setIsAddAddressOpen(false);
        setAddressForm({
          label: "Instalação",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "SP",
          cep: "",
          reference: "",
        });
        loadDetails();
      } else {
        toast(res.error || "Erro ao adicionar endereço", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.brand || !equipmentForm.model) return;

    setActionLoading(true);
    try {
      const res = await addClientEquipment({ clientId: id, ...equipmentForm });
      if (res.success) {
        toast("Máquina adicionada com sucesso!", "success");
        setIsAddEquipmentOpen(false);
        setEquipmentForm({
          type: "Ar Condicionado Split",
          brand: "",
          model: "",
          serialNumber: "",
          capacity: "",
          tag: "",
          location: "",
          notes: "",
        });
        loadDetails();
      } else {
        toast(res.error || "Erro ao adicionar equipamento", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold animate-pulse">Carregando prontuário do cliente...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <Card className="p-12 text-center text-zinc-400">
        <AlertTriangle size={36} className="mx-auto text-danger mb-3" />
        <p className="text-sm font-semibold">Cliente não encontrado</p>
      </Card>
    );
  }

  // Calculate quick metrics
  const totalInvoiced = details.serviceOrders
    .filter((o) => o.status === "CONCLUIDA" || o.status === "CONCLUIDO" || o.status === "FATURADA" || o.status === "PAGO")
    .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  const openBalance = details.receivables
    .filter((r) => r.status === "PENDENTE" || r.status === "VENCIDO")
    .reduce((acc, curr) => acc + (curr.value || 0), 0);
  const totalOSCount = details.serviceOrders.length;

  const isInadimplente = details.receivables.some((r) => r.status === "VENCIDO");
  const primaryAddress = details.addresses[0];
  const activeContract = details.contracts.find((contract: any) => contract.status === "ATIVO") || details.contracts[0];
  const completedStatuses = new Set([
    "CONCLUIDA",
    "CONCLUIDO",
    "RELATORIO_ENVIADO",
    "FATURAMENTO",
    "FATURADA",
    "PAGO",
    "CANCELADA",
  ]);
  const activeOrders = details.serviceOrders.filter((order: any) => !completedStatuses.has(order.status));
  const preventiveOrders = details.serviceOrders.filter((order: any) => order.type === "PREVENTIVA");
  const lastPreventive = preventiveOrders.find((order: any) => completedStatuses.has(order.status)) || preventiveOrders[0];

  const getChecklistCount = (checklistJson?: string) => {
    if (!checklistJson) return 0;
    try {
      const checklist = JSON.parse(checklistJson);
      return Array.isArray(checklist)
        ? checklist.filter((item) => item?.checked || item?.completed || item?.value === true).length
        : 0;
    } catch {
      return 0;
    }
  };

  const getOrderState = (status: string) => {
    if (completedStatuses.has(status)) {
      return {
        label: "Resolvida",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
        icon: CheckCircle2,
      };
    }
    if (["DESLOCAMENTO", "EXECUCAO", "PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE", "RETORNO"].includes(status)) {
      return {
        label: "Em andamento",
        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
        icon: Clock3,
      };
    }
    return {
      label: "Aberta",
      className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
      icon: AlertTriangle,
    };
  };

  const formatAddress = (address: any) =>
    address
      ? `${address.street}, ${address.number}${address.complement ? `, ${address.complement}` : ""} · ${address.neighborhood} · ${address.city}/${address.state}`
      : "Nenhum endereço cadastrado";

  const getRecentHistory = () => {
    const items: { title: string; subtitle: string; date: Date; badge: string; badgeColor: string }[] = [];

    details.serviceOrders?.forEach((os: any) => {
      items.push({
        title: `Ordem de Serviço ${os.code}`,
        subtitle: `Status: ${os.status} • Diagnóstico: ${os.diagnostic || "Sem diagnóstico"}`,
        date: new Date(os.createdAt),
        badge: "OS",
        badgeColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
      });
    });

    details.quotes?.forEach((q: any) => {
      items.push({
        title: `Orçamento ${q.code}`,
        subtitle: `Valor: ${formatCurrency(q.total)} • Status: ${q.status}`,
        date: new Date(q.createdAt),
        badge: "Orçamento",
        badgeColor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
      });
    });

    details.receivables?.forEach((r: any) => {
      items.push({
        title: `Conta a Receber: ${r.description || "Cobrança"}`,
        subtitle: `Valor: ${formatCurrency(r.amount || r.value || 0)} • Vencimento: ${formatDate(r.dueDate)} (${r.status})`,
        date: new Date(r.dueDate),
        badge: "Financeiro",
        badgeColor: r.status === "VENCIDO" ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" : "bg-zinc-100 dark:bg-zinc-800/30 text-zinc-800 dark:text-zinc-300",
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none animate-in fade-in duration-200">

      {/* LEFT COLUMN: Client Summary Profile Card (4/12) */}
      <div className={`${subTab === "central" ? "hidden" : "lg:col-span-4"} space-y-6`}>
        <Card className="flex flex-col items-center text-center gap-4 relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center border border-primary/20">
            {details.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-base text-zinc-900 dark:text-white leading-tight">{details.name}</h3>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1 font-semibold">{formatCpfCnpj(details.cpfCnpj)}</p>
          </div>

          <div className="flex gap-2">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40">
              Cliente Ativo
            </span>
            {isInadimplente && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 border border-red-150 dark:border-red-900/40 animate-pulse">
                Inadimplente
              </span>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="w-full grid grid-cols-3 gap-2 py-3 border-y border-zinc-150 dark:border-zinc-800 text-xs mt-2">
            <div className="text-center">
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">Faturado</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-1">{formatCurrency(totalInvoiced)}</span>
            </div>
            <div className="text-center border-x border-zinc-150 dark:border-zinc-850">
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">Em Aberto</span>
              <span className={`font-bold block mt-1 ${openBalance > 0 ? "text-danger" : "text-zinc-800 dark:text-zinc-200"}`}>{formatCurrency(openBalance)}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">OS Feitas</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-1">{totalOSCount}</span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="w-full text-left space-y-2.5 text-xs text-zinc-650 dark:text-zinc-400 font-semibold pt-1">
            <div className="flex items-center gap-2"><Phone size={13} className="text-zinc-400" /> {formatPhone(details.phone)}</div>
            <div className="flex items-center gap-2"><Mail size={13} className="text-zinc-400" /> {details.email}</div>
            {details.segment && <div className="flex items-center gap-2"><Building size={13} className="text-zinc-400" /> Segmento: {details.segment}</div>}
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-zinc-400 mt-0.5 shrink-0" />
              <span>{formatAddress(primaryAddress)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileSignature size={13} className="text-zinc-400 shrink-0" />
              <span>{activeContract ? `${activeContract.code} · ${activeContract.status}` : "Sem contrato recorrente"}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full pt-4 border-t border-zinc-150 dark:border-zinc-850 flex flex-col gap-2">
            {hasPermission("clients.write") && (
              <Button
                variant="secondary"
                className="w-full"
                size="sm"
                onClick={openEditClient}
              >
                <Pencil size={14} /> Editar cadastro
              </Button>
            )}
            <Button
              variant="primary"
              className="w-full"
              size="sm"
              onClick={() => openTab("ordens-servico", "Nova OS", { new: "true", clientId: details.id })}
            >
              <Wrench size={14} /> Nova OS
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              size="sm"
              onClick={() => openTab("orcamentos", "Novo Orçamento", { new: "true", clientId: details.id })}
            >
              <FileText size={14} /> Novo Orçamento
            </Button>
          </div>
        </Card>

        {/* Card: Conformidade LGPD */}
        <Card className="p-4 space-y-3 shadow-premium">
          <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-150 font-bold text-xs border-b pb-2 border-zinc-100 dark:border-zinc-800">
            <ShieldCheck size={14} className="text-primary" />
            <span>Conformidade & LGPD</span>
          </div>

          <div className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed">
            Ações de privacidade de dados requeridas pela Lei Geral de Proteção de Dados (Artigos 18 e 19).
          </div>

          <div className="flex flex-col gap-2 pt-1.5">
            <Button
              variant="secondary"
              className="w-full justify-start text-xs"
              size="sm"
              loading={lgpdExporting}
              onClick={handleExportLgpd}
            >
              <Download size={13} className="mr-1 shrink-0" /> Exportar Dados (Portabilidade)
            </Button>

            {hasPermission("admin.all") && (
              <Button
                variant="danger"
                className="w-full justify-start text-xs"
                size="sm"
                loading={lgpdAnonymizing}
                onClick={handleAnonymizeLgpd}
              >
                <ShieldAlert size={13} className="mr-1 shrink-0" /> Anonimizar (Esquecimento)
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN: Action Tabs Workspace (8/12) */}
      <div className={`${subTab === "central" ? "lg:col-span-12" : "lg:col-span-8"} space-y-6`}>
        <Card className={`p-0 overflow-hidden flex flex-col h-full min-h-[500px] ${subTab === "central" ? "shadow-premium" : ""}`}>
          {/* Subtabs Menu */}
          <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-2 flex gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: "resumo", label: "Resumo" },
              { id: "contacts", label: "Contatos" },
              { id: "addresses", label: "Endereços" },
              { id: "equipments", label: "Equipamentos" },
              { id: "quotes", label: "Orçamentos" },
              { id: "os", label: "OSs" },
              { id: "financeiro", label: "Financeiro" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer ${
                  subTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subtab Contents Container */}
          <div className={`${subTab === "central" ? "p-4 sm:p-6 lg:p-8" : "p-6"} flex-1 overflow-y-auto`}>
            {/* CENTRAL DA LOJA */}
            {subTab === "central" && (
              <div className="space-y-5">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white shadow-xl sm:p-7">
                  <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

                  <div className="relative grid gap-6 xl:grid-cols-[1fr_340px] xl:items-stretch">
                    <div className="flex min-w-0 flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-100 backdrop-blur">
                            Central operacional
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wide ${
                            details.status === "ATIVO"
                              ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-200"
                              : "border-amber-300/20 bg-amber-400/15 text-amber-200"
                          }`}>
                            Cliente {details.status.toLowerCase()}
                          </span>
                        </div>
                        <div className="mt-5 flex items-start gap-4">
                          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl font-black text-white shadow-inner sm:flex">
                            {details.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-blue-200">{details.socialName || details.name}</p>
                            <h2 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{details.fancyName || details.name}</h2>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatCpfCnpj(details.cpfCnpj)}</p>
                          </div>
                        </div>
                        <div className="mt-5 grid gap-2 text-xs font-medium text-slate-300 md:grid-cols-2">
                          <span className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-blue-300" />
                            <span className="line-clamp-2">{formatAddress(primaryAddress)}</span>
                          </span>
                          <span className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                            <FileSignature size={14} className="mt-0.5 shrink-0 text-blue-300" />
                            <span className="line-clamp-2">
                              {activeContract
                                ? `${activeContract.code} · ${activeContract.billingPeriod} · ${activeContract.status}`
                                : "Atendimento avulso, sem contrato recorrente"}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          onClick={() => openTab("ordens-servico", "Nova OS", { new: "true", clientId: details.id })}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400"
                        >
                          <Plus size={15} /> Nova pendência / OS
                        </button>
                        <button
                          onClick={() => openTab("orcamentos", "Novo Orçamento", { new: "true", clientId: details.id })}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/15"
                        >
                          <FileText size={15} /> Novo orçamento
                        </button>
                        {!primaryAddress && hasPermission("clients.write") && (
                          <button
                            onClick={() => setIsAddAddressOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/15 px-4 py-2.5 text-xs font-bold text-amber-100 transition hover:bg-amber-400/25"
                          >
                            <MapPin size={15} /> Cadastrar endereço
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-md">
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Contato</span>
                        <p className="mt-1 truncate text-xs font-bold text-white">{details.contacts[0]?.name || "Não definido"}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">{details.contacts[0]?.phone ? formatPhone(details.contacts[0].phone) : formatPhone(details.phone)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Contrato</span>
                        <p className="mt-1 truncate text-xs font-bold text-white">{activeContract?.code || "Avulso"}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">{activeContract ? formatCurrency(activeContract.value) : "Sem recorrência"}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Faturado</span>
                        <p className="mt-1 text-sm font-black text-white">{formatCurrency(totalInvoiced)}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{totalOSCount} OS no histórico</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Em aberto</span>
                        <p className={`mt-1 text-sm font-black ${openBalance > 0 ? "text-amber-300" : "text-emerald-300"}`}>{formatCurrency(openBalance)}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{isInadimplente ? "Possui vencimentos" : "Situação regular"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setCentralTab("pendencias")}
                    className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-left transition hover:border-red-300 dark:border-red-950 dark:bg-red-950/20"
                  >
                    <span className="flex items-center justify-between text-red-700 dark:text-red-300">
                      <AlertTriangle size={17} />
                      <strong className="text-2xl">{activeOrders.length}</strong>
                    </span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Pendências abertas</span>
                  </button>
                  <button
                    onClick={() => setCentralTab("patrimonio")}
                    className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-left transition hover:border-blue-300 dark:border-blue-950 dark:bg-blue-950/20"
                  >
                    <span className="flex items-center justify-between text-blue-700 dark:text-blue-300">
                      <Package size={17} />
                      <strong className="text-2xl">{details.equipments.length}</strong>
                    </span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Itens no patrimônio</span>
                  </button>
                  <button
                    onClick={() => setCentralTab("preventivas")}
                    className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-left transition hover:border-emerald-300 dark:border-emerald-950 dark:bg-emerald-950/20"
                  >
                    <span className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                      <ClipboardList size={17} />
                      <strong className="text-sm">{lastPreventive ? formatDate(lastPreventive.completedAt || lastPreventive.scheduledDate || lastPreventive.createdAt) : "—"}</strong>
                    </span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Última preventiva</span>
                  </button>
                </div>

                {activeOrders.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Esta unidade possui {activeOrders.length} {activeOrders.length === 1 ? "atendimento em aberto" : "atendimentos em aberto"}.</p>
                      <p className="mt-0.5 text-[10px] opacity-80">Abra a OS para atualizar o andamento, anexar fotos ou concluir o serviço.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
                  {[
                    { id: "pendencias", label: "Pendências & Chamados", icon: AlertTriangle },
                    { id: "patrimonio", label: "Patrimônio", icon: Package },
                    { id: "preventivas", label: "Preventivas & Relatórios", icon: ClipboardList },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setCentralTab(tab.id as typeof centralTab)}
                        className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[11px] font-bold transition ${
                          centralTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-zinc-450 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <Icon size={14} /> {tab.label}
                      </button>
                    );
                  })}
                </div>

                {centralTab === "pendencias" && (
                  <div className="space-y-3">
                    {details.serviceOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center dark:border-zinc-700">
                        <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                        <p className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">Nenhuma pendência registrada</p>
                        <p className="mt-1 text-xs text-zinc-450">Crie uma OS quando surgir um chamado para esta unidade.</p>
                      </div>
                    ) : (
                      details.serviceOrders.slice(0, 12).map((order: any) => {
                        const state = getOrderState(order.status);
                        const StateIcon = state.icon;
                        const photoCount = order._count?.photos || 0;
                        const title = order.problemReported || order.technicalDiagnosis || `${order.type.replaceAll("_", " ")} · ${order.code}`;
                        const origin = order.type === "PREVENTIVA"
                          ? "Registrado em atendimento preventivo"
                          : order.quoteId
                            ? "Originado de orçamento aprovado"
                            : "Chamado / atendimento avulso";

                        return (
                          <div key={order.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${state.className}`}>
                                    <StateIcon size={10} /> {state.label}
                                  </span>
                                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
                                    ["URGENTE", "ALTA"].includes(order.priority)
                                      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                  }`}>
                                    Prioridade {order.priority?.toLowerCase() || "média"}
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-400">{order.code}</span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">{title}</p>
                                <p className="mt-1 text-[10px] font-medium text-zinc-450">{origin}</p>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold text-zinc-500">
                                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(order.scheduledDate || order.createdAt)}</span>
                                  <span className="flex items-center gap-1"><MapPin size={12} /> {order.address?.label || primaryAddress?.label || "Local não definido"}</span>
                                  <span className="flex items-center gap-1"><Camera size={12} /> {photoCount} {photoCount === 1 ? "foto" : "fotos"}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 xl:max-w-[230px] xl:justify-end">
                                {!completedStatuses.has(order.status) && (
                                  <Button variant="secondary" size="sm" onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: "relatorio" })}>
                                    <Camera size={13} /> Anexar foto
                                  </Button>
                                )}
                                <Button
                                  variant={completedStatuses.has(order.status) ? "secondary" : "primary"}
                                  size="sm"
                                  onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: completedStatuses.has(order.status) ? "relatorio" : undefined })}
                                >
                                  {completedStatuses.has(order.status) ? <FileText size={13} /> : <Wrench size={13} />}
                                  {completedStatuses.has(order.status) ? "Ver relatório" : "Abrir OS"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <Button variant="secondary" size="sm" onClick={() => openTab("orcamentos", "Novo Orçamento", { new: "true", clientId: details.id })}>
                        <FileText size={13} /> Gerar orçamento
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => openTab("ordens-servico", "Nova OS", { new: "true", clientId: details.id })}>
                        <Plus size={13} /> Criar OS
                      </Button>
                    </div>
                  </div>
                )}

                {centralTab === "patrimonio" && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Equipamentos vinculados à unidade</h4>
                        <p className="mt-1 text-[10px] text-zinc-450">Identificação, localização e histórico básico dos ativos.</p>
                      </div>
                      {hasPermission("clients.write") && (
                        <Button variant="secondary" size="sm" onClick={() => setIsAddEquipmentOpen(true)}>
                          <Plus size={13} /> Novo equipamento
                        </Button>
                      )}
                    </div>
                    {details.equipments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center text-xs text-zinc-450 dark:border-zinc-700">
                        Nenhum equipamento cadastrado nesta unidade.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {details.equipments.map((equipment: any) => (
                          <div key={equipment.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                                  <Package size={17} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{equipment.type}</p>
                                  <p className="mt-0.5 text-[10px] font-semibold text-zinc-500">{equipment.brand} · {equipment.model}</p>
                                </div>
                              </div>
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Ativo</span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                              <div>
                                <span className="block font-bold uppercase text-zinc-400">Identificação</span>
                                <span className="mt-1 block font-semibold text-zinc-700 dark:text-zinc-300">{equipment.tag || equipment.serialNumber || "Não informada"}</span>
                              </div>
                              <div>
                                <span className="block font-bold uppercase text-zinc-400">Localização</span>
                                <span className="mt-1 block font-semibold text-zinc-700 dark:text-zinc-300">{equipment.location || "Não informada"}</span>
                              </div>
                              <div>
                                <span className="block font-bold uppercase text-zinc-400">Capacidade</span>
                                <span className="mt-1 block font-semibold text-zinc-700 dark:text-zinc-300">{equipment.capacity || "Não informada"}</span>
                              </div>
                              <div>
                                <span className="block font-bold uppercase text-zinc-400">Instalação</span>
                                <span className="mt-1 block font-semibold text-zinc-700 dark:text-zinc-300">{equipment.installDate ? formatDate(equipment.installDate) : "Não informada"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {centralTab === "preventivas" && (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Preventivas e relatórios</h4>
                        <p className="mt-1 text-[10px] text-zinc-450">Histórico técnico comprovado por checklist, fotos e relatório.</p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => openTab("preventivas", "Preventivas")}>
                        <Plus size={13} /> Planejar preventiva
                      </Button>
                    </div>
                    {preventiveOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 px-5 py-10 text-center dark:border-zinc-700">
                        <ClipboardList size={28} className="mx-auto text-zinc-350" />
                        <p className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">Nenhuma preventiva registrada</p>
                        <p className="mt-1 text-xs text-zinc-450">Planeje o primeiro atendimento preventivo desta unidade.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {preventiveOrders.map((order: any) => {
                          const photoCount = order._count?.photos || 0;
                          const checklistCount = getChecklistCount(order.checklistJson);
                          const technicians = order.technicians?.map((item: any) => item.user?.name).filter(Boolean).join(", ");
                          return (
                            <div key={order.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{order.code}</span>
                                    <StatusBadge status={order.status} />
                                  </div>
                                  <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                                    {formatDate(order.completedAt || order.scheduledDate || order.createdAt)} · {technicians || "Técnico não definido"}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-zinc-500">
                                    <span className="flex items-center gap-1"><ClipboardList size={12} /> {checklistCount} itens concluídos</span>
                                    <span className="flex items-center gap-1"><ImageIcon size={12} /> {photoCount} {photoCount === 1 ? "foto" : "fotos"}</span>
                                    <span className="flex items-center gap-1"><FileText size={12} /> {order.completionReport ? "Relatório disponível" : "Relatório pendente"}</span>
                                  </div>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: "relatorio" })}>
                                  <FileText size={13} /> Ver relatório
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 1: Resumo */}
            {subTab === "resumo" && (
              <div className="space-y-6">
                {/* 3 Quick Cards (Page 11) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Ultima OS */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">Última OS</span>
                      {details.serviceOrders && details.serviceOrders.length > 0 ? (
                        <>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                            {details.serviceOrders[0].code}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-1.5 inline-block ${
                            details.serviceOrders[0].status === "CONCLUIDO"
                              ? "text-success bg-success/10"
                              : details.serviceOrders[0].status === "ABERTO"
                              ? "text-blue-500 bg-blue-50"
                              : "text-warning bg-warning/10"
                          }`}>
                            {details.serviceOrders[0].status}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-450 mt-1 block font-semibold">Nenhuma OS</span>
                      )}
                    </div>
                    {details.serviceOrders && details.serviceOrders.length > 0 && (
                      <button
                        onClick={() => openTab("ordens-servico", details.serviceOrders[0].code, { id: details.serviceOrders[0].id })}
                        className="text-[9px] font-bold text-primary mt-3 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        Abrir <ExternalLink size={10} />
                      </button>
                    )}
                  </div>

                  {/* Ultimo Orcamento */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">Último Orçamento</span>
                      {details.quotes && details.quotes.length > 0 ? (
                        <>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                            {details.quotes[0].code}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-1.5 inline-block ${
                            details.quotes[0].status === "APROVADO"
                              ? "text-success bg-success/10"
                              : "text-primary bg-primary/10"
                          }`}>
                            {details.quotes[0].status}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-450 mt-1 block font-semibold">Nenhum orçamento</span>
                      )}
                    </div>
                    {details.quotes && details.quotes.length > 0 && (
                      <button
                        onClick={() => openTab("orcamentos", `Orçamento ${details.quotes[0].code}`)}
                        className="text-[9px] font-bold text-primary mt-3 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        Abrir <ExternalLink size={10} />
                      </button>
                    )}
                  </div>

                  {/* Financeiro */}
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">Financeiro</span>
                      {details.receivables && details.receivables.length > 0 ? (
                        <>
                          <span className={`text-xs font-bold mt-1 block ${
                            details.receivables.some(r => r.status === "VENCIDO") ? "text-danger" : "text-zinc-800 dark:text-zinc-200"
                          }`}>
                            {formatCurrency(details.receivables.reduce((sum, r) => r.status !== "PAGO" ? sum + (r.amount || r.value || 0) : sum, 0))}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-1.5 inline-block ${
                            details.receivables.some(r => r.status === "VENCIDO")
                              ? "text-danger bg-danger/10"
                              : "text-success bg-success/10"
                          }`}>
                            {details.receivables.some(r => r.status === "VENCIDO") ? "Vencido" : "Em dia"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200 mt-1 block">{formatCurrency(0)}</span>
                          <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded self-start mt-1.5 inline-block">Sem pendências</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => openTab("financeiro", "Financeiro", { tab: "receber" })}
                      className="text-[9px] font-bold mt-3 flex items-center gap-1 hover:underline cursor-pointer text-zinc-500"
                    >
                      Ver contas <ExternalLink size={10} />
                    </button>
                  </div>
                </div>

                {/* Recent History List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">Histórico Recente</h4>
                  <div className="border border-zinc-200 dark:border-zinc-850 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-850 overflow-hidden">
                    {getRecentHistory().length > 0 ? (
                      getRecentHistory().map((item, idx) => (
                        <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-zinc-50/20">
                          <div>
                            <p className="font-bold text-zinc-850 dark:text-zinc-200">{item.title}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{item.subtitle}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-zinc-400">
                        Nenhum histórico recente registrado para este cliente.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: Contatos */}
            {subTab === "contacts" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Contatos do Cliente</h4>
                  {hasPermission("clients.write") && (
                    <Button variant="secondary" size="sm" onClick={() => setIsAddContactOpen(true)}>
                      <Plus size={14} /> Adicionar Contato
                    </Button>
                  )}
                </div>

                {details.contacts.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhum contato cadastrado.</p>
                ) : (
                  <Table headers={["Nome", "Cargo / Função", "Telefone", "E-mail", "Flags"]}>
                    {details.contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-bold text-zinc-800 dark:text-zinc-150">{c.name}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{c.role || "N/A"}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{formatPhone(c.phone)}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{c.email}</TableCell>
                        <TableCell className="flex gap-1 flex-wrap">
                          {c.isFinancial && <span className="text-[8px] bg-emerald-55 bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-1.5 py-0.5 rounded">Financeiro</span>}
                          {c.isTechnical && <span className="text-[8px] bg-blue-50 text-blue-600 border border-blue-100 font-bold px-1.5 py-0.5 rounded">Técnico</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                )}
              </div>
            )}

            {/* SUBTAB 3: Endereços */}
            {subTab === "addresses" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Locais / Endereços</h4>
                  {hasPermission("clients.write") && (
                    <Button variant="secondary" size="sm" onClick={() => setIsAddAddressOpen(true)}>
                      <Plus size={14} /> Adicionar Endereço
                    </Button>
                  )}
                </div>

                {details.addresses.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhum endereço cadastrado.</p>
                ) : (
                  <Table headers={["Identificador", "Endereço", "Bairro", "Cidade / UF", "CEP"]}>
                    {details.addresses.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-bold text-zinc-800 dark:text-zinc-150">{a.label}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{a.street}, {a.number} {a.complement}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{a.neighborhood}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{a.city} / {a.state}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{a.cep}</TableCell>
                      </TableRow>
                    ))}
                  </Table>
                )}
              </div>
            )}

            {/* SUBTAB 4: Equipamentos */}
            {subTab === "equipments" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Máquinas Cadastradas</h4>
                  {hasPermission("clients.write") && (
                    <Button variant="secondary" size="sm" onClick={() => setIsAddEquipmentOpen(true)}>
                      <Plus size={14} /> Adicionar Equipamento
                    </Button>
                  )}
                </div>

                {details.equipments.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhum equipamento cadastrado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {details.equipments.map((e) => (
                      <div key={e.id} className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-250 text-sm">{e.type}</span>
                          {e.tag && <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">{e.tag}</span>}
                        </div>
                        <div className="space-y-1 text-zinc-500 font-semibold">
                          <p>Marca: <span className="text-zinc-700 dark:text-zinc-300">{e.brand}</span></p>
                          <p>Modelo: <span className="text-zinc-700 dark:text-zinc-300">{e.model}</span></p>
                          {e.serialNumber && <p>N/S: <span className="text-zinc-700 dark:text-zinc-300 font-mono">{e.serialNumber}</span></p>}
                          {e.location && <p>Localização: <span className="text-zinc-750 dark:text-zinc-350">{e.location}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 5: Orçamentos */}
            {subTab === "quotes" && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Histórico de Orçamentos</h4>
                {details.quotes.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhum orçamento cadastrado.</p>
                ) : (
                  <Table headers={["Orçamento", "Data", "Valor", "Status"]}>
                    {details.quotes.map((q) => (
                      <TableRow key={q.id} onClick={() => openTab("orcamentos", "Orçamento", { id: q.id })}>
                        <TableCell className="font-bold text-zinc-800 dark:text-zinc-150">Orçamento #{q.id.slice(-4)}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{formatDate(q.createdAt)}</TableCell>
                        <TableCell className="font-semibold text-zinc-800 dark:text-zinc-150">{formatCurrency(q.totalValue)}</TableCell>
                        <TableCell><StatusBadge status={q.status} /></TableCell>
                      </TableRow>
                    ))}
                  </Table>
                )}
              </div>
            )}

            {/* SUBTAB 6: OSs */}
            {subTab === "os" && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Histórico de OSs</h4>
                {details.serviceOrders.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhuma Ordem de Serviço cadastrada.</p>
                ) : (
                  <Table headers={["OS", "Agendada", "Técnico", "Valor", "Status"]}>
                    {details.serviceOrders.map((o) => (
                      <TableRow key={o.id} onClick={() => openTab("ordens-servico", `OS #${o.id.slice(-4)}`, { id: o.id })}>
                        <TableCell className="font-bold text-zinc-800 dark:text-zinc-150">OS #{o.id.slice(-4)}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{formatDate(o.scheduledDate || o.createdAt)}</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{o.technician?.name || "N/A"}</TableCell>
                        <TableCell className="font-semibold text-zinc-800 dark:text-zinc-150">{formatCurrency(o.totalValue)}</TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                      </TableRow>
                    ))}
                  </Table>
                )}
              </div>
            )}

            {/* SUBTAB 7: Financeiro */}
            {subTab === "financeiro" && (
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Faturas & Lançamentos</h4>
                {details.receivables.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8">Nenhum lançamento financeiro.</p>
                ) : (
                  <Table headers={["Fatura / Lançamento", "Vencimento", "Valor", "Status"]}>
                    {details.receivables.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-zinc-850 dark:text-zinc-150">Parcela / Recebível</TableCell>
                        <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">{formatDate(r.dueDate)}</TableCell>
                        <TableCell className="font-semibold text-zinc-850 dark:text-zinc-150">{formatCurrency(r.value)}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    ))}
                  </Table>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Edit Client Modal */}
      <Modal isOpen={isEditClientOpen} onClose={() => setIsEditClientOpen(false)} title="Editar Cadastro do Cliente">
        <form onSubmit={handleUpdateClient} className="space-y-4">
          <Input
            label="Nome / Identificação *"
            required
            value={editClientForm.name}
            onChange={(e) => setEditClientForm((current) => ({ ...current, name: e.target.value }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Razão Social"
              value={editClientForm.socialName}
              onChange={(e) => setEditClientForm((current) => ({ ...current, socialName: e.target.value }))}
            />
            <Input
              label="Nome Fantasia"
              value={editClientForm.fancyName}
              onChange={(e) => setEditClientForm((current) => ({ ...current, fancyName: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="CPF / CNPJ (opcional)"
                  placeholder="Informe agora ou deixe para depois"
                  value={editClientForm.cpfCnpj}
                  onChange={(e) => setEditClientForm((current) => ({ ...current, cpfCnpj: e.target.value }))}
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleEditCnpjSearch} loading={cnpjLoading}>
                Buscar CNPJ
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-zinc-450">
              Pode permanecer vazio. Ao informar um CNPJ, use “Buscar CNPJ” para completar os dados automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="E-mail *"
              type="email"
              required
              value={editClientForm.email}
              onChange={(e) => setEditClientForm((current) => ({ ...current, email: e.target.value }))}
            />
            <Input
              label="Telefone *"
              required
              value={editClientForm.phone}
              onChange={(e) => setEditClientForm((current) => ({ ...current, phone: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="WhatsApp"
              value={editClientForm.whatsapp}
              onChange={(e) => setEditClientForm((current) => ({ ...current, whatsapp: e.target.value }))}
            />
            <Input
              label="Inscrição Estadual"
              value={editClientForm.stateRegistration}
              onChange={(e) => setEditClientForm((current) => ({ ...current, stateRegistration: e.target.value }))}
            />
            <Input
              label="Inscrição Municipal"
              value={editClientForm.municipalRegistration}
              onChange={(e) => setEditClientForm((current) => ({ ...current, municipalRegistration: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Segmento"
              value={editClientForm.segment}
              onChange={(e) => setEditClientForm((current) => ({ ...current, segment: e.target.value }))}
            />
            <Input
              label="Origem"
              value={editClientForm.origin}
              onChange={(e) => setEditClientForm((current) => ({ ...current, origin: e.target.value }))}
            />
          </div>

          <Input
            label="Observações"
            value={editClientForm.notes}
            onChange={(e) => setEditClientForm((current) => ({ ...current, notes: e.target.value }))}
          />

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setIsEditClientOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar alterações</Button>
          </div>
        </form>
      </Modal>

      {/* Add Contact Modal */}
      <Modal isOpen={isAddContactOpen} onClose={() => setIsAddContactOpen(false)} title="Adicionar Contato">
        <form onSubmit={handleAddContact} className="space-y-4">
          <Input
            label="Nome *"
            required
            value={contactForm.name}
            onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Cargo / Função"
            value={contactForm.role}
            onChange={(e) => setContactForm((prev) => ({ ...prev, role: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-mail"
              type="email"
              value={contactForm.email}
              onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Telefone *"
              required
              value={contactForm.phone}
              onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={contactForm.isFinancial}
                onChange={(e) => setContactForm((prev) => ({ ...prev, isFinancial: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-zinc-300"
              />
              Contato Financeiro
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-650 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={contactForm.isTechnical}
                onChange={(e) => setContactForm((prev) => ({ ...prev, isTechnical: e.target.checked }))}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-zinc-300"
              />
              Contato Técnico
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddContactOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Add Address Modal */}
      <Modal isOpen={isAddAddressOpen} onClose={() => setIsAddAddressOpen(false)} title="Adicionar Endereço">
        <form onSubmit={handleAddAddress} className="space-y-4">
          <Input
            label="Identificador (ex: Sede, Instalação) *"
            required
            value={addressForm.label}
            onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Rua / Logradouro *"
                required
                value={addressForm.street}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
              />
            </div>
            <Input
              label="Número *"
              required
              value={addressForm.number}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Complemento"
              value={addressForm.complement}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, complement: e.target.value }))}
            />
            <Input
              label="Bairro"
              value={addressForm.neighborhood}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Cidade *"
                required
                value={addressForm.city}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <Input
              label="UF *"
              required
              value={addressForm.state}
              onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
            />
          </div>
          <Input
            label="CEP"
            value={addressForm.cep}
            onChange={(e) => setAddressForm((prev) => ({ ...prev, cep: e.target.value }))}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddAddressOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Add Equipment Modal */}
      <Modal isOpen={isAddEquipmentOpen} onClose={() => setIsAddEquipmentOpen(false)} title="Vincular Máquina / Equipamento">
        <form onSubmit={handleAddEquipment} className="space-y-4">
          <Select
            label="Tipo de Equipamento"
            options={[
              { value: "Ar Condicionado Split", label: "Ar Condicionado Split" },
              { value: "Chiller", label: "Chiller Resfriador" },
              { value: "VRF", label: "VRF Multizone" },
              { value: "Self Contained", label: "Self Contained" },
              { value: "Câmara Fria", label: "Câmara Fria / Congelador" },
            ]}
            value={equipmentForm.type}
            onChange={(e) => setEquipmentForm((prev) => ({ ...prev, type: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Marca *"
              required
              placeholder="ex: Carrier, Daikin"
              value={equipmentForm.brand}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, brand: e.target.value }))}
            />
            <Input
              label="Modelo *"
              required
              placeholder="ex: 40KVQ"
              value={equipmentForm.model}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, model: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Número de Série"
              value={equipmentForm.serialNumber}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
            />
            <Input
              label="Capacidade (ex: 12000 BTU, 5 TR)"
              value={equipmentForm.capacity}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, capacity: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Identificação / TAG"
              placeholder="ex: AR-01"
              value={equipmentForm.tag}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, tag: e.target.value }))}
            />
            <Input
              label="Local da Instalação"
              placeholder="ex: Sala de Reunião 2"
              value={equipmentForm.location}
              onChange={(e) => setEquipmentForm((prev) => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddEquipmentOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Salvar</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
