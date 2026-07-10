"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBillingQueue, processBilling, BillingQueueItem } from "@/app/actions/billingActions";
import { getServiceOrderDetails } from "@/app/actions/osActions";
import { formatCurrency, formatDate, formatCpfCnpj } from "@/lib/utils";
import {
  Receipt,
  Search,
  FileCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Wrench,
  CheckCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  Calendar,
  CreditCard,
  PlusCircle,
  Loader2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function FaturamentoPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [queue, setQueue] = useState<BillingQueueItem[]>([]);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [osDetails, setOsDetails] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Formulário de Faturamento
  const [billingForm, setBillingForm] = useState({
    invoiceCode: "",
    taxPercent: 5.0, // 5% de ISS padrão
    installments: 1, // À vista
    paymentMethod: "BOLETO",
    category: "RECEITA_SERVICO",
    costCenter: "GERAL",
    notes: "",
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Carregar fila de faturamento
  async function loadQueue() {
    setLoadingList(true);
    const data = await getBillingQueue();
    setQueue(data);
    setLoadingList(false);

    // Sugerir próximo número de NF-e
    setBillingForm((prev) => ({
      ...prev,
      invoiceCode: `NF-${String(100 + data.length + Math.floor(Math.random() * 100)).padStart(6, "0")}`,
    }));

    if (data.length > 0 && !selectedOSId) {
      setSelectedOSId(data[0].id);
    }
  }

  // Carregar prontuário da OS selecionada
  async function loadDetails(id: string) {
    setLoadingDetails(true);
    const details = await getServiceOrderDetails(id);
    setOsDetails(details);
    setLoadingDetails(false);
  }

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (selectedOSId) {
      loadDetails(selectedOSId);
    } else {
      setOsDetails(null);
    }
  }, [selectedOSId]);

  const handleOSSelect = (id: string) => {
    setSelectedOSId(id);
    // Sugerir novo número de fatura
    setBillingForm((prev) => ({
      ...prev,
      invoiceCode: `NF-${String(102 + Math.floor(Math.random() * 100)).padStart(6, "0")}`,
    }));
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!osDetails || !currentUser) return;

    // Calcular o total final
    const itemsVal = osDetails.items.reduce((sum: number, i: any) => sum + i.total, 0);
    const partsVal = osDetails.materials
      .filter((m: any) => m.status === "UTILIZADO")
      .reduce((sum: number, m: any) => sum + m.usedQuantity * m.salePrice, 0);
    const totalValue = itemsVal + partsVal;

    if (!billingForm.invoiceCode) {
      alert("Digite o número da Nota Fiscal.");
      return;
    }

    if (!confirm(`Deseja confirmar o faturamento da OS ${osDetails.code} no valor de ${formatCurrency(totalValue)}?`)) {
      return;
    }

    setActionLoading(true);
    const res = await processBilling({
      osId: osDetails.id,
      invoiceCode: billingForm.invoiceCode,
      totalValue,
      taxPercent: billingForm.taxPercent,
      installments: billingForm.installments,
      paymentMethod: billingForm.paymentMethod,
      category: billingForm.category,
      costCenter: billingForm.costCenter,
      notes: billingForm.notes,
      userId: currentUser.id,
    });

    if (res.success) {
      alert("Faturamento processado com sucesso! Cobranças agendadas no Contas a Receber.");
      setSelectedOSId(null);
      await loadQueue();
    } else {
      alert("Erro ao processar faturamento: " + res.error);
    }
    setActionLoading(false);
  };

  // Calcular totais
  const getTotals = () => {
    if (!osDetails) return { subtotal: 0, parts: 0, total: 0, tax: 0 };

    const subtotal = osDetails.items.reduce((sum: number, i: any) => sum + i.total, 0);
    const parts = osDetails.materials
      .filter((m: any) => m.status === "UTILIZADO")
      .reduce((sum: number, m: any) => sum + m.usedQuantity * m.salePrice, 0);
    const total = subtotal + parts;
    const tax = total * (billingForm.taxPercent / 100);

    return { subtotal, parts, total, tax };
  };

  const totals = getTotals();

  if (!hasPermission("faturamento.read")) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-12 text-center max-w-lg mx-auto mt-12 space-y-4">
        <AlertTriangle size={48} className="text-red-500 mx-auto" />
        <h3 className="font-bold text-zinc-800 text-base">Acesso Negado</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Seu perfil atual ({currentUser?.roleName}) não possui permissão para acessar o faturamento da empresa. Alterne para o perfil **Faturamento**, **Administrador** ou **Financeiro** no topo para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
      {/* PAINEL ESQUERDO: Fila de Faturamento (4/12 colunas) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col gap-3">
          <h2 className="font-bold text-zinc-900 text-sm">Fila de OS para Faturar</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por OS, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-xs focus:border-emerald-500 focus:outline-none bg-zinc-50/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {loadingList ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              <span className="text-xs">Buscando fila...</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">Nenhuma OS pronta para faturar</div>
          ) : (
            queue
              .filter((os) => os.code.includes(search) || os.clientName.toLowerCase().includes(search.toLowerCase()))
              .map((os) => (
                <button
                  key={os.id}
                  onClick={() => handleOSSelect(os.id)}
                  className={`w-full text-left p-4 hover:bg-zinc-50/50 flex flex-col gap-1.5 transition-all ${
                    selectedOSId === os.id ? "bg-emerald-50/20 border-r-4 border-emerald-600" : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm text-zinc-800">{os.code}</span>
                    <span className="text-[10px] text-zinc-400 font-bold">
                      {os.completedAt ? formatDate(os.completedAt) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-bold truncate">{os.clientName}</p>
                  <div className="flex justify-between items-center w-full text-xs font-semibold pt-1">
                    <span className="text-zinc-400 font-normal">Total a faturar:</span>
                    <span className="text-zinc-700">{formatCurrency(os.value)}</span>
                  </div>
                </button>
              ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Conferência e Faturamento (8/12 colunas) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        {loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-zinc-400">Carregando prontuário operacional...</p>
          </div>
        ) : !osDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <Receipt size={48} className="text-zinc-200 mb-3" />
            <p className="font-semibold text-sm">Selecione uma Ordem de Serviço da fila</p>
            <p className="text-xs text-zinc-500 mt-1">Para realizar auditoria de escopo, conferência de impostos e emitir notas.</p>
          </div>
        ) : (
          <form onSubmit={handleBillingSubmit} className="flex-1 flex flex-col overflow-hidden text-xs">
            {/* Header Faturamento */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Faturamento Ativo</span>
                <h3 className="font-bold text-zinc-900 text-sm mt-0.5">Conferência & Liquidação: {osDetails.code}</h3>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/relatorios?id=${osDetails.id}`}
                  className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  title="Ver laudo técnico de campo"
                >
                  <Eye size={12} /> Ver Relatório Técnico
                </Link>
              </div>
            </div>

            {/* Ficha de Conferência (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Passo 1: Conferência de Dados Cadastrais */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-800 flex items-center gap-1.5"><FileCheck size={14} className="text-emerald-600" /> Passo 1: Conferência de Dados de Cobrança</h4>
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 text-zinc-500 font-medium">
                    <span className="text-[9px] text-zinc-400 uppercase block font-bold">Sacado / Cliente</span>
                    <p className="font-bold text-zinc-800 text-sm">{osDetails.client.name}</p>
                    <p className="flex items-center gap-1"><Building2 size={12} /> CNPJ/CPF: {formatCpfCnpj(osDetails.client.cpfCnpj)}</p>
                    {osDetails.client.stateRegistration && <p>Inscr. Estadual: {osDetails.client.stateRegistration}</p>}
                  </div>
                  <div className="space-y-1 text-zinc-500 font-medium">
                    <span className="text-[9px] text-zinc-400 uppercase block font-bold">Endereço Fiscal</span>
                    <p className="flex items-start gap-1"><MapPin size={12} className="mt-0.5" /> 
                      <span>
                        {osDetails.address?.street}, {osDetails.address?.number}
                        <br />
                        {osDetails.address?.neighborhood} - {osDetails.address?.city}/{osDetails.address?.state} - CEP {osDetails.address?.cep}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Passo 2: Conferência de Itens do Contrato / Execução */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-800 flex items-center gap-1.5"><Wrench size={14} className="text-emerald-600" /> Passo 2: Auditoria de Escopo (O que foi executado)</h4>
                
                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                        <th className="p-2.5">Descrição do Item / Peça Aplicada</th>
                        <th className="p-2.5 w-16 text-center">Tipo</th>
                        <th className="p-2.5 w-16 text-center">Qtd</th>
                        <th className="p-2.5 w-24 text-right">Valor Unitário</th>
                        <th className="p-2.5 w-24 text-right font-bold text-zinc-800">Total Billed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {/* Serviços */}
                      {osDetails.items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-zinc-50/20">
                          <td className="p-2.5 text-zinc-800 font-semibold">{item.description}</td>
                          <td className="p-2 text-center text-[10px] text-zinc-400">SERVIÇO</td>
                          <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                          <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-2 text-right font-bold text-zinc-700">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      {/* Peças Utilizadas */}
                      {osDetails.materials
                        .filter((m: any) => m.status === "UTILIZADO")
                        .map((m: any) => (
                          <tr key={m.id} className="hover:bg-zinc-50/20">
                            <td className="p-2.5 text-zinc-800 font-semibold">{m.product.name}</td>
                            <td className="p-2 text-center text-[10px] text-zinc-400">PRODUTO</td>
                            <td className="p-2 text-center">{m.usedQuantity} {m.product.unit}</td>
                            <td className="p-2 text-right">{formatCurrency(m.salePrice)}</td>
                            <td className="p-2 text-right font-bold text-zinc-700">
                              {formatCurrency(m.usedQuantity * m.salePrice)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Passo 3: Parametrização da Fatura / Nota Fiscal e Cobranças */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-zinc-800 flex items-center gap-1.5"><Sliders size={14} className="text-emerald-600" /> Passo 3: Dados Tributários & Agendamento de Parcelas</h4>
                
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Nº Nota Fiscal (NF-e/NFS-e) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: NF-000102"
                      value={billingForm.invoiceCode}
                      onChange={(e) => setBillingForm({ ...billingForm, invoiceCode: e.target.value })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">ISS / Alíquota Imposto (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={billingForm.taxPercent}
                      onChange={(e) => setBillingForm({ ...billingForm, taxPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Forma de Cobrança</label>
                    <select
                      value={billingForm.paymentMethod}
                      onChange={(e) => setBillingForm({ ...billingForm, paymentMethod: e.target.value })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none font-semibold"
                    >
                      <option value="BOLETO">Boleto Bancário</option>
                      <option value="PIX">Pix Link / QR Code</option>
                      <option value="CARTAO">Cartão de Crédito</option>
                      <option value="TRANSFERENCIA">Transferência / TED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Parcelamento (Contas a Receber)</label>
                    <select
                      value={billingForm.installments}
                      onChange={(e) => setBillingForm({ ...billingForm, installments: parseInt(e.target.value) || 1 })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none font-semibold"
                    >
                      <option value={1}>1x (À vista no vencimento)</option>
                      <option value={2}>2x (30 / 60 dias)</option>
                      <option value={3}>3x (30 / 60 / 90 dias)</option>
                      <option value={4}>4x (mensal)</option>
                      <option value={6}>6x (mensal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Categoria Financeira</label>
                    <select
                      value={billingForm.category}
                      onChange={(e) => setBillingForm({ ...billingForm, category: e.target.value })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
                    >
                      <option value="RECEITA_SERVICO">Receita de Serviços</option>
                      <option value="VENDA_PECA">Venda de Peças</option>
                      <option value="CONTRATO">Mensalidade de Contrato</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Centro de Custo</label>
                    <select
                      value={billingForm.costCenter}
                      onChange={(e) => setBillingForm({ ...billingForm, costCenter: e.target.value })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
                    >
                      <option value="GERAL">Administração Geral</option>
                      <option value="EQUIPE_TECNICA">Instalações e Clima</option>
                      <option value="MATRIZ">Sede Matriz</option>
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Observações de Faturamento (Interno)</label>
                    <input
                      type="text"
                      placeholder="Ex: Faturado conforme regras do lote do contrato. Enviar boleto para Joana..."
                      value={billingForm.notes}
                      onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })}
                      className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Painel Resumo Faturamento (Live) */}
              <div className="bg-zinc-950 text-white rounded-2xl p-5 border border-zinc-800 space-y-2.5 font-semibold">
                <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                  <DollarSign size={14} className="text-emerald-400" /> Resumo Financeiro da Nota Fiscal e Cobranças
                </h5>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal Serviços:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal Peças Usadas:</span>
                  <span>{formatCurrency(totals.parts)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>(+) Imposto Retido Estimado ({billingForm.taxPercent}%):</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-zinc-100 pt-2 border-t border-zinc-900">
                  <span>Valor Líquido NF:</span>
                  <span className="text-emerald-400">{formatCurrency(totals.total)}</span>
                </div>
                {billingForm.installments > 1 && (
                  <div className="flex justify-between text-[11px] text-zinc-400 bg-zinc-900/50 p-2.5 rounded-lg mt-2 font-medium">
                    <span>Divisão: {billingForm.installments} parcelas mensais de</span>
                    <span className="font-bold text-zinc-100">{formatCurrency(totals.total / billingForm.installments)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer de Faturamento */}
            <div className="p-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50 shrink-0">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 size={12} className="animate-spin" />}
                Confirmar Faturamento & Emitir Fatura
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
