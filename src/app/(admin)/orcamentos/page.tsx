"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getQuotes,
  getQuoteDetails,
  createQuote,
  updateQuoteStatus,
  approveAndConvertQuote,
  QuoteItemInput,
} from "@/app/actions/quoteActions";
import { getClients, ClientDTO } from "@/app/actions/clientActions";
import { formatCurrency, formatDate, formatCpfCnpj } from "@/lib/utils";
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  HelpCircle,
  DollarSign,
  TrendingUp,
  Percent,
  PlusCircle,
  Trash2,
  Printer,
  ChevronRight,
  Loader2,
  Wrench,
  ChevronDown,
  User,
  MapPin,
  Clock,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OrcamentosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteCodeParam = searchParams.get("code");

  const { user: currentUser, hasPermission } = useAuth();

  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Controle de Visualização
  const [isCreating, setIsCreating] = useState(false);
  const [showInternalAudit, setShowInternalAudit] = useState(true);

  // Dados para Criação
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [newQuoteForm, setNewQuoteForm] = useState({
    clientId: "",
    addressId: "",
    contactId: "",
    validityDays: 15,
    warrantyDays: 90,
    executionTerm: "5 dias úteis",
    paymentTerms: "Pix 50% + 50% após conclusão",
    notes: "",
    discount: 0,
    tax: 0,
  });

  const [quoteItems, setQuoteItems] = useState<QuoteItemInput[]>([
    { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 },
  ]);

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [companyData, setCompanyData] = useState({
    tradeName: "NX Climatização",
    corporateName: "NX Climatização & Elétrica Ltda.",
    cnpj: "07.889.332/0001-00",
    phone: "(11) 3300-4400",
    address: "Rua do Engenho, 100 - Centro - São Paulo - SP",
    logoUrl: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("company_params");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompanyData({
          tradeName: parsed.tradeName || "NX Climatização",
          corporateName: parsed.corporateName || "NX Climatização & Elétrica Ltda.",
          cnpj: parsed.cnpj || "07.889.332/0001-00",
          phone: parsed.phone || "(11) 3300-4400",
          address: parsed.address || "Rua do Engenho, 100 - Centro - São Paulo - SP",
          logoUrl: parsed.logoUrl || "",
        });
      } catch (e) {
        console.error("Erro ao carregar dados da empresa:", e);
      }
    }
  }, []);

  // Carregar lista de orçamentos
  async function loadQuotes(query = "") {
    setLoadingList(true);
    const data = await getQuotes(query);
    setQuotes(data);
    setLoadingList(false);

    // Se houver um parâmetro ?code=Q-XXXX na URL, seleciona esse orçamento
    if (quoteCodeParam) {
      const matched = data.find((q) => q.code === quoteCodeParam);
      if (matched) {
        setSelectedQuoteId(matched.id);
        setIsCreating(false);
        return;
      }
    }

    // Caso contrário, seleciona o primeiro por padrão
    if (data.length > 0 && !selectedQuoteId && !isCreating) {
      setSelectedQuoteId(data[0].id);
    }
  }

  // Carregar detalhes do orçamento selecionado
  async function loadDetails(id: string) {
    setLoadingDetails(true);
    const details = await getQuoteDetails(id);
    setQuoteDetails(details);
    setLoadingDetails(false);
  }

  // Carregar clientes para o formulário
  async function loadClients() {
    const data = await getClients();
    setClients(data);
  }

  useEffect(() => {
    loadQuotes();
    loadClients();
  }, [quoteCodeParam]);

  useEffect(() => {
    if (selectedQuoteId) {
      loadDetails(selectedQuoteId);
    } else {
      setQuoteDetails(null);
    }
  }, [selectedQuoteId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadQuotes(val);
  };

  const handleClientSelect = async (clientId: string) => {
    setNewQuoteForm({
      ...newQuoteForm,
      clientId,
      addressId: "",
      contactId: "",
    });
    // Buscar detalhes do cliente selecionado para preencher endereços e contatos
    const response = await fetch(`/api/clients/${clientId}`).then((r) => r.json()).catch(() => null);

    // Se a api direta falhar, podemos simplesmente usar o prontuário carregado localmente
    const dbClient = clients.find((c) => c.id === clientId) as any;
    if (dbClient) {
      setSelectedClient(dbClient);
    }
  };

  // Itens dinâmicos
  const handleAddItem = () => {
    setQuoteItems([
      ...quoteItems,
      { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (quoteItems.length === 1) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof QuoteItemInput, value: any) => {
    setQuoteItems(
      quoteItems.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          [field]: field === "type" || field === "unit" || field === "description" ? value : parseFloat(value) || 0,
        };
      })
    );
  };

  // Cálculos em tempo real para a tela de criação
  const calculateLiveTotals = () => {
    let subtotal = 0;
    let cost = 0;

    quoteItems.forEach((item) => {
      subtotal += item.quantity * item.unitPrice;
      cost += item.quantity * item.costPrice;
    });

    const discount = newQuoteForm.discount;
    const tax = newQuoteForm.tax;
    const total = subtotal - discount + tax;
    const profit = total - cost;
    const margin = total > 0 ? (profit / total) * 100 : 0;

    return { subtotal, total, cost, profit, margin };
  };

  const liveTotals = calculateLiveTotals();

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteForm.clientId) {
      alert("Selecione um cliente para o orçamento.");
      return;
    }
    if (quoteItems.some((i) => !i.description || i.unitPrice <= 0)) {
      alert("Preencha as descrições dos itens e certifique-se de que os valores de venda são maiores que zero.");
      return;
    }

    setActionLoading(true);
    const res = await createQuote(
      {
        clientId: newQuoteForm.clientId,
        addressId: newQuoteForm.addressId || undefined,
        contactId: newQuoteForm.contactId || undefined,
        validityDays: newQuoteForm.validityDays,
        warrantyDays: newQuoteForm.warrantyDays,
        executionTerm: newQuoteForm.executionTerm,
        paymentTerms: newQuoteForm.paymentTerms,
        notes: newQuoteForm.notes,
        discount: newQuoteForm.discount,
        tax: newQuoteForm.tax,
      },
      quoteItems,
      currentUser?.id || ""
    );

    if (res.success && res.quote) {
      setIsCreating(false);
      setSelectedQuoteId(res.quote.id);
      setQuoteItems([{ type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 }]);
      setNewQuoteForm({
        clientId: "",
        addressId: "",
        contactId: "",
        validityDays: 15,
        warrantyDays: 90,
        executionTerm: "5 dias úteis",
        paymentTerms: "Pix 50% + 50% após conclusão",
        notes: "",
        discount: 0,
        tax: 0,
      });
      await loadQuotes();
    } else {
      alert("Erro ao criar orçamento: " + res.error);
    }
    setActionLoading(false);
  };

  const handleUpdateStatus = async (status: string, message?: string) => {
    if (!selectedQuoteId || !currentUser) return;
    setActionLoading(true);
    const res = await updateQuoteStatus(selectedQuoteId, status, currentUser.id, message);
    if (res.success) {
      await loadDetails(selectedQuoteId);
      await loadQuotes();
    } else {
      alert("Erro ao atualizar status: " + res.error);
    }
    setActionLoading(false);
  };

  const handleApproveAndConvert = async () => {
    if (!selectedQuoteId || !currentUser) return;
    if (!confirm("Aprovar este orçamento e gerar a Ordem de Serviço (OS) correspondente automaticamente?")) return;

    setActionLoading(true);
    const res = await approveAndConvertQuote(selectedQuoteId, currentUser.id);
    if (res.success) {
      alert(`Orçamento aprovado com sucesso! OS gerada: ${res.os?.code}.`);
      await loadDetails(selectedQuoteId);
      await loadQuotes();
      router.push("/ordens-servico");
    } else {
      alert("Erro ao converter orçamento: " + res.error);
    }
    setActionLoading(false);
  };

  const handleOpenRejection = () => {
    setRejectionReason("");
    setRejectionModalOpen(true);
  };

  const submitRejection = async () => {
    if (!rejectionReason) return;
    setRejectionModalOpen(false);
    await handleUpdateStatus("REPROVADO", rejectionReason);
  };

  // Cores de status
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "RASCUNHO":
        return "bg-zinc-100 text-zinc-600 border border-zinc-200";
      case "ENVIADO":
        return "bg-blue-50 text-blue-600 border border-blue-200";
      case "NEGOCIACAO":
        return "bg-amber-50 text-amber-600 border border-amber-200";
      case "APROVADO":
        return "bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse";
      case "CONVERTIDO":
        return "bg-emerald-600 text-white shadow-sm shadow-emerald-600/10";
      case "REPROVADO":
      case "PERDIDO":
        return "bg-red-50 text-red-600 border border-red-200";
      case "EXPIRADO":
        return "bg-zinc-100 text-zinc-400 border border-zinc-200";
      default:
        return "bg-zinc-100 text-zinc-500 border border-zinc-200";
    }
  };

  // Badge da margem
  const getMarginBadgeClass = (margin: number) => {
    if (margin >= 40) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (margin >= 20) return "bg-amber-50 text-amber-700 border border-amber-200";
    return "bg-red-50 text-red-700 border border-red-200 animate-bounce";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
      {/* PAINEL ESQUERDO: Lista de Orçamentos (4/12 colunas) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-900 text-sm">Propostas & Orçamentos</h2>
            {hasPermission("quotes.write") && (
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedQuoteId(null);
                  setQuoteDetails(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
              >
                <Plus size={14} /> Novo
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Código ou cliente..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:border-emerald-500 focus:outline-none bg-zinc-50/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loadingList ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              <span className="text-xs">Carregando propostas...</span>
            </div>
          ) : quotes.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">Nenhum orçamento encontrado</div>
          ) : (
            quotes.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setSelectedQuoteId(q.id);
                  setIsCreating(false);
                }}
                className={`w-full text-left p-4 hover:bg-zinc-50/50 flex flex-col gap-1 transition-all ${
                  selectedQuoteId === q.id ? "bg-emerald-50/20 border-r-4 border-emerald-600" : ""
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-bold text-sm text-zinc-800">{q.code}</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(
                      q.status
                    )}`}
                  >
                    {q.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-bold truncate mt-0.5">{q.clientName}</p>
                <div className="flex justify-between items-center w-full text-xs text-zinc-400 mt-1">
                  <span>Validade: {formatDate(q.validUntil)}</span>
                  <span className="font-bold text-zinc-700">{formatCurrency(q.total)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Criador ou Visualizador de Documentos (8/12 colunas) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        {/* MODO 1: Criador de Orçamento */}
        {isCreating ? (
          <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* Header de Criação */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-sm">Elaborar Proposta Comercial</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  if (quotes.length > 0) setSelectedQuoteId(quotes[0].id);
                }}
                className="text-zinc-500 hover:text-zinc-700 font-bold text-xs"
              >
                Cancelar
              </button>
            </div>

            {/* Grid Form (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Cliente *</label>
                  <select
                    required
                    value={newQuoteForm.clientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full border border-zinc-200 rounded p-1.5 text-xs bg-white focus:outline-none"
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Local da Execução *</label>
                  <select
                    required
                    value={newQuoteForm.addressId}
                    onChange={(e) => setNewQuoteForm({ ...newQuoteForm, addressId: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-1.5 text-xs bg-white focus:outline-none"
                    disabled={!newQuoteForm.clientId}
                  >
                    <option value="">Escolha o local...</option>
                    {selectedClient?.addresses?.map((addr: any) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label}: {addr.street}, {addr.number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Contato Responsável</label>
                  <select
                    value={newQuoteForm.contactId}
                    onChange={(e) => setNewQuoteForm({ ...newQuoteForm, contactId: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-1.5 text-xs bg-white focus:outline-none"
                    disabled={!newQuoteForm.clientId}
                  >
                    <option value="">Escolha o contato...</option>
                    {selectedClient?.contacts?.map((cont: any) => (
                      <option key={cont.id} value={cont.id}>
                        {cont.name} ({cont.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabela Dinâmica de Itens */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-zinc-800 text-sm">Serviços e Peças Orçados</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Adicionar Linha
                  </button>
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[10px]">
                        <th className="p-2.5 w-24">Tipo</th>
                        <th className="p-2.5">Descrição</th>
                        <th className="p-2.5 w-16">Qtd</th>
                        <th className="p-2.5 w-16">Un</th>
                        <th className="p-2.5 w-24">Venda (R$)</th>
                        <th className="p-2.5 w-24">Custo (R$)</th>
                        <th className="p-2.5 text-center w-12">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {quoteItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/20">
                          <td className="p-2">
                            <select
                              value={item.type}
                              onChange={(e) => handleItemChange(idx, "type", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs focus:outline-none bg-white"
                            >
                              <option value="SERVICO">Serviço</option>
                              <option value="PRODUTO">Peça/Prod</option>
                              <option value="MAO_DE_OBRA">Mão Obra</option>
                              <option value="DESLOCAMENTO">Deslocam</option>
                              <option value="IMPOSTO">Imposto</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="Ex: Instalação evaporadora"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              required
                              min="0.1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs text-center focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs focus:outline-none bg-white"
                            >
                              <option value="UN">UN</option>
                              <option value="HR">HR</option>
                              <option value="KM">KM</option>
                              <option value="PC">PC</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs text-right focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.costPrice}
                              onChange={(e) => handleItemChange(idx, "costPrice", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs text-right focus:outline-none"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 disabled:opacity-30 cursor-pointer"
                              disabled={quoteItems.length === 1}
                            >
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Condições e Descontos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h5 className="font-bold text-zinc-800 text-xs uppercase tracking-wider">Prazos e Condições</h5>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-500 block mb-1">Garantia (Dias)</label>
                      <input
                        type="number"
                        value={newQuoteForm.warrantyDays}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, warrantyDays: parseInt(e.target.value) || 0 })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-1">Validade Orçamento (Dias)</label>
                      <input
                        type="number"
                        value={newQuoteForm.validityDays}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, validityDays: parseInt(e.target.value) || 0 })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-zinc-500 block mb-1">Prazo de Execução</label>
                      <input
                        type="text"
                        value={newQuoteForm.executionTerm}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, executionTerm: e.target.value })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-zinc-500 block mb-1">Forma/Condição de Pagamento</label>
                      <input
                        type="text"
                        value={newQuoteForm.paymentTerms}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, paymentTerms: e.target.value })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="font-bold text-zinc-800 text-xs uppercase tracking-wider">Ajustes Finais (R$)</h5>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-500 block mb-1">Desconto Global (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newQuoteForm.discount}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, discount: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none text-right"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-500 block mb-1">Impostos Adicionais (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newQuoteForm.tax}
                        onChange={(e) => setNewQuoteForm({ ...newQuoteForm, tax: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-zinc-200 rounded p-1.5 focus:outline-none text-right"
                      />
                    </div>
                  </div>

                  {/* Resultados / Margem em tempo real (Visão de Negociação) */}
                  <div className="bg-zinc-950 text-white rounded-xl p-4 mt-2 space-y-2 text-xs font-semibold">
                    <h6 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cálculo Interno de Margem</h6>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total Venda:</span>
                      <span className="font-bold text-sm text-emerald-400">{formatCurrency(liveTotals.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Custo Previsto:</span>
                      <span>{formatCurrency(liveTotals.cost)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-zinc-800 font-bold">
                      <span className="text-zinc-400">Lucro Estimado:</span>
                      <span className="text-emerald-400">{formatCurrency(liveTotals.profit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Margem Comercial:</span>
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${getMarginBadgeClass(liveTotals.margin)}`}>
                        {liveTotals.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Notas da Proposta (Observações impressas no PDF)</label>
                <textarea
                  rows={2}
                  placeholder="Garantia estendida... Não inclui serviços de alvenaria ou pintura..."
                  value={newQuoteForm.notes}
                  onChange={(e) => setNewQuoteForm({ ...newQuoteForm, notes: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer de Criação */}
            <div className="p-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  if (quotes.length > 0) setSelectedQuoteId(quotes[0].id);
                }}
                className="px-4 py-2 border border-zinc-200 text-zinc-500 text-sm font-semibold rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                Salvar Orçamento
              </button>
            </div>
          </form>
        ) : !quoteDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <FileText size={48} className="text-zinc-200 mb-3" />
            <p className="font-semibold text-sm">Selecione uma proposta comercial</p>
            <p className="text-xs text-zinc-500 mt-1">Para revisar itens, acompanhar a negociação e faturamento.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar do Visualizador */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="font-black text-zinc-900 text-base">{quoteDetails.code}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(quoteDetails.status)}`}>
                  {quoteDetails.status}
                </span>
              </div>

              {/* Botões de Ação com base no Status */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title="Simular Impressão/PDF"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>

                {quoteDetails.status === "RASCUNHO" && hasPermission("quotes.write") && (
                  <button
                    onClick={() => handleUpdateStatus("ENVIADO")}
                    disabled={actionLoading}
                    className="px-3 py-2 border border-blue-200 text-blue-600 bg-blue-50/20 hover:bg-blue-50 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={13} /> Marcar como Enviado
                  </button>
                )}

                {quoteDetails.status === "ENVIADO" && hasPermission("quotes.write") && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus("NEGOCIACAO")}
                      disabled={actionLoading}
                      className="px-3 py-2 border border-amber-200 text-amber-600 bg-amber-50/20 hover:bg-amber-50 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      Em Negociação
                    </button>
                    <button
                      onClick={handleOpenRejection}
                      disabled={actionLoading}
                      className="px-3 py-2 border border-red-200 text-red-600 bg-red-50/20 hover:bg-red-50 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle size={13} /> Reprovar
                    </button>
                  </>
                )}

                {quoteDetails.status === "NEGOCIACAO" && hasPermission("quotes.write") && (
                  <>
                    <button
                      onClick={handleApproveAndConvert}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer"
                    >
                      <CheckCircle size={13} /> Aprovar & Gerar OS
                    </button>
                    <button
                      onClick={handleOpenRejection}
                      disabled={actionLoading}
                      className="px-3 py-2 border border-red-200 text-red-600 bg-red-50/20 hover:bg-red-50 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle size={13} /> Reprovar
                    </button>
                  </>
                )}

                {quoteDetails.status === "APROVADO" && hasPermission("quotes.write") && (
                  <button
                    onClick={handleApproveAndConvert}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer animate-bounce"
                  >
                    <Wrench size={13} /> Gerar Ordem de Serviço (OS)
                  </button>
                )}
              </div>
            </div>

            {/* Painel Interno de Margem / Auditoria (Manager View) */}
            {showInternalAudit && hasPermission("quotes.read") && (
              <div className="bg-zinc-900 text-zinc-100 px-6 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
                <div className="flex items-center gap-2 text-zinc-400">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span>Auditoria Comercial Interna (Restrita)</span>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <div>
                    <span className="text-zinc-500 font-medium">Custo Estimado: </span>
                    <span className="text-zinc-300">{formatCurrency(quoteDetails.costEstimate)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium">Lucro Estimado: </span>
                    <span className="text-emerald-400">{formatCurrency(quoteDetails.estimatedMargin)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium">Margem Comercial: </span>
                    <span className={`px-2 py-0.5 rounded font-black text-[10px] ${getMarginBadgeClass((quoteDetails.estimatedMargin / quoteDetails.total) * 100)}`}>
                      {((quoteDetails.estimatedMargin / quoteDetails.total) * 100 || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Visualização de PDF/Impressão da Proposta (Papel Timbrado) */}
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-100/30">
              <div className="max-w-4xl mx-auto bg-white border border-zinc-200/80 shadow-md p-8 rounded-xl font-serif text-zinc-800 space-y-8 print:border-0 print:shadow-none print:p-0">
                {/* Cabeçalho Proposta */}
                <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-5">
                  <div className="flex gap-4 items-center">
                    {companyData.logoUrl && (
                      <img
                        src={companyData.logoUrl}
                        alt="Logo"
                        className="max-h-16 max-w-[120px] object-contain rounded border border-zinc-150 p-1 print:max-h-12"
                      />
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-950 uppercase tracking-wide font-sans">
                        {companyData.tradeName}
                      </h2>
                      <p className="text-xs text-zinc-500 font-sans font-medium mt-1 leading-normal">
                        {companyData.corporateName}
                        <br />
                        CNPJ: {companyData.cnpj} • Telefone: {companyData.phone}
                        <br />
                        {companyData.address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-sans">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Proposta Comercial</p>
                    <p className="text-lg font-black text-zinc-950 mt-1">{quoteDetails.code}</p>
                    <p className="text-xs text-zinc-500 mt-1">Data: {formatDate(quoteDetails.createdAt)}</p>
                  </div>
                </div>

                {/* Ficha Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans border-b border-zinc-100 pb-5">
                  <div className="space-y-1">
                    <p className="text-zinc-400 uppercase font-bold tracking-wide text-[10px]">Cliente / Proponente</p>
                    <p className="font-bold text-zinc-900 text-sm">{quoteDetails.client.name}</p>
                    <p className="text-zinc-600">CNPJ/CPF: {formatCpfCnpj(quoteDetails.client.cpfCnpj)}</p>
                    <p className="text-zinc-600">E-mail: {quoteDetails.client.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-400 uppercase font-bold tracking-wide text-[10px]">Endereço da Execução</p>
                    {quoteDetails.addressId ? (
                      <p className="text-zinc-600 leading-relaxed">
                        {quoteDetails.client.addresses?.find((a: any) => a.id === quoteDetails.addressId)?.street}, nº{" "}
                        {quoteDetails.client.addresses?.find((a: any) => a.id === quoteDetails.addressId)?.number}
                        <br />
                        {quoteDetails.client.addresses?.find((a: any) => a.id === quoteDetails.addressId)?.neighborhood} -{" "}
                        {quoteDetails.client.addresses?.find((a: any) => a.id === quoteDetails.addressId)?.city} /{" "}
                        {quoteDetails.client.addresses?.find((a: any) => a.id === quoteDetails.addressId)?.state}
                      </p>
                    ) : (
                      <p className="text-red-500 font-bold italic">Nenhum endereço vinculado!</p>
                    )}
                  </div>
                </div>

                {/* Itens do Orçamento */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-950 font-sans text-xs uppercase tracking-wide border-b border-zinc-800 pb-1">
                    Especificação dos Serviços e Peças
                  </h4>
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                        <th className="py-2 px-1">Descrição</th>
                        <th className="py-2 px-1 w-12 text-center">Qtd</th>
                        <th className="py-2 px-1 w-12 text-center">Un</th>
                        <th className="py-2 px-1 w-24 text-right">Unitário (R$)</th>
                        <th className="py-2 px-1 w-24 text-right font-black text-zinc-800">Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {quoteDetails.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-1 text-zinc-800 font-semibold">{item.description}</td>
                          <td className="py-2.5 px-1 text-center">{item.quantity}</td>
                          <td className="py-2.5 px-1 text-center">{item.unit}</td>
                          <td className="py-2.5 px-1 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2.5 px-1 text-right font-black text-zinc-900">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo Financeiro da Proposta */}
                <div className="flex justify-end font-sans">
                  <div className="w-64 space-y-1.5 text-xs border-t-2 border-zinc-800 pt-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Subtotal:</span>
                      <span>{formatCurrency(quoteDetails.subtotal)}</span>
                    </div>
                    {quoteDetails.discount > 0 && (
                      <div className="flex justify-between text-red-500 font-medium">
                        <span>(-) Descontos:</span>
                        <span>{formatCurrency(quoteDetails.discount)}</span>
                      </div>
                    )}
                    {quoteDetails.tax > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>(+) Impostos:</span>
                        <span>{formatCurrency(quoteDetails.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-zinc-950 pt-1.5 border-t border-zinc-100">
                      <span>Total Geral:</span>
                      <span>{formatCurrency(quoteDetails.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Termos e Condições */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-zinc-100 text-[10px] font-sans text-zinc-500 font-medium leading-relaxed">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-800 uppercase tracking-wide text-[9px]">Garantia Técnica</p>
                    <p>{quoteDetails.warrantyDays} dias nos serviços executados.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-800 uppercase tracking-wide text-[9px]">Prazo de Execução</p>
                    <p>{quoteDetails.executionTerm || "Conforme agendamento."}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-800 uppercase tracking-wide text-[9px]">Condição de Pagamento</p>
                    <p>{quoteDetails.paymentTerms || "À vista."}</p>
                  </div>
                </div>

                {/* Observações da Proposta */}
                {quoteDetails.notes && (
                  <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-[10px] font-sans text-zinc-500 italic">
                    <span className="font-bold text-zinc-700 not-italic block mb-0.5 uppercase tracking-wide text-[8px]">Observações Importantes:</span>
                    {quoteDetails.notes}
                  </div>
                )}

                {/* Assinaturas */}
                <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs font-sans font-semibold text-zinc-500">
                  <div className="border-t border-zinc-300 pt-3">
                    <p>Representante NX Climatização</p>
                    <p className="text-[10px] font-medium text-zinc-400 mt-0.5">Lucas Souza (Admin)</p>
                  </div>
                  <div className="border-t border-zinc-300 pt-3">
                    <p>Aceite do Proponente / Cliente</p>
                    <p className="text-[10px] font-medium text-zinc-400 mt-0.5">{quoteDetails.client.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Justificativa de Reprovação */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-800 text-sm">Registrar Reprovação / Perda</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Motivo da Perda / Justificativa *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Cliente achou preço alto e fechou com concorrente... Validade expirou..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 text-sm font-semibold rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRejection}
                  disabled={!rejectionReason}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md cursor-pointer disabled:opacity-50"
                >
                  Confirmar Reprovação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
