"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getServiceOrders,
  getServiceOrderDetails,
  scheduleServiceOrder,
  updateOSStatus,
  updateOSMaterials,
} from "@/app/actions/osActions";
import { getClients, ClientDTO } from "@/app/actions/clientActions";
import { getProducts } from "@/app/actions/inventoryActions"; // criaremos essa action logo em seguida
import { formatCurrency, formatDate, formatPhone, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import {
  Wrench,
  Search,
  Calendar,
  User,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Loader2,
  List,
  Kanban,
  FileText,
  UserCheck,
  Package,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OrdensServicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const osCodeParam = searchParams.get("code");

  const { user: currentUser, users: systemUsers, hasPermission } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [osDetails, setOsDetails] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Controle de Visualização
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  
  // Lista de Produtos do Estoque (para adicionar peças na OS)
  const [dbProducts, setDbProducts] = useState<any[]>([]);

  // Formulário de Agendamento
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: "",
    scheduledTime: "",
    techIds: [] as string[],
    priority: "MEDIA",
  });

  // Lista local de materiais da OS em edição
  const [localMaterials, setLocalMaterials] = useState<any[]>([]);

  const [actionLoading, setActionLoading] = useState(false);
  const [justification, setJustification] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");

  // Carregar lista de OSs
  async function loadOrders(query = "") {
    setLoadingList(true);
    const data = await getServiceOrders({ search: query });
    setOrders(data);
    setLoadingList(false);

    // Se houver parâmetro de URL
    if (osCodeParam) {
      const matched = data.find((o) => o.code === osCodeParam);
      if (matched) {
        setSelectedOSId(matched.id);
        return;
      }
    }

    if (data.length > 0 && !selectedOSId) {
      setSelectedOSId(data[0].id);
    }
  }

  // Carregar detalhes da OS
  async function loadDetails(id: string) {
    setLoadingDetails(true);
    const details = await getServiceOrderDetails(id);
    setOsDetails(details);
    
    if (details) {
      // Preencher formulário de agendamento com valores atuais
      setScheduleForm({
        scheduledDate: details.scheduledDate ? new Date(details.scheduledDate).toISOString().slice(0, 10) : "",
        scheduledTime: details.scheduledTime || "",
        techIds: details.technicians.map((t: any) => t.userId),
        priority: details.priority || "MEDIA",
      });

      // Preencher lista local de materiais
      setLocalMaterials(
        details.materials.map((m: any) => ({
          productId: m.productId,
          name: m.product.name,
          quantity: m.quantity,
          salePrice: m.salePrice,
          usedQuantity: m.usedQuantity,
          status: m.status,
          stockQty: m.product.stockQuantity, // saldo atual no estoque para validações
        }))
      );
    }
    setLoadingDetails(false);
  }

  // Carregar produtos do almoxarifado
  async function loadInventoryProducts() {
    // Para simplificar a integração com a action de estoque que criaremos na etapa seguinte
    const response = await getProducts().catch(() => []);
    setDbProducts(response);
  }

  useEffect(() => {
    loadOrders();
    loadInventoryProducts();
  }, [osCodeParam]);

  useEffect(() => {
    if (selectedOSId) {
      loadDetails(selectedOSId);
    } else {
      setOsDetails(null);
    }
  }, [selectedOSId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadOrders(val);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOSId || !scheduleForm.scheduledDate || !scheduleForm.scheduledTime || scheduleForm.techIds.length === 0 || !currentUser) {
      alert("Selecione data, horário e pelo menos um técnico.");
      return;
    }

    setActionLoading(true);
    const res = await scheduleServiceOrder(
      selectedOSId,
      {
        scheduledDate: new Date(scheduleForm.scheduledDate),
        scheduledTime: scheduleForm.scheduledTime,
        techIds: scheduleForm.techIds,
        priority: scheduleForm.priority,
      },
      currentUser.id
    );

    if (res.success) {
      alert("OS agendada com sucesso!");
      await loadDetails(selectedOSId);
      await loadOrders();
    } else {
      alert("Erro ao agendar: " + res.error);
    }
    setActionLoading(false);
  };

  const handleTechCheckboxChange = (techId: string, checked: boolean) => {
    if (checked) {
      setScheduleForm({
        ...scheduleForm,
        techIds: [...scheduleForm.techIds, techId],
      });
    } else {
      setScheduleForm({
        ...scheduleForm,
        techIds: scheduleForm.techIds.filter((id) => id !== techId),
      });
    }
  };

  const triggerStatusChange = (status: string) => {
    setPendingStatus(status);
    setJustification("");
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async () => {
    if (!selectedOSId || !currentUser || !pendingStatus) return;
    setShowStatusModal(false);
    setActionLoading(true);
    const res = await updateOSStatus(selectedOSId, pendingStatus, currentUser.id, justification);
    if (res.success) {
      await loadDetails(selectedOSId);
      await loadOrders();
    } else {
      alert("Erro ao alterar status: " + res.error);
    }
    setActionLoading(false);
  };

  // Funções de Gerenciamento de Materiais Locais
  const handleAddMaterial = (productId: string) => {
    const prod = dbProducts.find((p) => p.id === productId);
    if (!prod) return;

    // Verificar se já existe na lista
    if (localMaterials.some((lm) => lm.productId === productId)) {
      alert("Esta peça já está na lista.");
      return;
    }

    setLocalMaterials([
      ...localMaterials,
      {
        productId: prod.id,
        name: prod.name,
        quantity: 1,
        salePrice: prod.salePrice,
        usedQuantity: 0,
        status: "PREVISTO",
        stockQty: prod.stockQuantity,
      },
    ]);
  };

  const handleRemoveMaterial = (productId: string) => {
    setLocalMaterials(localMaterials.filter((lm) => lm.productId !== productId));
  };

  const handleLocalMaterialChange = (idx: number, field: string, value: any) => {
    setLocalMaterials(
      localMaterials.map((mat, i) => {
        if (i !== idx) return mat;
        
        let processedValue = value;
        if (field === "quantity" || field === "usedQuantity" || field === "salePrice") {
          processedValue = parseFloat(value) || 0;
        }

        // Validação de estoque para evitar baixar mais do que existe no almoxarifado
        if (field === "usedQuantity" && mat.status === "UTILIZADO" && processedValue > mat.stockQty) {
          alert(`Atenção: A quantidade utilizada (${processedValue}) é maior do que o saldo em estoque (${mat.stockQty}).`);
        }

        return {
          ...mat,
          [field]: processedValue,
        };
      })
    );
  };

  const handleSaveMaterials = async () => {
    if (!selectedOSId || !currentUser) return;
    setActionLoading(true);
    const res = await updateOSMaterials(selectedOSId, localMaterials, currentUser.id);
    if (res.success) {
      alert("Lista de peças e estoque atualizados!");
      await loadDetails(selectedOSId);
    } else {
      alert("Erro ao atualizar materiais: " + res.error);
    }
    setActionLoading(false);
  };

  // Cores de status
  const getOSStatusClass = (status: string) => {
    switch (status) {
      case "CRIADA":
        return "bg-zinc-100 text-zinc-600 border border-zinc-200";
      case "AGENDADA":
        return "bg-blue-50 text-blue-600 border border-blue-200";
      case "EXECUCAO":
        return "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse";
      case "CONCLUIDA":
        return "bg-emerald-50 text-emerald-600 border border-emerald-200";
      case "FATURAMENTO":
        return "bg-purple-50 text-purple-600 border border-purple-200 font-bold";
      case "FATURADA":
        return "bg-emerald-600 text-white shadow-sm";
      case "CANCELADA":
        return "bg-red-50 text-red-600 border border-red-200";
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "URGENTE":
        return "bg-red-500/10 text-red-500 border border-red-500/20 font-extrabold";
      case "ALTA":
        return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "MEDIA":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
    }
  };

  // Lista de status do Kanban
  const kanbanStatuses = [
    { name: "CRIADA", label: "Pendentes / Novas" },
    { name: "AGENDADA", label: "Agendadas" },
    { name: "EXECUCAO", label: "Em Execução" },
    { name: "CONCLUIDA", label: "Concluídas (Técnico)" },
    { name: "FATURAMENTO", label: "Faturamento" },
    { name: "FATURADA", label: "Faturadas" },
  ];

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-120px)]">
      {/* Toolbar superior */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === "kanban" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Kanban size={14} /> Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === "list" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <List size={14} /> Tabela
            </button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 text-zinc-400" size={14} />
            <input
              type="text"
              placeholder="Buscar OS ou cliente..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-4 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-zinc-50/50"
            />
          </div>
        </div>
        <div className="text-xs text-zinc-400 font-medium">
          Módulo Operacional • Ordens de Serviço como Centro
        </div>
      </div>

      {/* Área Principal (Filtro por visualização) */}
      {viewMode === "list" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
          {/* Tabela de OSs (5/12 colunas) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-y-auto divide-y divide-zinc-100">
            {loadingList ? (
              <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                <span className="text-xs">Carregando OS...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">Nenhuma OS encontrada</div>
            ) : (
              orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOSId(o.id)}
                  className={`w-full text-left p-4 hover:bg-zinc-50/50 flex flex-col gap-1.5 transition-all ${
                    selectedOSId === o.id ? "bg-emerald-50/20 border-r-4 border-emerald-600" : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-sm text-zinc-800">{o.code}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getOSStatusClass(o.status)}`}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-bold truncate">{o.clientName}</p>
                  <div className="flex justify-between items-center w-full text-[10px] text-zinc-400 font-medium pt-1">
                    <span className="bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                      {o.type}
                    </span>
                    <span>{o.scheduledDate ? formatDate(o.scheduledDate) : "Sem data"}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Ficha Detalhada (7/12 colunas) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
            <OSDetailPanel
              osDetails={osDetails}
              loadingDetails={loadingDetails}
              scheduleForm={scheduleForm}
              setScheduleForm={setScheduleForm}
              handleScheduleSubmit={handleScheduleSubmit}
              handleTechCheckboxChange={handleTechCheckboxChange}
              systemUsers={systemUsers}
              localMaterials={localMaterials}
              dbProducts={dbProducts}
              handleAddMaterial={handleAddMaterial}
              handleRemoveMaterial={handleRemoveMaterial}
              handleLocalMaterialChange={handleLocalMaterialChange}
              handleSaveMaterials={handleSaveMaterials}
              triggerStatusChange={triggerStatusChange}
              actionLoading={actionLoading}
              hasPermission={hasPermission}
            />
          </div>
        </div>
      ) : (
        /* Visualização Kanban Horizontal */
        <div className="flex-1 overflow-x-auto flex gap-4 pb-4 select-none">
          {kanbanStatuses.map((kStat) => {
            const osInStage = orders.filter((o) => o.status === kStat.name);

            return (
              <div
                key={kStat.name}
                className="w-72 shrink-0 bg-zinc-100/70 p-3 rounded-2xl border border-zinc-200 flex flex-col max-h-[70vh] border-t-4 border-zinc-300"
              >
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="font-bold text-xs text-zinc-700 uppercase tracking-wide">
                    {kStat.label}
                  </span>
                  <span className="text-xs bg-zinc-200 text-zinc-500 font-bold px-2 py-0.5 rounded-full">
                    {osInStage.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {osInStage.length === 0 ? (
                    <div className="border border-dashed border-zinc-200 rounded-xl py-8 text-center text-zinc-400 text-[10px]">
                      Sem OS neste estágio
                    </div>
                  ) : (
                    osInStage.map((os) => (
                      <div
                        key={os.id}
                        onClick={() => {
                          setSelectedOSId(os.id);
                          setViewMode("list"); // abre na listagem detalhada
                        }}
                        className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm hover:border-zinc-300 hover:shadow transition-all cursor-pointer flex flex-col gap-2 min-h-[110px]"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-zinc-800">{os.code}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getPriorityClass(os.priority)}`}>
                            {os.priority}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-600 truncate">{os.clientName}</p>
                        
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium pt-1 mt-auto">
                          <span className="bg-zinc-100 text-zinc-500 px-1 rounded uppercase tracking-wider text-[9px] font-bold">
                            {os.type.slice(0, 10)}
                          </span>
                          {os.scheduledDate ? (
                            <span className="flex items-center gap-1 text-zinc-500">
                              <Calendar size={10} /> {formatDate(os.scheduledDate).slice(0, 5)}
                            </span>
                          ) : (
                            <span className="text-red-500 font-bold">Sem data</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Mudar status com justificativa */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50">
              <h3 className="font-bold text-zinc-800 text-sm">
                Transicionar OS para: <span className="text-emerald-600">{pendingStatus}</span>
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">
                  Justificativa / Motivo da mudança *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Agendamento remarcado a pedido do cliente... Peças instaladas e testadas..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 text-sm font-semibold rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleStatusSubmit}
                  disabled={!justification || actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Salvar Histórico
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente de Painel de Detalhes
function OSDetailPanel({
  osDetails,
  loadingDetails,
  scheduleForm,
  setScheduleForm,
  handleScheduleSubmit,
  handleTechCheckboxChange,
  systemUsers,
  localMaterials,
  dbProducts,
  handleAddMaterial,
  handleRemoveMaterial,
  handleLocalMaterialChange,
  handleSaveMaterials,
  triggerStatusChange,
  actionLoading,
  hasPermission,
}: any) {
  if (loadingDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-zinc-400">Carregando detalhes da OS...</p>
      </div>
    );
  }

  if (!osDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
        <Wrench size={48} className="text-zinc-200 mb-3" />
        <p className="font-semibold text-sm">Selecione uma ordem de serviço</p>
        <p className="text-xs text-zinc-500 mt-1">Para gerenciar equipe, agendamento, checklist e faturamento.</p>
      </div>
    );
  }

  // Cores de status
  const getOSStatusClass = (status: string) => {
    switch (status) {
      case "CRIADA":
        return "bg-zinc-100 text-zinc-600 border border-zinc-200";
      case "AGENDADA":
        return "bg-blue-50 text-blue-600 border border-blue-200";
      case "EXECUCAO":
        return "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse";
      case "CONCLUIDA":
        return "bg-emerald-50 text-emerald-600 border border-emerald-200";
      case "FATURAMENTO":
        return "bg-purple-50 text-purple-600 border border-purple-200 font-bold";
      case "FATURADA":
        return "bg-emerald-600 text-white shadow-sm";
      case "CANCELADA":
        return "bg-red-50 text-red-600 border border-red-200";
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs">
      {/* Header Detalhado */}
      <div className="p-5 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-start gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-zinc-900 text-base">{osDetails.code}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getOSStatusClass(osDetails.status)}`}>
              {osDetails.status}
            </span>
          </div>
          <p className="font-bold text-zinc-800 text-sm mt-1.5">{osDetails.client.name}</p>
        </div>

        {/* Mudar Status da OS */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Ações:</span>
          <select
            onChange={(e) => triggerStatusChange(e.target.value)}
            value={osDetails.status}
            className="border border-zinc-200 rounded px-2.5 py-1 text-xs font-semibold bg-white text-zinc-700 hover:border-zinc-300 focus:outline-none"
          >
            <option value="CRIADA">Pendente / Criada</option>
            <option value="AGENDADA">Agendada</option>
            <option value="EXECUCAO">Em Execução</option>
            <option value="CONCLUIDA">Concluir pelo Técnico</option>
            {hasPermission("faturamento.write") && (
              <>
                <option value="FATURAMENTO">Enviar Faturamento</option>
                <option value="FATURADA">Marcar como Faturada</option>
              </>
            )}
            <option value="CANCELADA">Cancelar OS</option>
          </select>
        </div>
      </div>

      {/* Conteúdo Ficha OS (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Prontuário Endereço / Contatos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 space-y-1.5">
            <h4 className="font-bold text-zinc-800 flex items-center gap-1.5"><MapPin size={14} className="text-zinc-500" /> Endereço de Execução</h4>
            <p className="text-zinc-600 leading-normal font-medium mt-1">
              {osDetails.address?.street}, nº {osDetails.address?.number} {osDetails.address?.complement && ` - ${osDetails.address?.complement}`}
              <br />
              {osDetails.address?.neighborhood} - {osDetails.address?.city} / {osDetails.address?.state}
            </p>
          </div>
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 space-y-1.5">
            <h4 className="font-bold text-zinc-800 flex items-center gap-1.5"><User size={14} className="text-zinc-500" /> Contato de Acompanhamento</h4>
            {osDetails.contact ? (
              <div className="font-medium text-zinc-600 space-y-0.5">
                <p className="font-bold text-zinc-800">{osDetails.contact.name} ({osDetails.contact.role})</p>
                <p>Tel: {formatPhone(osDetails.contact.phone)}</p>
                <p>E-mail: {osDetails.contact.email}</p>
              </div>
            ) : (
              <p className="text-zinc-400 italic">Nenhum contato atribuído.</p>
            )}
          </div>
        </div>

        {/* Diagnóstico Operacional */}
        <div className="space-y-2">
          <h4 className="font-bold text-zinc-800">Escopo do Serviço & Diagnóstico</h4>
          <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/20 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Problema Relatado / Escopo:</span>
              <p className="text-zinc-700 leading-normal mt-1 whitespace-pre-line font-medium">{osDetails.problemReported || "Sem escopo."}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Diagnóstico Técnico de Campo:</span>
              <p className="text-zinc-700 leading-normal mt-1 whitespace-pre-line font-medium bg-white p-2.5 rounded border border-zinc-100 italic min-h-[50px]">
                {osDetails.technicalDiagnosis || "Aguardando diagnóstico técnico pelo executor em campo."}
              </p>
            </div>
          </div>
        </div>

        {/* Agendamento e Equipe */}
        <div className="space-y-3">
          <h4 className="font-bold text-zinc-800">Planejamento & Equipe Técnica</h4>
          <form onSubmit={handleScheduleSubmit} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">Data Agendada *</label>
              <input
                type="date"
                required
                value={scheduleForm.scheduledDate}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">Horário Previsto *</label>
              <input
                type="text"
                required
                placeholder="Ex: 09:00"
                value={scheduleForm.scheduledTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
                className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 block mb-1">Prioridade</label>
              <select
                value={scheduleForm.priority}
                onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                className="w-full border border-zinc-200 rounded p-1.5 bg-white text-xs focus:outline-none"
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div className="col-span-1 md:col-span-3">
              <label className="text-[10px] font-bold text-zinc-500 block mb-1.5">Técnicos Alocados *</label>
              <div className="flex flex-wrap gap-4 bg-white p-3 rounded-lg border border-zinc-200">
                {systemUsers
                  .filter((u: any) => u.roleName === "Técnico" || u.roleName === "Administrador")
                  .map((tech: any) => (
                    <label key={tech.id} className="flex items-center gap-1.5 font-medium cursor-pointer select-none text-zinc-700">
                      <input
                        type="checkbox"
                        checked={scheduleForm.techIds.includes(tech.id)}
                        onChange={(e) => handleTechCheckboxChange(tech.id, e.target.checked)}
                        className="rounded border-zinc-300 accent-emerald-600"
                      />
                      {tech.name}
                    </label>
                  ))}
              </div>
            </div>
            <div className="col-span-1 md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-zinc-950 text-white font-bold rounded-lg hover:bg-zinc-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 size={12} className="animate-spin" />}
                <UserCheck size={14} /> Salvar Escala e Agendamento
              </button>
            </div>
          </form>
        </div>

        {/* Gerenciamento de Peças e Almoxarifado */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-zinc-800">Materiais, Peças & Estoque Utilizado</h4>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddMaterial(e.target.value);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-500 focus:outline-none"
              >
                <option value="" disabled>Adicionar peça da OS...</option>
                {dbProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Saldo: {p.stockQuantity} {p.unit})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveMaterials}
                disabled={actionLoading}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 size={12} className="animate-spin" />}
                Salvar Peças
              </button>
            </div>
          </div>

          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                  <th className="p-2.5">Nome da Peça</th>
                  <th className="p-2.5 w-16 text-center">Previsto</th>
                  <th className="p-2.5 w-16 text-center">Aplicado</th>
                  <th className="p-2.5 w-24 text-right">Preço Venda</th>
                  <th className="p-2.5 w-28 text-center">Status</th>
                  <th className="p-2.5 text-center w-12">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {localMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 italic">
                      Nenhuma peça alocada para esta OS. Use a seleção acima.
                    </td>
                  </tr>
                ) : (
                  localMaterials.map((mat: any, idx: number) => (
                    <tr key={mat.productId} className="hover:bg-zinc-50/20 font-medium">
                      <td className="p-2.5 text-zinc-800 font-semibold">{mat.name}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={mat.quantity}
                          onChange={(e) => handleLocalMaterialChange(idx, "quantity", e.target.value)}
                          className="w-12 border border-zinc-200 rounded text-center p-0.5 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={mat.usedQuantity}
                          onChange={(e) => handleLocalMaterialChange(idx, "usedQuantity", e.target.value)}
                          className="w-12 border border-zinc-200 rounded text-center p-0.5 focus:outline-none"
                          disabled={mat.status !== "UTILIZADO"}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={mat.salePrice}
                          onChange={(e) => handleLocalMaterialChange(idx, "salePrice", e.target.value)}
                          className="w-20 border border-zinc-200 rounded text-right p-0.5 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <select
                          value={mat.status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const usedQty = newStatus === "UTILIZADO" ? mat.quantity : 0;
                            handleLocalMaterialChange(idx, "status", newStatus);
                            handleLocalMaterialChange(idx, "usedQuantity", usedQty);
                          }}
                          className="border border-zinc-200 rounded p-0.5 bg-white text-[10px] focus:outline-none"
                        >
                          <option value="PREVISTO">Previsto</option>
                          <option value="UTILIZADO">UTILIZADO (Baixa)</option>
                          <option value="DEVOLVIDO">Devolvido</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(mat.productId)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={13} className="mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditoria Financeira Interna da OS (Mede rentabilidade real) */}
        <div className="bg-zinc-950 text-white rounded-2xl p-5 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <h5 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Lucratividade Real da OS</h5>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-zinc-500">Valor Cobrado Total:</span>
              <p className="text-sm font-bold text-zinc-100">
                {formatCurrency(
                  osDetails.items.reduce((sum: number, i: any) => sum + i.total, 0) +
                    osDetails.materials
                      .filter((m: any) => m.status === "UTILIZADO")
                      .reduce((sum: number, m: any) => sum + m.usedQuantity * m.salePrice, 0)
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500">Custo Total de Peças:</span>
              <p className="text-sm font-bold text-red-400">
                {formatCurrency(
                  osDetails.materials
                    .filter((m: any) => m.status === "UTILIZADO")
                    .reduce((sum: number, m: any) => sum + m.usedQuantity * m.costPrice, 0)
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-zinc-500">Margem Comercial Real:</span>
              <p className="text-sm font-bold text-emerald-400">
                {formatCurrency(osDetails.marginReal)}
              </p>
            </div>
          </div>
        </div>

        {/* Linha do tempo de Auditoria de Status */}
        <div className="space-y-3">
          <h4 className="font-bold text-zinc-800">Histórico de Alterações (Timeline Auditoria)</h4>
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3 max-h-[180px] overflow-y-auto">
            {osDetails.statusHistory.length === 0 ? (
              <p className="text-zinc-400 italic">Sem histórico registrado.</p>
            ) : (
              osDetails.statusHistory.map((hist: any) => (
                <div key={hist.id} className="relative pl-5 border-l-2 border-zinc-200 text-xs">
                  <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-400 border border-white"></span>
                  <div className="flex justify-between font-bold text-[10px] text-zinc-400 mb-0.5">
                    <span>
                      {hist.oldStatus} ➔ <span className="text-zinc-700">{hist.newStatus}</span>
                    </span>
                    <span>{formatDateTime(hist.changedAt)}</span>
                  </div>
                  <p className="text-zinc-600 font-semibold">Autor: {hist.changedBy.name}</p>
                  <p className="text-zinc-500 italic mt-0.5">Justificativa: {hist.justification}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Seção Relatório de Conclusão Link */}
        {osDetails.completionReport && (
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-emerald-600 animate-pulse" />
              <div>
                <p className="font-bold text-emerald-800 text-xs">Relatório Técnico de Conclusão Disponível</p>
                <p className="text-emerald-600 text-[10px] font-medium mt-0.5">
                  Aprovado pelo cliente em {formatDate(osDetails.completionReport.approvedAt)}.
                </p>
              </div>
            </div>
            <Link
              href={`/relatorios?id=${osDetails.id}`}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold hover:shadow-md transition-all text-xs"
            >
              Visualizar Relatório
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
