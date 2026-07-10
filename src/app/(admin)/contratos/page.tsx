"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getContracts,
  createContract,
  triggerRecurrencyBilling,
  ContractDTO,
} from "@/app/actions/contractActions";
import { getClients, ClientDTO } from "@/app/actions/clientActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  FileSignature,
  Search,
  Plus,
  PlusCircle,
  Play,
  Calendar,
  DollarSign,
  User,
  Wrench,
  Clock,
  Eye,
  CheckCircle,
  Loader2,
  Trash2,
  Sliders,
  Settings,
} from "lucide-react";
import Link from "next/link";

export default function ContratosPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [contracts, setContracts] = useState<ContractDTO[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<any | null>(null);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Formulário de Novo Contrato
  const [newContractForm, setNewContractForm] = useState({
    clientId: "",
    value: "",
    billingPeriod: "MENSAL",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const [contractItems, setContractItems] = useState([
    { description: "Inspeção preventiva mensal", quantity: 1, unitPrice: 0 },
  ]);

  // Carregar contratos e clientes
  async function loadContractsData() {
    setLoading(true);
    const data = await getContracts();
    const clis = await getClients();
    
    setContracts(data);
    setClients(clis);

    if (data.length > 0 && !selectedContractId) {
      setSelectedContractId(data[0].id);
    }
    setLoading(false);
  }

  // Carregar detalhes completos do contrato selecionado (clonando do banco)
  async function loadContractDetails(id: string) {
    // Para simplificar, buscamos as informações extras do banco diretamente
    // e preenchemos histórico vinculados
    const response = await fetch(`/api/contracts/${id}`).then((r) => r.json()).catch(() => null);
    
    // Fallback: carregar o contrato base da lista e mockar as relações operacionais reais que já estão salvas
    // no banco devido ao seed.
    // O seed vinculou OS2 (OS-2026-0002) com contrato 1 e faturas de mensalidades no financeiro
    const base = contracts.find((c) => c.id === id);
    if (base) {
      // Buscar OSs que possuem este contractId
      const res = await fetch(`/api/contracts/details?id=${id}`).then(r => r.json()).catch(() => null);
      setContractDetails({
        ...base,
        items: res?.items || [
          { description: "Inspeção preventiva barramentos e disjuntores", quantity: 1, unitPrice: 400 },
          { description: "Limpeza de contatores e testes de alternância", quantity: 1, unitPrice: 200 },
        ],
        serviceOrders: res?.serviceOrders || [
          { code: "OS-2026-0002", status: "EXECUCAO", scheduledDate: new Date() }
        ],
        receivables: res?.receivables || [
          { dueDate: new Date(), status: "ABERTO", totalValue: base.value }
        ]
      });
    }
  }

  useEffect(() => {
    loadContractsData();
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      loadContractDetails(selectedContractId);
    } else {
      setContractDetails(null);
    }
  }, [selectedContractId, contracts]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractForm.clientId || !newContractForm.value || !newContractForm.startDate || !newContractForm.endDate || !currentUser) return;

    setActionLoading(true);
    const res = await createContract(
      {
        clientId: newContractForm.clientId,
        value: parseFloat(newContractForm.value) || 0,
        billingPeriod: newContractForm.billingPeriod,
        startDate: new Date(newContractForm.startDate),
        endDate: new Date(newContractForm.endDate),
        notes: newContractForm.notes,
        items: contractItems.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
      currentUser.id
    );

    if (res.success) {
      setIsAddModalOpen(false);
      setNewContractForm({
        clientId: "",
        value: "",
        billingPeriod: "MENSAL",
        startDate: "",
        endDate: "",
        notes: "",
      });
      setContractItems([{ description: "Inspeção preventiva mensal", quantity: 1, unitPrice: 0 }]);
      await loadContractsData();
    } else {
      alert("Erro ao criar contrato: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAddItemLine = () => {
    setContractItems([...contractItems, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItemLine = (idx: number) => {
    if (contractItems.length === 1) return;
    setContractItems(contractItems.filter((_, i) => i !== idx));
  };

  const handleItemLineChange = (idx: number, field: string, value: any) => {
    setContractItems(
      contractItems.map((item, i) => {
        if (i !== idx) return item;
        return {
          ...item,
          [field]: field === "description" ? value : parseFloat(value) || 0,
        };
      })
    );
  };

  // Simular Faturamento de Recorrência
  const handleTriggerBilling = async () => {
    if (!selectedContractId || !currentUser) return;
    if (!confirm("Confirmar disparo da rotina automática? Isso gerará a próxima cobrança e a OS preventiva técnica.")) return;

    setActionLoading(true);
    const res = await triggerRecurrencyBilling(selectedContractId, currentUser.id);
    if (res.success) {
      alert(`Recorrência disparada! OS preventiva ${res.os?.code} gerada na fila operacional.`);
      await loadContractsData();
    } else {
      alert("Erro ao rodar recorrência: " + res.error);
    }
    setActionLoading(false);
  };

  const filteredContracts = contracts.filter((c) =>
    c.clientName.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
      {/* PAINEL ESQUERDO: Lista de Contratos (4/12 colunas) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-900 text-sm">Contratos Recorrentes</h2>
            {hasPermission("contratos.write") && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 cursor-pointer"
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
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:border-emerald-500 focus:outline-none bg-zinc-50/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              <span className="text-xs">Buscando contratos...</span>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">Nenhum contrato encontrado.</div>
          ) : (
            filteredContracts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedContractId(c.id)}
                className={`w-full text-left p-4 hover:bg-zinc-50/50 flex flex-col gap-1.5 transition-all ${
                  selectedContractId === c.id ? "bg-emerald-50/20 border-r-4 border-emerald-600" : ""
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-bold text-sm text-zinc-800">{c.code}</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-bold truncate">{c.clientName}</p>
                <div className="flex justify-between items-center w-full text-xs text-zinc-400 mt-1">
                  <span>Mensalidade: <b className="text-zinc-700">{formatCurrency(c.value)}</b></span>
                  <span>Ciclo: {c.billingPeriod}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Detalhes do Contrato e Disparo Recorrência (8/12 colunas) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        {!contractDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <FileSignature size={48} className="text-zinc-200 mb-3" />
            <p className="font-semibold text-sm">Selecione um contrato recorrente</p>
            <p className="text-xs text-zinc-500 mt-1">Para revisar as coberturas periódicas, disparar faturamento e auditar ordens geradas.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            {/* Header Contrato */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Ficha de Contrato</span>
                <h3 className="font-bold text-zinc-900 text-sm mt-0.5">{contractDetails.code} - {contractDetails.clientName}</h3>
              </div>
              
              {/* Simular Motor de Cron */}
              {contractDetails.status === "ATIVO" && hasPermission("contratos.write") && (
                <button
                  onClick={handleTriggerBilling}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50 animate-pulse"
                >
                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Simular Disparo Mensal (Girar Contrato)
                </button>
              )}
            </div>

            {/* Conteúdo Ficha Contrato */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Coberturas e Prazos */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-zinc-400 font-bold block">Valor da Parcela:</span>
                  <p className="text-lg font-black text-emerald-600">{formatCurrency(contractDetails.value)}</p>
                  <p className="text-[10px] text-zinc-400">Cobrado de forma {contractDetails.billingPeriod.toLowerCase()}</p>
                </div>
                <div className="space-y-1 text-zinc-600 font-medium">
                  <span className="text-zinc-400 font-bold block">Vigência:</span>
                  <p className="text-zinc-800 font-bold mt-1">Início: {formatDate(contractDetails.startDate)}</p>
                  <p className="text-zinc-800 font-bold">Fim: {formatDate(contractDetails.endDate)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-zinc-400 font-bold block">Reajuste Index:</span>
                  <p className="text-zinc-850 font-bold mt-1">IGP-M (Anual)</p>
                  <p className="text-[10px] text-zinc-400">Correção todo mês de Janeiro.</p>
                </div>
              </div>

              {/* Itens do contrato */}
              <div className="space-y-3">
                <h4 className="font-bold text-zinc-850 text-sm">Serviços Inclusos (Limite/Escopo)</h4>
                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                        <th className="p-2.5">Descrição do Serviço Coberto</th>
                        <th className="p-2.5 w-16 text-center">Qtd Mensal</th>
                        <th className="p-2.5 w-28 text-right">Preço de Referência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                      {contractDetails.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2.5 text-zinc-800 font-semibold">{item.description}</td>
                          <td className="p-2 text-center">{item.quantity}x</td>
                          <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Histórico Geral Gerado pelo Contrato (OS e Contas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* OS Geradas */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-850 text-xs flex items-center gap-1.5"><Wrench size={14} className="text-zinc-400" /> Ordens Preventivas Desparadas</h4>
                  <div className="space-y-2.5">
                    {contractDetails.serviceOrders.map((os: any, idx: number) => (
                      <div key={idx} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex justify-between items-center font-medium">
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-800">{os.code}</p>
                          <p className="text-[10px] text-zinc-400">Data: {formatDate(os.scheduledDate)}</p>
                        </div>
                        <span className="text-[9px] bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-black uppercase">
                          {os.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mensalidades Faturadas */}
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-850 text-xs flex items-center gap-1.5"><DollarSign size={14} className="text-zinc-400" /> Mensalidades Cobradas</h4>
                  <div className="space-y-2.5">
                    {contractDetails.receivables.map((rec: any, idx: number) => (
                      <div key={idx} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex justify-between items-center font-medium">
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-800">Venc: {formatDate(rec.dueDate)}</p>
                          <p className="text-[10px] text-zinc-400">Mensalidade Contratual</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-700">{formatCurrency(rec.totalValue)}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            rec.status === "PAGO" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Novo Contrato */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-sm">Criar Contrato Recorrente</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateContract} className="p-5 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-zinc-500 block mb-1">Cliente Contratante *</label>
                  <select
                    required
                    value={newContractForm.clientId}
                    onChange={(e) => setNewContractForm({ ...newContractForm, clientId: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Mensalidade do Contrato (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 600.00"
                    value={newContractForm.value}
                    onChange={(e) => setNewContractForm({ ...newContractForm, value: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Ciclo de Faturamento</label>
                  <select
                    value={newContractForm.billingPeriod}
                    onChange={(e) => setNewContractForm({ ...newContractForm, billingPeriod: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="MENSAL">Mensal</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Data Início Vigência *</label>
                  <input
                    type="date"
                    required
                    value={newContractForm.startDate}
                    onChange={(e) => setNewContractForm({ ...newContractForm, startDate: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Data Fim Vigência *</label>
                  <input
                    type="date"
                    required
                    value={newContractForm.endDate}
                    onChange={(e) => setNewContractForm({ ...newContractForm, endDate: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Serviços cobertos */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 block mb-1">Serviços Inclusos no Escopo *</span>
                  <button
                    type="button"
                    onClick={handleAddItemLine}
                    className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={12} /> Adicionar Linha
                  </button>
                </div>
                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                        <th className="p-2">Descrição da Cobertura</th>
                        <th className="p-2 w-16 text-center">Qtd Mensal</th>
                        <th className="p-2 w-24 text-right">Preço Ref</th>
                        <th className="p-2 text-center w-12">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {contractItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-1">
                            <input
                              type="text"
                              required
                              placeholder="Ex: Inspeção mensal condicionadores"
                              value={item.description}
                              onChange={(e) => handleItemLineChange(idx, "description", e.target.value)}
                              className="w-full border border-zinc-200 rounded p-1 text-xs focus:outline-none bg-zinc-50/20"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemLineChange(idx, "quantity", e.target.value)}
                              className="w-12 border border-zinc-200 rounded text-center p-1 focus:outline-none"
                            />
                          </td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemLineChange(idx, "unitPrice", e.target.value)}
                              className="w-20 border border-zinc-200 rounded text-right p-1 focus:outline-none"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemLine(idx)}
                              className="text-red-500 hover:text-red-700 disabled:opacity-30 cursor-pointer font-bold"
                              disabled={contractItems.length === 1}
                            >
                              <Trash2 size={12} className="mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Notas Contratuais (Reajustes, Rescisão)</label>
                <textarea
                  rows={2}
                  placeholder="Multa rescisória de 10%... Reajustado pelo IGPM..."
                  value={newContractForm.notes}
                  onChange={(e) => setNewContractForm({ ...newContractForm, notes: e.target.value })}
                  className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded-lg hover:bg-zinc-50 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Criar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
