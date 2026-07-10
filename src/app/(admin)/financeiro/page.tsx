"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReceivables,
  getPayables,
  getBankAccounts,
  getTransactions,
  receivePayment,
  payBill,
  createPayable,
  estornoTransaction,
  ReceivableDTO,
  PayableDTO,
} from "@/app/actions/financialActions";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Plus,
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Building,
  CreditCard,
  Calendar,
  Eye,
  Loader2,
  Trash2,
  Tag,
} from "lucide-react";

export default function FinanceiroPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"receivables" | "payables" | "ledger" | "dre">("receivables");
  
  // Dados do Financeiro
  const [receivables, setReceivables] = useState<ReceivableDTO[]>([]);
  const [payables, setPayables] = useState<PayableDTO[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Controle de Modais
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isEstornoModalOpen, setIsEstornoModalOpen] = useState(false);

  // Estados dos Formulários
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableDTO | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  
  const [receiveForm, setReceiveForm] = useState({
    receivedValue: 0,
    paymentMethod: "PIX",
    bankAccountId: "",
  });

  const [payableForm, setPayableForm] = useState({
    providerName: "",
    description: "",
    category: "PECA",
    costCenter: "GERAL",
    value: "",
    dueDate: "",
  });

  const [estornoForm, setEstornoForm] = useState({
    justification: "",
  });

  // Carregar dados gerais
  async function loadFinancialData() {
    setLoading(true);
    const recs = await getReceivables();
    const pays = await getPayables();
    const banks = await getBankAccounts();
    const txs = await getTransactions();

    setReceivables(recs);
    setPayables(pays);
    setBankAccounts(banks);
    setTransactions(txs);

    if (banks.length > 0) {
      setReceiveForm((prev) => ({ ...prev, bankAccountId: banks[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadFinancialData();
  }, []);

  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payableForm.providerName || !payableForm.value || !payableForm.dueDate || !currentUser) return;

    setActionLoading(true);
    const res = await createPayable(
      {
        providerName: payableForm.providerName,
        description: payableForm.description || "Despesa lançada",
        category: payableForm.category,
        costCenter: payableForm.costCenter,
        value: parseFloat(payableForm.value) || 0,
        dueDate: new Date(payableForm.dueDate),
      },
      currentUser.id
    );

    if (res.success) {
      setIsPayableModalOpen(false);
      setPayableForm({
        providerName: "",
        description: "",
        category: "PECA",
        costCenter: "GERAL",
        value: "",
        dueDate: "",
      });
      await loadFinancialData();
    } else {
      alert("Erro ao criar conta a pagar: " + res.error);
    }
    setActionLoading(false);
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable || !receiveForm.bankAccountId || !currentUser) return;

    setActionLoading(true);
    const res = await receivePayment({
      receivableId: selectedReceivable.id,
      receivedValue: receiveForm.receivedValue,
      paymentMethod: receiveForm.paymentMethod,
      bankAccountId: receiveForm.bankAccountId,
      userId: currentUser.id,
    });

    if (res.success) {
      setIsReceiveModalOpen(false);
      setSelectedReceivable(null);
      await loadFinancialData();
    } else {
      alert("Erro ao baixar recebimento: " + res.error);
    }
    setActionLoading(false);
  };

  const handlePayBill = async (payableId: string) => {
    if (!currentUser) return;
    if (bankAccounts.length === 0) {
      alert("Cadastre uma conta bancária antes de pagar.");
      return;
    }
    if (!confirm("Confirmar o pagamento e liquidação desta despesa?")) return;

    setActionLoading(true);
    const res = await payBill({
      payableId,
      paymentMethod: "BOLETO",
      bankAccountId: bankAccounts[0].id, // assume primeira conta padrão
      userId: currentUser.id,
    });

    if (res.success) {
      await loadFinancialData();
    } else {
      alert("Erro ao pagar conta: " + res.error);
    }
    setActionLoading(false);
  };

  const handleOpenEstorno = (txId: string) => {
    setSelectedTransactionId(txId);
    setEstornoForm({ justification: "" });
    setIsEstornoModalOpen(true);
  };

  const handleEstornoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransactionId || !estornoForm.justification || !currentUser) return;

    setActionLoading(true);
    const res = await estornoTransaction(
      selectedTransactionId,
      estornoForm.justification,
      currentUser.id
    );

    if (res.success) {
      setIsEstornoModalOpen(false);
      setSelectedTransactionId(null);
      await loadFinancialData();
    } else {
      alert("Erro ao processar estorno: " + res.error);
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAGO":
        return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "PARCIAL":
        return "bg-amber-50 text-amber-600 border border-amber-100";
      case "VENCIDO":
        return "bg-red-50 text-red-600 border border-red-200 animate-pulse";
      case "ABERTO":
        return "bg-zinc-100 text-zinc-600 border border-zinc-200";
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  // Calcular DRE com base nas transações de caixa reais
  const getDREMetrics = () => {
    const validTxs = transactions.filter((t) => t.category !== "ESTORNO");
    const receitaServico = validTxs.filter((t) => t.type === "RECEITA" && t.category === "RECEITA_SERVICO").reduce((sum, t) => sum + t.value, 0);
    const receitaContrato = validTxs.filter((t) => t.type === "RECEITA" && t.category === "CONTRATO").reduce((sum, t) => sum + t.value, 0);
    const receitaTotal = receitaServico + receitaContrato;

    const custoPeca = validTxs.filter((t) => t.type === "DESPESA" && t.category === "PECA").reduce((sum, t) => sum + t.value, 0);
    const despesaAluguel = validTxs.filter((t) => t.type === "DESPESA" && t.category === "ALUGUEL").reduce((sum, t) => sum + t.value, 0);
    const despesaCombustivel = validTxs.filter((t) => t.type === "DESPESA" && t.category === "COMBUSTIVEL").reduce((sum, t) => sum + t.value, 0);
    const despesaOutros = validTxs.filter((t) => t.type === "DESPESA" && !["PECA", "ALUGUEL", "COMBUSTIVEL"].includes(t.category)).reduce((sum, t) => sum + t.value, 0);

    const custoTotal = custoPeca + despesaAluguel + despesaCombustivel + despesaOutros;
    const lucroLiquido = receitaTotal - custoTotal;

    return {
      receitaServico,
      receitaContrato,
      receitaTotal,
      custoPeca,
      despesaAluguel,
      despesaCombustivel,
      despesaOutros,
      custoTotal,
      lucroLiquido,
    };
  };

  const dre = getDREMetrics();

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-500">Carregando módulo financeiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contas Bancárias & Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {bankAccounts.map((bank) => (
          <div
            key={bank.id}
            className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Saldo em Conta</span>
              <h4 className="font-bold text-zinc-900 text-sm">{bank.name}</h4>
              <p className="text-2xl font-black text-zinc-950 mt-1">{formatCurrency(bank.balance)}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <Building className="text-emerald-600" size={24} />
            </div>
          </div>
        ))}

        {/* Resumo Contas a Receber e Contas a Pagar */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between md:col-span-1">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">A Receber vs A Pagar</span>
            <div className="flex gap-4 pt-1">
              <div>
                <span className="text-[10px] text-zinc-400">Pendente:</span>
                <p className="text-sm font-extrabold text-emerald-600">
                  {formatCurrency(receivables.filter((r) => r.status !== "PAGO").reduce((sum, r) => sum + r.pendingValue, 0))}
                </p>
              </div>
              <div className="border-r border-zinc-200 my-0.5"></div>
              <div>
                <span className="text-[10px] text-zinc-400">Pagar:</span>
                <p className="text-sm font-extrabold text-red-500">
                  {formatCurrency(payables.filter((p) => p.status !== "PAGO").reduce((sum, p) => sum + p.value, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Abas e Filtros */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[480px]">
        {/* Cabeçalho de Navegação Abas */}
        <div className="border-b border-zinc-100 flex justify-between items-center px-6 bg-zinc-50/50 flex-wrap gap-2 py-2">
          <div className="flex">
            <button
              onClick={() => setActiveTab("receivables")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "receivables"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <TrendingUp size={14} /> Contas a Receber
            </button>
            <button
              onClick={() => setActiveTab("payables")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "payables"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <TrendingDown size={14} /> Contas a Pagar
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "ledger"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Activity size={14} /> Caixa & Extrato
            </button>
            <button
              onClick={() => setActiveTab("dre")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "dre"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <DollarSign size={14} /> DRE Gerencial
            </button>
          </div>

          <div>
            {activeTab === "payables" && hasPermission("financeiro.write") && (
              <button
                onClick={() => setIsPayableModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                <Plus size={14} /> Lançar Despesa
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="flex-1 p-6">
          {/* TAB 1: Contas a Receber */}
          {activeTab === "receivables" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Cliente</th>
                    <th className="p-3">OS Origem</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Forma</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-right">Valor Pago</th>
                    <th className="p-3 text-right">Aberto (Pendente)</th>
                    <th className="p-3 text-center">Liquidar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {receivables.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400 italic">Nenhum recebível cadastrado.</td>
                    </tr>
                  ) : (
                    receivables.map((rec) => (
                      <tr key={rec.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-800 font-bold">{rec.clientName}</td>
                        <td className="p-3 font-semibold text-zinc-500">{rec.osCode || "Direto"}</td>
                        <td className="p-3">{formatDate(rec.dueDate)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getStatusBadge(rec.status)}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-zinc-400">{rec.paymentMethod || "BOLETO"}</td>
                        <td className="p-3 text-right text-zinc-700">{formatCurrency(rec.totalValue)}</td>
                        <td className="p-3 text-right text-emerald-600">{formatCurrency(rec.receivedValue)}</td>
                        <td className="p-3 text-right text-zinc-900 font-bold">{formatCurrency(rec.pendingValue)}</td>
                        <td className="p-3 text-center">
                          {rec.status !== "PAGO" && hasPermission("financeiro.write") ? (
                            <button
                              onClick={() => {
                                setSelectedReceivable(rec);
                                setReceiveForm({
                                  receivedValue: rec.pendingValue,
                                  paymentMethod: rec.paymentMethod || "PIX",
                                  bankAccountId: bankAccounts[0]?.id || "",
                                });
                                setIsReceiveModalOpen(true);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Baixar
                            </button>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Contas a Pagar */}
          {activeTab === "payables" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Fornecedor</th>
                    <th className="p-3">Descrição / Finalidade</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-center">Liquidar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {payables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 italic">Nenhuma despesa cadastrada.</td>
                    </tr>
                  ) : (
                    payables.map((pay) => (
                      <tr key={pay.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-800 font-bold">{pay.providerName}</td>
                        <td className="p-3 text-zinc-500 truncate max-w-xs">{pay.description}</td>
                        <td className="p-3 font-semibold text-zinc-400">{pay.category}</td>
                        <td className="p-3">{formatDate(pay.dueDate)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getStatusBadge(pay.status)}`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-red-500 font-bold">{formatCurrency(pay.value)}</td>
                        <td className="p-3 text-center">
                          {pay.status !== "PAGO" && hasPermission("financeiro.write") ? (
                            <button
                              onClick={() => handlePayBill(pay.id)}
                              className="px-2 py-1 bg-zinc-950 text-white hover:bg-zinc-850 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Registrar Pago
                            </button>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Extrato e Histórico de Transações */}
          {activeTab === "ledger" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Descrição da Transação</th>
                    <th className="p-3">Conta</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Valor Liquido</th>
                    <th className="p-3 text-center">Estornar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 italic">Nenhuma transação financeira efetuada.</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-400">{formatDateTime(tx.date)}</td>
                        <td className="p-3 text-zinc-800 font-bold">{tx.description}</td>
                        <td className="p-3 font-semibold text-zinc-500">{tx.bankAccount?.name || "Caixa Geral"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            tx.category === "ESTORNO" ? "bg-red-100 text-red-600 border border-red-200" : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-3">
                          {tx.type === "RECEITA" ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">Entrada</span>
                          ) : (
                            <span className="text-red-500 font-bold flex items-center gap-1">Saída</span>
                          )}
                        </td>
                        <td className={`p-3 text-right font-black ${
                          tx.type === "RECEITA" ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {tx.type === "RECEITA" ? "+" : "-"}{formatCurrency(tx.value)}
                        </td>
                        <td className="p-3 text-center">
                          {tx.category !== "ESTORNO" && hasPermission("financeiro.write") ? (
                            <button
                              onClick={() => handleOpenEstorno(tx.id)}
                              className="p-1 border border-zinc-200 hover:border-red-200 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded transition-all cursor-pointer"
                              title="Estornar esta transação"
                            >
                              <RotateCcw size={12} className="mx-auto" />
                            </button>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: DRE Gerencial de Competência de Caixa */}
          {activeTab === "dre" && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-zinc-900">Resultado Financeiro Real (Competência de Caixa)</h4>
                  <p className="text-zinc-500 mt-0.5">Valores calculados em tempo real a partir das transações de extrato liquidadas.</p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1 bg-zinc-950 text-white rounded-full uppercase tracking-wider">
                  Mês de Referência: Atual
                </span>
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                      <th className="p-3">Categoria Contábil</th>
                      <th className="p-3 text-right">Realizado</th>
                      <th className="p-3 text-right">Fração (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-semibold">
                    {/* Receitas */}
                    <tr className="bg-zinc-50/50">
                      <td className="p-3 text-zinc-900 font-bold">1. RECEITAS OPERACIONAIS BRUTAS</td>
                      <td className="p-3 text-right text-emerald-600 font-bold">{formatCurrency(dre.receitaTotal)}</td>
                      <td className="p-3 text-right text-zinc-500">100%</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">1.1 Receitas de Serviços Técnicos</td>
                      <td className="p-3 text-right text-zinc-700 font-bold">{formatCurrency(dre.receitaServico)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.receitaServico / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">1.2 Faturamento de Contratos Recorrentes</td>
                      <td className="p-3 text-right text-zinc-700 font-bold">{formatCurrency(dre.receitaContrato)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.receitaContrato / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>

                    {/* Despesas */}
                    <tr className="bg-zinc-50/50">
                      <td className="p-3 text-zinc-900 font-bold">2. (-) DESPESAS E CUSTOS OPERACIONAIS</td>
                      <td className="p-3 text-right text-red-500 font-bold">{formatCurrency(dre.custoTotal)}</td>
                      <td className="p-3 text-right text-zinc-500">
                        {dre.receitaTotal > 0 ? ((dre.custoTotal / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">2.1 Aquisição de Peças (Almoxarifado)</td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(dre.custoPeca)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.custoPeca / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">2.2 Despesas de Ocupação (Aluguel Sede)</td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(dre.despesaAluguel)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.despesaAluguel / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">2.3 Logística e Reembolso Combustível</td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(dre.despesaCombustivel)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.despesaCombustivel / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-zinc-500 pl-6 font-medium">2.4 Outras Despesas Administrativas</td>
                      <td className="p-3 text-right text-red-500">{formatCurrency(dre.despesaOutros)}</td>
                      <td className="p-3 text-right text-zinc-400">
                        {dre.receitaTotal > 0 ? ((dre.despesaOutros / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>

                    {/* Lucro Líquido */}
                    <tr className="bg-zinc-950 text-white font-black">
                      <td className="p-3">(=) RESULTADO LÍQUIDO DO PERÍODO</td>
                      <td className={`p-3 text-right ${dre.lucroLiquido >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatCurrency(dre.lucroLiquido)}
                      </td>
                      <td className="p-3 text-right">
                        {dre.receitaTotal > 0 ? ((dre.lucroLiquido / dre.receitaTotal) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Lançar Conta a Pagar (Despesa) */}
      {isPayableModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <h3 className="font-bold text-zinc-800 text-base">Lançar Despesa (Contas a Pagar)</h3>
              <button onClick={() => setIsPayableModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreatePayable} className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-zinc-500 block mb-1">Credor / Fornecedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Auto Posto BR"
                  value={payableForm.providerName}
                  onChange={(e) => setPayableForm({ ...payableForm, providerName: e.target.value })}
                  className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 block mb-1">Valor do Documento (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 450.00"
                    value={payableForm.value}
                    onChange={(e) => setPayableForm({ ...payableForm, value: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Data Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={payableForm.dueDate}
                    onChange={(e) => setPayableForm({ ...payableForm, dueDate: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Categoria Despesa</label>
                  <select
                    value={payableForm.category}
                    onChange={(e) => setPayableForm({ ...payableForm, category: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="PECA">Peças / Materiais</option>
                    <option value="COMBUSTIVEL">Combustível / Viagem</option>
                    <option value="ALUGUEL">Aluguel / Ocupação</option>
                    <option value="FERRAMENTAS">Ferramentas / Equipamentos</option>
                    <option value="IMPOSTOS">Impostos e Retenções</option>
                    <option value="FOLHA">Folha de Pagamento</option>
                    <option value="MARKETING">Marketing / Vendas</option>
                    <option value="OUTROS">Outras Despesas</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Centro de Custo</label>
                  <select
                    value={payableForm.costCenter}
                    onChange={(e) => setPayableForm({ ...payableForm, costCenter: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="GERAL">Geral / Administrativo</option>
                    <option value="EQUIPE_TECNICA">Equipe Operacional</option>
                    <option value="MATRIZ">Escritório Matriz</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-zinc-500 block mb-1">Descrição / Finalidade</label>
                <input
                  type="text"
                  placeholder="Ex: Compra de disjuntores Schneider..."
                  value={payableForm.description}
                  onChange={(e) => setPayableForm({ ...payableForm, description: e.target.value })}
                  className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayableModalOpen(false)}
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
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Baixar Contas a Receber (Liquidação) */}
      {isReceiveModalOpen && selectedReceivable && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cliente: {selectedReceivable.clientName}</span>
                <h3 className="font-bold text-zinc-800 text-sm mt-0.5">Registrar Recebimento de Cobrança</h3>
              </div>
              <button onClick={() => setIsReceiveModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="p-5 space-y-4 text-xs font-semibold">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 flex justify-between items-center mb-2">
                <div>
                  <span className="text-[10px] text-zinc-400 font-medium">Saldo Pendente:</span>
                  <p className="text-base font-extrabold text-zinc-900">{formatCurrency(selectedReceivable.pendingValue)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-medium block text-right">Vencimento:</span>
                  <p className="text-zinc-700">{formatDate(selectedReceivable.dueDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 block mb-1">Valor Recebido (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    max={selectedReceivable.pendingValue}
                    value={receiveForm.receivedValue}
                    onChange={(e) => setReceiveForm({ ...receiveForm, receivedValue: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-right focus:outline-none"
                  />
                  <span className="text-[9px] text-zinc-400 mt-1 block">Aceita recebimento parcial!</span>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Forma de Pagamento</label>
                  <select
                    value={receiveForm.paymentMethod}
                    onChange={(e) => setReceiveForm({ ...receiveForm, paymentMethod: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="PIX">Pix Link / QR Code</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="CARTAO">Cartão de Crédito</option>
                    <option value="TRANSFERENCIA">Transferência / TED</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-zinc-500 block mb-1">Destinar para Conta Bancária *</label>
                  <select
                    required
                    value={receiveForm.bankAccountId}
                    onChange={(e) => setReceiveForm({ ...receiveForm, bankAccountId: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    {bankAccounts.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name} (Saldo: {formatCurrency(bank.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded-lg hover:bg-zinc-50 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || receiveForm.receivedValue <= 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Estornar Transação (Reversão Rastreável) */}
      {isEstornoModalOpen && selectedTransactionId && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-base flex items-center gap-1.5 text-red-600">
                <AlertTriangle size={18} /> Estornar e Reverter Lançamento
              </h3>
              <button onClick={() => setIsEstornoModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleEstornoSubmit} className="p-5 space-y-4 text-xs font-semibold">
              <p className="text-zinc-500 leading-normal">
                Esta ação irá reverter o saldo do banco correspondente, atualizar a fatura de volta para pendente/aberta e registrar o log de estorno no extrato de caixa.
              </p>
              <div>
                <label className="text-zinc-500 block mb-1">Motivo / Justificativa do Estorno *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Erro de digitação no valor recebido... Boleto compensado incorretamente..."
                  value={estornoForm.justification}
                  onChange={(e) => setEstornoForm({ justification: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEstornoModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded-lg hover:bg-zinc-50 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!estornoForm.justification || actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Confirmar Estorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
