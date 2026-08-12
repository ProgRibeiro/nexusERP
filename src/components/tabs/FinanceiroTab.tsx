"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import {
  getReceivables,
  getPayables,
  getBankAccounts,
  getTransactions,
  receivePayment,
  payBill,
  createPayable,
  createReceivable,
  updatePayable,
  updateReceivable,
  ReceivableDTO,
  PayableDTO,
} from "@/app/actions/financialActions";
import { getClients } from "@/app/actions/clientActions";
import { getInsightsForModule } from "@/app/actions/insightsActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAppLink } from "@/lib/searchNavigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { InsightBar, Insight } from "../ui/InsightBar";
import {
  DollarSign,
  Loader2,
  Plus,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Building,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Edit,
  HandCoins,
} from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";

interface FinanceiroTabProps {
  defaultTab?: string;
  newRecord?: boolean;
  newType?: string;
  requestId?: string;
  clientId?: string;
  statusFilter?: string;
}

export default function FinanceiroTab({
  defaultTab = "visao",
  newRecord = false,
  newType,
  requestId,
  clientId,
  statusFilter,
}: FinanceiroTabProps) {
  const { hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();
  const [insights, setInsights] = useState<Insight[]>([]);

  const [activeSubTab, setActiveSubTab] = useState<
    "visao" | "receber" | "pagar" | "extrato" | "dre"
  >(
    (defaultTab === "extrato" ||
    defaultTab === "pagar" ||
    defaultTab === "receber" ||
    defaultTab === "dre"
      ? defaultTab
      : "visao") as any,
  );

  // Data
  const [receivables, setReceivables] = useState<ReceivableDTO[]>([]);
  const [payables, setPayables] = useState<PayableDTO[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isLaunchOpen, setIsLaunchOpen] = useState(newRecord);
  const [selectedReceivable, setSelectedReceivable] =
    useState<ReceivableDTO | null>(null);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [editingLaunch, setEditingLaunch] = useState<{
    id: string;
    status: string;
    type: "RECEITA" | "DESPESA";
    receivedValue?: number;
  } | null>(null);

  // Unified Launch Form
  const [launchForm, setLaunchForm] = useState({
    type: (newType === "RECEITA" ? "RECEITA" : "DESPESA") as
      | "RECEITA"
      | "DESPESA",
    providerName: "", // despesa
    clientId: "", // receita
    description: "",
    category: "PECA",
    costCenter: "GERAL",
    value: "",
    dueDate: "",
  });

  const [receiveForm, setReceiveForm] = useState({
    receivedValue: 0,
    paymentMethod: "PIX",
    bankAccountId: "",
  });

  useEffect(() => {
    if (!newRecord) {
      setIsLaunchOpen(false);
      return;
    }
    const type = newType === "RECEITA" ? "RECEITA" : "DESPESA";
    setActiveSubTab(type === "RECEITA" ? "receber" : "pagar");
    setLaunchForm((current) => ({
      ...current,
      type,
      clientId: clientId || current.clientId,
    }));
    setIsLaunchOpen(true);
  }, [newRecord, newType, requestId, clientId]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const recs = await getReceivables();
      const pays = await getPayables();
      const banks = await getBankAccounts();
      const txs = await getTransactions();
      const clientList = await getClients();

      setReceivables(recs);
      setPayables(pays);
      setBankAccounts(banks);
      setTransactions(txs);
      setClients(clientList);

      if (banks.length > 0) {
        setReceiveForm((prev) => ({ ...prev, bankAccountId: banks[0].id }));
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar dados financeiros", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinancialData();
    getInsightsForModule("financeiro")
      .then((data) =>
        setInsights(
          data.map((i) => ({
            id: i.id,
            severity: i.severity,
            message: i.message,
            onClick: i.link
              ? () => {
                  const { tabType, params } = parseAppLink(i.link!);
                  openTab(tabType, "Financeiro", params);
                }
              : undefined,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const handleLaunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!launchForm.value || !launchForm.dueDate) return;

    setActionLoading(true);
    try {
      if (launchForm.type === "DESPESA") {
        if (!launchForm.providerName) {
          toast("Por favor, informe o credor/fornecedor.", "warning");
          setActionLoading(false);
          return;
        }
        const payload = {
          providerName: launchForm.providerName,
          description: launchForm.description,
          category: launchForm.category,
          costCenter: launchForm.costCenter,
          value: parseFloat(launchForm.value) || 0,
          dueDate: new Date(launchForm.dueDate),
        };
        const res = editingLaunch
          ? await updatePayable(editingLaunch.id, payload)
          : await createPayable(payload, currentUser?.id || "");
        if (res.success) {
          toast(
            editingLaunch
              ? "Conta a pagar atualizada com sucesso!"
              : "Despesa a pagar lançada com sucesso!",
            "success",
          );
          setIsLaunchOpen(false);
          setEditingLaunch(null);
          loadFinancialData();
        } else {
          toast(res.error || "Erro ao lançar despesa", "error");
        }
      } else {
        if (!launchForm.clientId) {
          toast("Por favor, selecione o cliente de cobrança.", "warning");
          setActionLoading(false);
          return;
        }
        const payload = {
          clientId: launchForm.clientId,
          totalValue: parseFloat(launchForm.value) || 0,
          dueDate: new Date(launchForm.dueDate),
          category: launchForm.category,
          costCenter: launchForm.costCenter,
          notes: launchForm.description,
        };
        const res = editingLaunch
          ? await updateReceivable(editingLaunch.id, payload)
          : await createReceivable(payload, currentUser?.id || "");
        if (res.success) {
          toast(
            editingLaunch
              ? "Conta a receber atualizada com sucesso!"
              : "Receita a receber lançada com sucesso!",
            "success",
          );
          setIsLaunchOpen(false);
          setEditingLaunch(null);
          loadFinancialData();
        } else {
          toast(res.error || "Erro ao lançar receita", "error");
        }
      }
    } catch (err) {
      toast("Erro de conexão com o banco", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const dateForInput = (value: Date | string) => {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  const openReceivableEdit = (receivable: ReceivableDTO) => {
    setEditingLaunch({
      id: receivable.id,
      status: receivable.status,
      type: "RECEITA",
      receivedValue: receivable.receivedValue,
    });
    setLaunchForm({
      type: "RECEITA",
      providerName: "",
      clientId: receivable.clientId,
      description: receivable.notes || "",
      category: receivable.category,
      costCenter: receivable.costCenter,
      value: String(receivable.totalValue),
      dueDate: dateForInput(receivable.dueDate),
    });
    setIsLaunchOpen(true);
  };

  const openPayableEdit = (payable: PayableDTO) => {
    setEditingLaunch({
      id: payable.id,
      status: payable.status,
      type: "DESPESA",
    });
    setLaunchForm({
      type: "DESPESA",
      providerName: payable.providerName,
      clientId: "",
      description: payable.description || "",
      category: payable.category,
      costCenter: payable.costCenter,
      value: String(payable.value),
      dueDate: dateForInput(payable.dueDate),
    });
    setIsLaunchOpen(true);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable || !receiveForm.bankAccountId) return;

    setActionLoading(true);
    try {
      const res = await receivePayment({
        receivableId: selectedReceivable.id,
        receivedValue:
          receiveForm.receivedValue || selectedReceivable.pendingValue,
        paymentMethod: receiveForm.paymentMethod,
        bankAccountId: receiveForm.bankAccountId,
        userId: currentUser?.id || "",
      });

      if (res.success) {
        toast("Recebimento baixado com sucesso!", "success");
        setIsReceiveOpen(false);
        setSelectedReceivable(null);
        loadFinancialData();
      } else {
        toast(res.error || "Erro ao baixar recebimento", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePay = async (payableId: string) => {
    if (bankAccounts.length === 0) return;
    setActionLoading(true);
    try {
      const res = await payBill({
        payableId,
        paymentMethod: "TRANSFERENCIA",
        bankAccountId: bankAccounts[0].id,
        userId: currentUser?.id || "",
      });

      if (res.success) {
        toast("Conta paga e baixada!", "success");
        loadFinancialData();
      } else {
        toast(res.error || "Erro ao baixar pagamento", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const totalCash = bankAccounts.reduce((acc, b) => acc + b.balance, 0);
  const totalReceivables = receivables
    .filter((r) =>
      ["ABERTO", "PENDENTE", "VENCIDO", "PARCIAL"].includes(r.status),
    )
    .reduce((acc, r) => acc + r.pendingValue, 0);
  const totalPayables = payables
    .filter((p) => ["ABERTO", "PENDENTE", "VENCIDO"].includes(p.status))
    .reduce((acc, p) => acc + p.value, 0);
  const overdueCount = receivables.filter((r) => r.status === "VENCIDO").length;

  return (
    <div className="financeiro-tab space-y-6 select-none animate-in fade-in duration-200">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-150 font-bold text-sm">
          <DollarSign size={18} className="text-teal-500" />
          <span>Gestão e Caixa Financeiro</span>
        </div>
        {hasPermission("financeiro.write") && (
          <Button
            variant="primary"
            onClick={() => {
              setEditingLaunch(null);
              setLaunchForm({
                type: "DESPESA",
                providerName: "",
                clientId: clients[0]?.id || "",
                description: "",
                category: "PECA",
                costCenter: "GERAL",
                value: "",
                dueDate: "",
              });
              setIsLaunchOpen(true);
            }}
          >
            <Plus size={16} /> Novo Lançamento
          </Button>
        )}
      </div>

      <InsightBar insights={insights} />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between shadow-premium">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 block uppercase">
              Saldo em Caixa
            </span>
            <span className="text-lg font-bold text-zinc-850 dark:text-zinc-100 mt-1 block">
              {formatCurrency(totalCash)}
            </span>
          </div>
          <TrendingUp size={24} className="text-success opacity-80" />
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-premium">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 block uppercase">
              A Receber
            </span>
            <span className="text-lg font-bold text-success mt-1 block">
              {formatCurrency(totalReceivables)}
            </span>
          </div>
          <Clock size={24} className="text-warning opacity-80" />
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-premium">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 block uppercase">
              A Pagar
            </span>
            <span className="text-lg font-bold text-danger mt-1 block">
              {formatCurrency(totalPayables)}
            </span>
          </div>
          <TrendingDown size={24} className="text-danger opacity-80" />
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-premium">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 block uppercase">
              Contas Vencidas
            </span>
            <span className="text-lg font-bold text-danger mt-1 block">
              {overdueCount} parcelas
            </span>
          </div>
          <AlertTriangle size={24} className="text-danger opacity-80" />
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Card className="p-0 overflow-hidden shadow-premium">
        {/* Tab switch */}
        <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-6 py-2 flex gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: "visao", label: "Visão Geral" },
            { id: "receber", label: "Contas a Receber" },
            { id: "pagar", label: "Contas a Pagar" },
            { id: "extrato", label: "Extrato / Caixa" },
            { id: "dre", label: "DRE Gerencial" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`py-2 px-3 text-xs font-bold border-b-2 rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-400 hover:text-zinc-650"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Carregando dados financeiros...</p>
            </div>
          ) : (
            <>
              {/* Visão Geral */}
              {activeSubTab === "visao" && (
                <div className="space-y-6">
                  {/* Bank Accounts */}
                  <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                      <Building size={13} className="text-primary" />
                      Contas Bancárias & Saldos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {bankAccounts.length === 0 ? (
                        <p className="text-xs text-zinc-400">
                          Nenhuma conta bancária vinculada.
                        </p>
                      ) : (
                        bankAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between shadow-premium"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                <CreditCard size={15} />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-zinc-850 dark:text-zinc-150 block">
                                  {account.name}
                                </span>
                                <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold">
                                  {account.bankName || "Banco Comercial"}
                                </span>
                              </div>
                            </div>
                            <span className="font-semibold text-xs text-zinc-850 dark:text-zinc-100">
                              {formatCurrency(account.balance)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                      <Activity size={13} className="text-teal-500" />
                      Últimas Movimentações Conciliadas
                    </h3>
                    {transactions.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-4">
                        Nenhuma movimentação financeira recente.
                      </p>
                    ) : (
                      <Table
                        headers={[
                          "Descrição",
                          "Método",
                          "Tipo",
                          "Valor",
                          "Data",
                        ]}
                      >
                        {transactions.slice(0, 5).map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                              {tx.description}
                            </TableCell>
                            <TableCell className="font-semibold text-zinc-650 dark:text-zinc-450 uppercase">
                              {tx.paymentMethod}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  tx.type === "ENTRADA"
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : "bg-red-500/10 text-red-500 border border-red-500/20"
                                }`}
                              >
                                {tx.type}
                              </span>
                            </TableCell>
                            <TableCell
                              className={`font-semibold ${tx.type === "ENTRADA" ? "text-emerald-500" : "text-red-500"}`}
                            >
                              {tx.type === "ENTRADA" ? "+" : "-"}{" "}
                              {formatCurrency(tx.value)}
                            </TableCell>
                            <TableCell className="font-semibold text-zinc-650 dark:text-zinc-500">
                              {formatDate(tx.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Table>
                    )}
                  </div>
                </div>
              )}

              {/* Contas a Receber */}
              {activeSubTab === "receber" && (
                <div className="space-y-4">
                  {receivables.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6">
                      Nenhuma parcela a receber cadastrada.
                    </p>
                  ) : (
                    <Table
                      headers={[
                        "Cliente",
                        "Código OS",
                        "Vencimento",
                        "Valor da Parcela",
                        "Status",
                        "Ações",
                      ]}
                    >
                      {receivables.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                            {r.clientName}
                          </TableCell>
                          <TableCell className="font-bold text-zinc-650 dark:text-zinc-450">
                            #{r.osCode || "N/A"}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">
                            {formatDate(r.dueDate)}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                            {formatCurrency(r.totalValue)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[250px] flex-nowrap items-center gap-2">
                              {hasPermission("financeiro.write") && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 min-w-[92px] border-white/10 bg-transparent px-3 text-zinc-300 shadow-none hover:border-[#d4af37]/35 hover:bg-[#d4af37]/[.06] dark:bg-transparent"
                                  onClick={() => openReceivableEdit(r)}
                                >
                                  <Edit size={13} /> Editar
                                </Button>
                              )}
                              {[
                                "ABERTO",
                                "PENDENTE",
                                "VENCIDO",
                                "PARCIAL",
                              ].includes(r.status) ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-9 min-w-[142px] px-3 shadow-[0_8px_18px_rgba(212,175,55,.16)]"
                                  onClick={() => {
                                    setSelectedReceivable(r);
                                    setReceiveForm((prev) => ({
                                      ...prev,
                                      receivedValue: r.pendingValue,
                                    }));
                                    setIsReceiveOpen(true);
                                  }}
                                >
                                  <HandCoins size={14} /> Liquidar
                                </Button>
                              ) : (
                                <span className="inline-flex h-9 min-w-[112px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[.08] px-3 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                  <CheckCircle2 size={13} />
                                  Recebido
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>
                  )}
                </div>
              )}

              {/* Contas a Pagar */}
              {activeSubTab === "pagar" && (
                <div className="space-y-4">
                  {payables.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6">
                      Nenhuma conta a pagar cadastrada.
                    </p>
                  ) : (
                    <Table
                      headers={[
                        "Credor / Fornecedor",
                        "Categoria",
                        "Centro de Custo",
                        "Vencimento",
                        "Valor",
                        "Status",
                        "Ações",
                      ]}
                    >
                      {payables.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                            <div>
                              <span>{p.providerName}</span>
                              {p.description && (
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block">
                                  {p.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-450 uppercase">
                            {p.category}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-450 uppercase">
                            {p.costCenter}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-450">
                            {formatDate(p.dueDate)}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                            {formatCurrency(p.value)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[250px] flex-nowrap items-center gap-2">
                              {hasPermission("financeiro.write") && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 min-w-[92px] border-white/10 bg-transparent px-3 text-zinc-300 shadow-none hover:border-[#d4af37]/35 hover:bg-[#d4af37]/[.06] dark:bg-transparent"
                                  onClick={() => openPayableEdit(p)}
                                >
                                  <Edit size={13} /> Editar
                                </Button>
                              )}
                              {["ABERTO", "PENDENTE", "VENCIDO"].includes(
                                p.status,
                              ) ? (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="h-9 min-w-[142px] px-3"
                                  onClick={() => handlePay(p.id)}
                                  loading={actionLoading}
                                >
                                  Baixar / Pagar
                                </Button>
                              ) : (
                                <span className="inline-flex h-9 min-w-[142px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.035] px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                  <CheckCircle2 size={13} />
                                  Pago / Baixado
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>
                  )}
                </div>
              )}

              {/* Extrato Completo */}
              {activeSubTab === "extrato" && (
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6">
                      Nenhuma transação financeira registrada.
                    </p>
                  ) : (
                    <Table
                      headers={[
                        "Descrição",
                        "Tipo",
                        "Método",
                        "Valor",
                        "Conta de Origem/Destino",
                        "Data",
                      ]}
                    >
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                            {tx.description}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                tx.type === "ENTRADA"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : "bg-red-500/10 text-red-500 border border-red-500/20"
                              }`}
                            >
                              {tx.type}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-450 uppercase">
                            {tx.paymentMethod}
                          </TableCell>
                          <TableCell
                            className={`font-semibold ${tx.type === "ENTRADA" ? "text-emerald-500" : "text-red-500"}`}
                          >
                            {tx.type === "ENTRADA" ? "+" : "-"}{" "}
                            {formatCurrency(tx.value)}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-400">
                            {tx.bankAccount?.name || "Banco Geral"}
                          </TableCell>
                          <TableCell className="font-semibold text-zinc-650 dark:text-zinc-500">
                            {formatDate(tx.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Table>
                  )}
                </div>
              )}

              {/* DRE Gerencial */}
              {activeSubTab === "dre" && (
                <div className="space-y-4">
                  <div className="bg-zinc-50 dark:bg-zinc-800/20 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs leading-relaxed text-zinc-500 dark:text-zinc-455">
                    <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                      <Clock size={12} className="text-primary" />
                      Demonstrativo de Resultado do Exercício (Competência)
                    </p>
                    Este demonstrativo consolida as receitas faturadas e
                    despesas lançadas sob o regime de competência mensal das
                    parcelas.
                  </div>

                  {(() => {
                    const recTotal = receivables.reduce(
                      (acc, r) => acc + r.totalValue,
                      0,
                    );

                    // Expenses by category
                    const expPeca = payables
                      .filter((p) => p.category === "PECA")
                      .reduce((acc, p) => acc + p.value, 0);
                    const expLog = payables
                      .filter((p) => p.category === "LOGISTICA")
                      .reduce((acc, p) => acc + p.value, 0);
                    const expAdmin = payables
                      .filter((p) => p.category === "ADMINISTRATIVO")
                      .reduce((acc, p) => acc + p.value, 0);
                    const expTributos = payables
                      .filter((p) => p.category === "TRIBUTOS")
                      .reduce((acc, p) => acc + p.value, 0);

                    const liquidRevenue = recTotal - expTributos;
                    const netIncome =
                      liquidRevenue - (expPeca + expLog + expAdmin);

                    return (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-premium">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-450 uppercase font-bold tracking-wider">
                              <th className="p-4">Linha da DRE</th>
                              <th className="p-4 text-right">
                                Valor Consolidado
                              </th>
                              <th className="p-4 text-right">Percentual (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">
                            <tr>
                              <td className="p-4 font-bold text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                RECEITA OPERACIONAL BRUTA
                              </td>
                              <td className="p-4 text-right font-semibold text-emerald-500">
                                {formatCurrency(recTotal)}
                              </td>
                              <td className="p-4 text-right text-zinc-400 dark:text-zinc-500">
                                100,00%
                              </td>
                            </tr>
                            <tr className="text-zinc-555 dark:text-zinc-450">
                              <td className="p-4 pl-8">
                                (-) Deduções e Tributos (ISS/PIS/COFINS)
                              </td>
                              <td className="p-4 text-right text-red-500">
                                ({formatCurrency(expTributos)})
                              </td>
                              <td className="p-4 text-right">
                                {(recTotal > 0
                                  ? (expTributos / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/10">
                              <td className="p-4 font-bold text-zinc-800 dark:text-zinc-200">
                                RECEITA OPERACIONAL LÍQUIDA
                              </td>
                              <td className="p-4 text-right font-bold text-zinc-800 dark:text-zinc-200">
                                {formatCurrency(liquidRevenue)}
                              </td>
                              <td className="p-4 text-right text-zinc-500">
                                {(recTotal > 0
                                  ? (liquidRevenue / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                            <tr className="text-zinc-555 dark:text-zinc-450">
                              <td className="p-4 pl-8">
                                (-) Peças e Insumos Aplicados (Custos)
                              </td>
                              <td className="p-4 text-right text-red-500">
                                ({formatCurrency(expPeca)})
                              </td>
                              <td className="p-4 text-right">
                                {(recTotal > 0
                                  ? (expPeca / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                            <tr className="text-zinc-555 dark:text-zinc-450">
                              <td className="p-4 pl-8">
                                (-) Custos de Logística e Deslocamentos
                              </td>
                              <td className="p-4 text-right text-red-500">
                                ({formatCurrency(expLog)})
                              </td>
                              <td className="p-4 text-right">
                                {(recTotal > 0
                                  ? (expLog / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                            <tr className="text-zinc-555 dark:text-zinc-450">
                              <td className="p-4 pl-8">
                                (-) Despesas Administrativas e Operacionais
                              </td>
                              <td className="p-4 text-right text-red-500">
                                ({formatCurrency(expAdmin)})
                              </td>
                              <td className="p-4 text-right">
                                {(recTotal > 0
                                  ? (expAdmin / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                            <tr
                              className={`bg-zinc-100/50 dark:bg-zinc-800/30 ${netIncome >= 0 ? "text-emerald-500" : "text-red-500"}`}
                            >
                              <td className="p-4 font-bold uppercase text-xs flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${netIncome >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                                />
                                RESULTADO LÍQUIDO (LUCRO / PREJUÍZO)
                              </td>
                              <td className="p-4 text-right font-bold text-sm">
                                {formatCurrency(netIncome)}
                              </td>
                              <td className="p-4 text-right font-bold">
                                {(recTotal > 0
                                  ? (netIncome / recTotal) * 100
                                  : 0
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Unified Launch Modal */}
      <Modal
        isOpen={isLaunchOpen}
        onClose={() => {
          setIsLaunchOpen(false);
          setEditingLaunch(null);
        }}
        title={
          editingLaunch
            ? `Editar conta a ${editingLaunch.type === "RECEITA" ? "receber" : "pagar"}`
            : "Novo Lançamento Financeiro"
        }
      >
        <form onSubmit={handleLaunchSubmit} className="space-y-4">
          {/* Type Selector Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              disabled={Boolean(editingLaunch)}
              onClick={() =>
                setLaunchForm((prev) => ({
                  ...prev,
                  type: "RECEITA",
                  category: "RECEITA_SERVICO",
                }))
              }
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                launchForm.type === "RECEITA"
                  ? "bg-emerald-500 text-white shadow-premium"
                  : "text-zinc-550 dark:text-zinc-400 hover:text-zinc-700"
              }`}
            >
              Receita (A Receber)
            </button>
            <button
              type="button"
              disabled={Boolean(editingLaunch)}
              onClick={() =>
                setLaunchForm((prev) => ({
                  ...prev,
                  type: "DESPESA",
                  category: "PECA",
                }))
              }
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                launchForm.type === "DESPESA"
                  ? "bg-danger text-white shadow-premium"
                  : "text-zinc-550 dark:text-zinc-400 hover:text-zinc-700"
              }`}
            >
              Despesa (A Pagar)
            </button>
          </div>

          {/* Conditional Input based on launch type */}
          {launchForm.type === "DESPESA" ? (
            <Input
              label="Credor / Fornecedor *"
              required
              placeholder="Ex: Fornecedor de Cobre Carrier"
              value={launchForm.providerName}
              onChange={(e) =>
                setLaunchForm((prev) => ({
                  ...prev,
                  providerName: e.target.value,
                }))
              }
            />
          ) : (
            <Select
              label="Selecione o Cliente *"
              required
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              value={launchForm.clientId}
              onChange={(e) =>
                setLaunchForm((prev) => ({ ...prev, clientId: e.target.value }))
              }
            />
          )}

          <Input
            label="Descrição / Notas"
            placeholder="Ex: Detalhe do serviço avulso ou aquisição de peças"
            value={launchForm.description}
            onChange={(e) =>
              setLaunchForm((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor (R$) *"
              type="number"
              min={
                editingLaunch?.type === "RECEITA"
                  ? Math.max(0.01, editingLaunch.receivedValue || 0)
                  : 0.01
              }
              step="0.01"
              disabled={Boolean(
                editingLaunch &&
                editingLaunch.type === "DESPESA" &&
                ["PAGO", "ESTORNADO"].includes(editingLaunch.status),
              )}
              required
              placeholder="0.00"
              value={launchForm.value}
              onChange={(e) =>
                setLaunchForm((prev) => ({ ...prev, value: e.target.value }))
              }
            />
            <Input
              label="Data de Vencimento *"
              type="date"
              required
              value={launchForm.dueDate}
              onChange={(e) =>
                setLaunchForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {launchForm.type === "DESPESA" ? (
              <Select
                label="Categoria *"
                options={[
                  { value: "PECA", label: "Peças e Insumos" },
                  { value: "LOGISTICA", label: "Combustível e Pedágio" },
                  {
                    value: "ADMINISTRATIVO",
                    label: "Administrativo / Escritório",
                  },
                  { value: "TRIBUTOS", label: "Impostos e Guias" },
                  { value: "OUTROS", label: "Outras Despesas" },
                ]}
                value={launchForm.category}
                onChange={(e) =>
                  setLaunchForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              />
            ) : (
              <Select
                label="Categoria *"
                options={[
                  { value: "RECEITA_SERVICO", label: "Receita de Serviço" },
                  { value: "VENDA_PECA", label: "Venda de Peças" },
                  { value: "CONTRATO", label: "PMOC / Contratos" },
                  { value: "OUTROS", label: "Outras Receitas" },
                ]}
                value={launchForm.category}
                onChange={(e) =>
                  setLaunchForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              />
            )}

            <Select
              label="Centro de Custo *"
              options={[
                { value: "GERAL", label: "Geral" },
                { value: "OPERACIONAL", label: "Operação Técnica" },
                { value: "MARKETING", label: "Marketing / Ads" },
              ]}
              value={launchForm.costCenter}
              onChange={(e) =>
                setLaunchForm((prev) => ({
                  ...prev,
                  costCenter: e.target.value,
                }))
              }
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsLaunchOpen(false);
                setEditingLaunch(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              {editingLaunch ? "Salvar alterações" : "Salvar lançamento"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Baixar Recebimento Modal */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Confirmar Recebimento"
      >
        <form onSubmit={handleReceive} className="space-y-4">
          {selectedReceivable && (
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 text-xs text-zinc-500 font-semibold space-y-1.5">
              <p>
                Sacado / Cliente:{" "}
                <span className="text-zinc-800 dark:text-zinc-100 font-semibold">
                  {selectedReceivable.clientName}
                </span>
              </p>
              <p>
                Valor Esperado:{" "}
                <span className="text-zinc-800 dark:text-zinc-100 font-semibold">
                  {formatCurrency(selectedReceivable.pendingValue)}
                </span>
              </p>
            </div>
          )}

          <Input
            label="Valor Recebido (R$) *"
            type="number"
            required
            value={receiveForm.receivedValue}
            onChange={(e) =>
              setReceiveForm((prev) => ({
                ...prev,
                receivedValue: parseFloat(e.target.value) || 0,
              }))
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Método *"
              options={[
                { value: "PIX", label: "PIX" },
                { value: "BOLETO", label: "Boleto Bancário" },
                { value: "TRANSFERENCIA", label: "Transferência / TED" },
                { value: "DINHEIRO", label: "Dinheiro" },
              ]}
              value={receiveForm.paymentMethod}
              onChange={(e) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  paymentMethod: e.target.value,
                }))
              }
            />

            <Select
              label="Conta de Crédito *"
              options={bankAccounts.map((b) => ({
                value: b.id,
                label: b.name,
              }))}
              value={receiveForm.bankAccountId}
              onChange={(e) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  bankAccountId: e.target.value,
                }))
              }
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsReceiveOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="success" type="submit" loading={actionLoading}>
              Confirmar e Liquidar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
