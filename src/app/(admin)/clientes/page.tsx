"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getClients,
  getClientDetails,
  createClient,
  addClientContact,
  addClientAddress,
  addClientEquipment,
  ClientDTO,
  ClientDetailsDTO,
} from "@/app/actions/clientActions";
import { formatCurrency, formatCpfCnpj, formatPhone, formatDate, formatDateTime } from "@/lib/utils";
import {
  Plus,
  Search,
  Users,
  MapPin,
  Laptop,
  History,
  Phone,
  Mail,
  FileText,
  Wrench,
  Receipt,
  AlertCircle,
  PlusCircle,
  Tag,
  Loader2,
  Building2,
  CheckCircle,
  Clock,
  Eye,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

export default function ClientesPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientDetailsDTO | null>(null);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Controle de Abas no Detalhe do Cliente
  const [activeTab, setActiveTab] = useState<"equipments" | "locations" | "history">("equipments");

  // Modais de Criação
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);

  // Estados dos Formulários
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    socialName: "",
    fancyName: "",
    cpfCnpj: "",
    stateRegistration: "",
    municipalRegistration: "",
    email: "",
    phone: "",
    whatsapp: "",
    segment: "Climatização",
    origin: "Google",
    notes: "",
  });

  const [newContactForm, setNewContactForm] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    whatsapp: "",
    isFinancial: false,
    isTechnical: false,
    isApproval: false,
  });

  const [newAddressForm, setNewAddressForm] = useState({
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

  const [newEquipmentForm, setNewEquipmentForm] = useState({
    type: "Ar Condicionado Split",
    brand: "",
    model: "",
    serialNumber: "",
    capacity: "",
    tag: "",
    location: "",
    notes: "",
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Carregar lista de clientes
  async function loadClients(query = "") {
    setLoadingList(true);
    const data = await getClients(query);
    setClients(data);
    setLoadingList(false);

    // Selecionar o primeiro cliente por padrão se houver
    if (data.length > 0 && !selectedClientId) {
      setSelectedClientId(data[0].id);
    }
  }

  // Carregar detalhes do cliente selecionado
  async function loadDetails(id: string) {
    setLoadingDetails(true);
    const details = await getClientDetails(id);
    setClientDetails(details);
    setLoadingDetails(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadDetails(selectedClientId);
    } else {
      setClientDetails(null);
    }
  }, [selectedClientId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadClients(val);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.name || !newClientForm.email || !newClientForm.phone) {
      alert("Preencha todos os campos obrigatórios (*)");
      return;
    }

    setActionLoading(true);
    const res = await createClient({
      ...newClientForm,
      userId: currentUser?.id,
    });

    if (res.success && res.client) {
      setIsAddClientOpen(false);
      setNewClientForm({
        name: "",
        socialName: "",
        fancyName: "",
        cpfCnpj: "",
        stateRegistration: "",
        municipalRegistration: "",
        email: "",
        phone: "",
        whatsapp: "",
        segment: "Climatização",
        origin: "Google",
        notes: "",
      });
      setSelectedClientId(res.client.id);
      await loadClients();
    } else {
      alert("Erro ao criar cliente: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newContactForm.name || !newContactForm.email || !newContactForm.phone) return;

    setActionLoading(true);
    const res = await addClientContact({
      clientId: selectedClientId,
      ...newContactForm,
    });

    if (res.success) {
      setIsAddContactOpen(false);
      setNewContactForm({
        name: "",
        role: "",
        email: "",
        phone: "",
        whatsapp: "",
        isFinancial: false,
        isTechnical: false,
        isApproval: false,
      });
      await loadDetails(selectedClientId);
    } else {
      alert("Erro ao adicionar contato: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newAddressForm.street || !newAddressForm.number || !newAddressForm.neighborhood || !newAddressForm.city) return;

    setActionLoading(true);
    const res = await addClientAddress({
      clientId: selectedClientId,
      ...newAddressForm,
    });

    if (res.success) {
      setIsAddAddressOpen(false);
      setNewAddressForm({
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
      await loadDetails(selectedClientId);
    } else {
      alert("Erro ao adicionar endereço: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newEquipmentForm.brand || !newEquipmentForm.model || !newEquipmentForm.serialNumber) return;

    setActionLoading(true);
    const res = await addClientEquipment({
      clientId: selectedClientId,
      ...newEquipmentForm,
    });

    if (res.success) {
      setIsAddEquipmentOpen(false);
      setNewEquipmentForm({
        type: "Ar Condicionado Split",
        brand: "",
        model: "",
        serialNumber: "",
        capacity: "",
        tag: "",
        location: "",
        notes: "",
      });
      await loadDetails(selectedClientId);
    } else {
      alert("Erro ao adicionar equipamento: " + res.error);
    }
    setActionLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
      {/* PAINEL ESQUERDO: Lista de Clientes (4/12 colunas) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        {/* Barra de Pesquisa e Botão Novo */}
        <div className="p-4 border-b border-zinc-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-900 text-sm">Diretório de Clientes</h2>
            {hasPermission("clients.write") && (
              <button
                onClick={() => setIsAddClientOpen(true)}
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
              placeholder="Pesquisar por nome, CNPJ..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:border-emerald-500 focus:outline-none bg-zinc-50/50"
            />
          </div>
        </div>

        {/* Listagem de Clientes */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loadingList ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              <span className="text-xs">Carregando lista...</span>
            </div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">Nenhum cliente cadastrado</div>
          ) : (
            clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`w-full text-left p-4 hover:bg-zinc-50/50 flex flex-col gap-1 transition-all ${
                  selectedClientId === c.id ? "bg-emerald-50/20 border-r-4 border-emerald-600" : ""
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-bold text-sm text-zinc-800 truncate pr-2">{c.name}</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      c.status === "ATIVO" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                  <span>{formatCpfCnpj(c.cpfCnpj)}</span>
                  <span>•</span>
                  <span>{formatPhone(c.phone)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Prontuário Técnico e Histórico (8/12 colunas) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        {loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-zinc-400">Carregando ficha técnica...</p>
          </div>
        ) : !clientDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <Users size={48} className="text-zinc-200 mb-3" />
            <p className="font-semibold text-sm">Selecione um cliente</p>
            <p className="text-xs text-zinc-500 mt-1">Para visualizar o prontuário completo de equipamentos e histórico.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header da Ficha do Cliente */}
            <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  {clientDetails.segment || "Sem segmento"}
                </span>
                <h3 className="font-bold text-zinc-950 text-base mt-1.5">{clientDetails.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1 font-medium">
                  <span className="flex items-center gap-1"><Building2 size={13} /> {formatCpfCnpj(clientDetails.cpfCnpj)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Phone size={13} /> {formatPhone(clientDetails.phone)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Mail size={13} /> {clientDetails.email}</span>
                </div>
              </div>
            </div>

            {/* Abas de Informação */}
            <div className="border-b border-zinc-100 flex px-6 py-1 bg-zinc-50/20">
              <button
                onClick={() => setActiveTab("equipments")}
                className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                  activeTab === "equipments"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <Laptop size={14} /> Equipamentos ({clientDetails.equipments.length})
              </button>
              <button
                onClick={() => setActiveTab("locations")}
                className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                  activeTab === "locations"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <MapPin size={14} /> Contatos & Locais
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                  activeTab === "history"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <History size={14} /> Histórico Operacional
              </button>
            </div>

            {/* Conteúdo das Abas (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ABA 1: Equipamentos */}
              {activeTab === "equipments" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-zinc-800 text-sm">Equipamentos Cadastrados</h4>
                    {hasPermission("clients.write") && (
                      <button
                        onClick={() => setIsAddEquipmentOpen(true)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle size={14} /> Adicionar Máquina
                      </button>
                    )}
                  </div>

                  {clientDetails.equipments.length === 0 ? (
                    <div className="border border-dashed border-zinc-200 rounded-xl py-12 text-center text-zinc-400 text-xs">
                      Nenhum equipamento técnico vinculado a este cliente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clientDetails.equipments.map((eq) => (
                        <div
                          key={eq.id}
                          className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-200 flex flex-col gap-2 text-xs hover:shadow-sm transition-all"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-zinc-800 text-sm truncate">{eq.type}</span>
                            {eq.tag && (
                              <span className="bg-zinc-200 text-zinc-600 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                                {eq.tag}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-zinc-500 font-medium pt-1">
                            <span>Marca/Modelo:</span>
                            <span className="text-zinc-800 font-semibold">{eq.brand} - {eq.model}</span>

                            <span>Nº Série:</span>
                            <span className="text-zinc-800 truncate font-semibold">{eq.serialNumber}</span>

                            {eq.capacity && (
                              <>
                                <span>Capacidade:</span>
                                <span className="text-zinc-800 font-semibold">{eq.capacity}</span>
                              </>
                            )}

                            {eq.location && (
                              <>
                                <span>Localização:</span>
                                <span className="text-zinc-800 truncate font-semibold">{eq.location}</span>
                              </>
                            )}
                          </div>
                          {eq.notes && (
                            <p className="mt-2 text-zinc-400 bg-white p-2 rounded border border-zinc-100 italic">
                              Obs: {eq.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: Contatos & Locais */}
              {activeTab === "locations" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Endereços */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-zinc-800 text-sm">Locais de Atendimento</h4>
                      {hasPermission("clients.write") && (
                        <button
                          onClick={() => setIsAddAddressOpen(true)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle size={14} /> Adicionar Endereço
                        </button>
                      )}
                    </div>

                    {clientDetails.addresses.length === 0 ? (
                      <div className="border border-dashed border-zinc-200 rounded-xl py-8 text-center text-zinc-400 text-xs">
                        Nenhum local cadastrado.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientDetails.addresses.map((addr) => (
                          <div key={addr.id} className="p-3 bg-zinc-50/50 border border-zinc-200 rounded-xl flex items-start gap-2.5 text-xs">
                            <MapPin className="text-zinc-400 shrink-0 mt-0.5" size={14} />
                            <div>
                              <p className="font-bold text-zinc-800">{addr.label}</p>
                              <p className="text-zinc-500 mt-0.5 leading-normal">
                                {addr.street}, nº {addr.number} {addr.complement && ` - ${addr.complement}`}
                                <br />
                                {addr.neighborhood} - {addr.city} / {addr.state} - CEP {addr.cep}
                              </p>
                              {addr.reference && <p className="text-[10px] text-zinc-400 italic mt-1">Ref: {addr.reference}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contatos */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-zinc-800 text-sm">Contatos / Funcionários</h4>
                      {hasPermission("clients.write") && (
                        <button
                          onClick={() => setIsAddContactOpen(true)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle size={14} /> Novo Contato
                        </button>
                      )}
                    </div>

                    {clientDetails.contacts.length === 0 ? (
                      <div className="border border-dashed border-zinc-200 rounded-xl py-8 text-center text-zinc-400 text-xs">
                        Nenhum contato cadastrado.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientDetails.contacts.map((cont) => (
                          <div key={cont.id} className="p-3 bg-zinc-50/50 border border-zinc-200 rounded-xl flex flex-col gap-1.5 text-xs">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-zinc-800">{cont.name}</span>
                              {cont.role && <span className="text-zinc-400 font-medium">{cont.role}</span>}
                            </div>
                            <div className="text-zinc-500 space-y-0.5 font-medium">
                              <p className="flex items-center gap-1.5"><Phone size={12} /> {formatPhone(cont.phone)}</p>
                              <p className="flex items-center gap-1.5"><Mail size={12} /> {cont.email}</p>
                            </div>
                            <div className="flex gap-1.5 mt-1">
                              {cont.isFinancial && <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-bold">Finanças</span>}
                              {cont.isTechnical && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-bold">Técnico</span>}
                              {cont.isApproval && <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[9px] font-bold">Aprova Propostas</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 3: Histórico Operacional */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  {/* Ordens de Serviço */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-zinc-800 text-sm flex items-center gap-1.5"><Wrench size={16} className="text-zinc-400" /> Ordens de Serviço (Execuções Técnicas)</h4>
                    {clientDetails.serviceOrders.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic pl-4">Nenhuma ordem de serviço registrada.</p>
                    ) : (
                      <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Código</th>
                              <th className="p-2.5">Tipo</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5">Agendado em</th>
                              <th className="p-2.5 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-medium">
                            {clientDetails.serviceOrders.map((os) => (
                              <tr key={os.id} className="hover:bg-zinc-50/50">
                                <td className="p-2.5 font-bold text-zinc-800">{os.code}</td>
                                <td className="p-2.5">{os.type}</td>
                                <td className="p-2.5">
                                  <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {os.status}
                                  </span>
                                </td>
                                <td className="p-2.5">{os.scheduledDate ? formatDate(os.scheduledDate) : "-"}</td>
                                <td className="p-2.5 text-right">
                                  <Link href={`/ordens-servico?code=${os.code}`} className="text-emerald-600 hover:text-emerald-700 underline font-bold">
                                    Ver OS
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Orçamentos */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-zinc-800 text-sm flex items-center gap-1.5"><FileText size={16} className="text-zinc-400" /> Orçamentos (Histórico Comercial)</h4>
                    {clientDetails.quotes.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic pl-4">Nenhum orçamento registrado.</p>
                    ) : (
                      <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Código</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5 text-right">Total</th>
                              <th className="p-2.5 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-medium">
                            {clientDetails.quotes.map((q) => (
                              <tr key={q.id} className="hover:bg-zinc-50/50">
                                <td className="p-2.5 font-bold text-zinc-800">{q.code}</td>
                                <td className="p-2.5">{q.status}</td>
                                <td className="p-2.5 text-right font-bold text-zinc-700">{formatCurrency(q.total)}</td>
                                <td className="p-2.5 text-right">
                                  <Link href={`/orcamentos?code=${q.code}`} className="text-emerald-600 hover:text-emerald-700 underline font-bold">
                                    Ver Proposta
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Notas Fiscais e Recebíveis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Invoices */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-800 text-xs flex items-center gap-1.5"><Receipt size={14} className="text-zinc-400" /> Notas Fiscais</h4>
                      {clientDetails.invoices.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic pl-4">Nenhuma NF emitida.</p>
                      ) : (
                        <div className="space-y-2">
                          {clientDetails.invoices.map((inv) => (
                            <div key={inv.id} className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-lg flex justify-between items-center text-xs">
                              <div>
                                <p className="font-bold text-zinc-800">{inv.code}</p>
                                <p className="text-zinc-400 text-[10px]">{formatDate(inv.issueDate)}</p>
                              </div>
                              <span className="font-bold text-zinc-700">{formatCurrency(inv.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Receivables */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-800 text-xs flex items-center gap-1.5"><DollarSign size={14} className="text-zinc-400" /> Contas a Receber</h4>
                      {clientDetails.receivables.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic pl-4">Nenhum recebível registrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {clientDetails.receivables.map((rec) => (
                            <div key={rec.id} className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-lg flex justify-between items-center text-xs">
                              <div>
                                <p className="font-bold text-zinc-800">Venc: {formatDate(rec.dueDate)}</p>
                                <p className={`text-[10px] font-bold ${
                                  rec.status === "PAGO" ? "text-emerald-600" : rec.status === "VENCIDO" ? "text-red-500 animate-pulse" : "text-amber-500"
                                }`}>
                                  {rec.status}
                                </p>
                              </div>
                              <span className="font-bold text-zinc-700">{formatCurrency(rec.totalValue)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Adicionar Cliente */}
      {isAddClientOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base">Cadastrar Novo Cliente</h3>
              <button onClick={() => setIsAddClientOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Nome Completo / Razão Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva ou Clínica Sorriso Ltda"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">CPF ou CNPJ (opcional)</label>
                  <input
                    type="text"
                    placeholder="Pode ser preenchido depois"
                    value={newClientForm.cpfCnpj}
                    onChange={(e) => setNewClientForm({ ...newClientForm, cpfCnpj: e.target.value.replace(/\D/g, "") })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Nome Fantasia (Se houver)</label>
                  <input
                    type="text"
                    placeholder="Ex: Sorriso Perfeito"
                    value={newClientForm.fancyName}
                    onChange={(e) => setNewClientForm({ ...newClientForm, fancyName: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">E-mail de Contato *</label>
                  <input
                    type="email"
                    required
                    placeholder="financeiro@empresa.com"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Telefone Principal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: (11) 99999-8888"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-8888"
                    value={newClientForm.whatsapp}
                    onChange={(e) => setNewClientForm({ ...newClientForm, whatsapp: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Inscrição Estadual</label>
                  <input
                    type="text"
                    placeholder="Apenas números"
                    value={newClientForm.stateRegistration}
                    onChange={(e) => setNewClientForm({ ...newClientForm, stateRegistration: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Segmento</label>
                  <input
                    type="text"
                    placeholder="Ex: Condomínio, Saúde, Residencial"
                    value={newClientForm.segment}
                    onChange={(e) => setNewClientForm({ ...newClientForm, segment: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Como nos conheceu?</label>
                  <input
                    type="text"
                    placeholder="Ex: Indicação, Google Ads"
                    value={newClientForm.origin}
                    onChange={(e) => setNewClientForm({ ...newClientForm, origin: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Observações Internas</label>
                <textarea
                  rows={2}
                  placeholder="Instruções de acesso, horários preferenciais..."
                  value={newClientForm.notes}
                  onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(false)}
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
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Contato */}
      {isAddContactOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base">Adicionar Novo Contato</h3>
              <button onClick={() => setIsAddContactOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContact} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={newContactForm.name}
                  onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Zelador, Gerente"
                    value={newContactForm.role}
                    onChange={(e) => setNewContactForm({ ...newContactForm, role: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Telefone *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: (11) 98888-7777"
                    value={newContactForm.phone}
                    onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">E-mail *</label>
                  <input
                    type="email"
                    required
                    placeholder="contato@exemplo.com"
                    value={newContactForm.email}
                    onChange={(e) => setNewContactForm({ ...newContactForm, email: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Responsabilidades</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContactForm.isFinancial}
                      onChange={(e) => setNewContactForm({ ...newContactForm, isFinancial: e.target.checked })}
                      className="rounded border-zinc-300 accent-emerald-600"
                    />
                    Contato Financeiro (Recebimento de boletos/NF)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContactForm.isTechnical}
                      onChange={(e) => setNewContactForm({ ...newContactForm, isTechnical: e.target.checked })}
                      className="rounded border-zinc-300 accent-emerald-600"
                    />
                    Contato Técnico (Acompanhamento em campo)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newContactForm.isApproval}
                      onChange={(e) => setNewContactForm({ ...newContactForm, isApproval: e.target.checked })}
                      className="rounded border-zinc-300 accent-emerald-600"
                    />
                    Contato para Aprovação (Aprova orçamentos)
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddContactOpen(false)}
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
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Endereço */}
      {isAddAddressOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base">Adicionar Local / Endereço</h3>
              <button onClick={() => setIsAddAddressOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAddress} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Identificador (Ex: Sede, Galpão) *</label>
                  <input
                    type="text"
                    required
                    value={newAddressForm.label}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, label: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">CEP *</label>
                  <input
                    type="text"
                    required
                    placeholder="00000-000"
                    value={newAddressForm.cep}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, cep: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Endereço (Rua/Av) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Av. Paulista"
                    value={newAddressForm.street}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Número *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 123"
                    value={newAddressForm.number}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, number: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Ex: Apto 51, Bloco A"
                    value={newAddressForm.complement}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, complement: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Bairro *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Centro"
                    value={newAddressForm.neighborhood}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, neighborhood: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Cidade *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: São Paulo"
                    value={newAddressForm.city}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Estado (UF) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={newAddressForm.state}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, state: e.target.value.toUpperCase() })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Ponto de Referência</label>
                  <input
                    type="text"
                    placeholder="Ex: Ao lado do banco..."
                    value={newAddressForm.reference}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, reference: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddAddressOpen(false)}
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
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Equipamento */}
      {isAddEquipmentOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base">Adicionar Equipamento Técnico</h3>
              <button onClick={() => setIsAddEquipmentOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Tipo de Equipamento *</label>
                  <select
                    value={newEquipmentForm.type}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, type: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Ar Condicionado Split">Ar Condicionado Split</option>
                    <option value="Quadro de Pressurização">Quadro de Pressurização</option>
                    <option value="Chiller Central">Chiller Central</option>
                    <option value="Painel Elétrico Geral">Painel Elétrico Geral</option>
                    <option value="Câmara Frigorífica">Câmara Frigorífica</option>
                    <option value="Outro">Outro Equipamento</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Daikin, Carrier, WEG"
                    value={newEquipmentForm.brand}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, brand: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Inverter 12k"
                    value={newEquipmentForm.model}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, model: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Número de Série *</label>
                  <input
                    type="text"
                    required
                    placeholder="SN-XXXXXX"
                    value={newEquipmentForm.serialNumber}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, serialNumber: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Capacidade / Detalhes</label>
                  <input
                    type="text"
                    placeholder="Ex: 12000 BTU, 220V"
                    value={newEquipmentForm.capacity}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, capacity: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Tag Interna (ID Identificador)</label>
                  <input
                    type="text"
                    placeholder="Ex: AC-CONSULTORIO-02"
                    value={newEquipmentForm.tag}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, tag: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 block mb-1">Local Exato de Instalação</label>
                  <input
                    type="text"
                    placeholder="Ex: Sala de cirurgia B, Subsolo"
                    value={newEquipmentForm.location}
                    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, location: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">Histórico / Observações de Instalação</label>
                <textarea
                  rows={2}
                  placeholder="Qualquer histórico importante do aparelho..."
                  value={newEquipmentForm.notes}
                  onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, notes: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddEquipmentOpen(false)}
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
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
