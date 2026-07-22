"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  getClientDetails,
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
  ShieldCheck
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
  const [subTab, setSubTab] = useState<"resumo" | "contacts" | "addresses" | "equipments" | "quotes" | "os" | "financeiro" | "fiscal" | "history">("resumo");

  // Creation modals
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
      <div className="lg:col-span-4 space-y-6">
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
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-1">{formatCurrency(totalInvoiced || 18420)}</span>
            </div>
            <div className="text-center border-x border-zinc-150 dark:border-zinc-850">
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">Em Aberto</span>
              <span className={`font-bold block mt-1 ${openBalance > 0 ? "text-danger" : "text-zinc-800 dark:text-zinc-200"}`}>{formatCurrency(openBalance || 1500)}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold text-zinc-400 block uppercase">OS Feitas</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-1">{totalOSCount || 12}</span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="w-full text-left space-y-2.5 text-xs text-zinc-650 dark:text-zinc-400 font-semibold pt-1">
            <div className="flex items-center gap-2"><Phone size={13} className="text-zinc-400" /> {formatPhone(details.phone)}</div>
            <div className="flex items-center gap-2"><Mail size={13} className="text-zinc-400" /> {details.email}</div>
            {details.segment && <div className="flex items-center gap-2"><Building size={13} className="text-zinc-400" /> Segmento: {details.segment}</div>}
          </div>

          {/* Actions */}
          <div className="w-full pt-4 border-t border-zinc-150 dark:border-zinc-850 flex flex-col gap-2">
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
      <div className="lg:col-span-8 space-y-6">
        <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[500px]">
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
          <div className="p-6 flex-1 overflow-y-auto">
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
