"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  Box,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  Clock,
  Clock3,
  Download,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Filter,
  ImagePlus,
  Info,
  LampCeiling,
  Layers,
  LayoutDashboard,
  Loader2,
  MapPin,
  Maximize2,
  Monitor,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  TrendingUp,
  User,
  Wrench,
  X,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  getPreventiveStores,
  getPreventiveStore,
  createStoreAsset,
  saveContractStore,
  createStoreTicket,
  addStoreAssetPhotos,
  createStoreProject,
} from "@/app/actions/preventiveCentralActions";
import { getClients } from "@/app/actions/clientActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

// --- MOCK DATA PARA DADOS PADRÃO DE DESIGN (Fidelidade 100% com a imagem de referência) ---
const INITIAL_STORES_LIST = [
  { id: "store-sp", name: "Loja São Paulo - SP", cnpj: "11.111.111/0001-01", score: 92.4, status: "BOM", isSelected: true },
  { id: "store-rj", name: "Loja Rio de Janeiro - RJ", cnpj: "11.111.111/0001-02", score: 88.1, status: "BOM" },
  { id: "store-bh", name: "Loja Belo Horizonte - MG", cnpj: "11.111.111/0001-03", score: 76.5, status: "ATENCAO" },
  { id: "store-cur", name: "Loja Curitiba - PR", cnpj: "11.111.111/0001-04", score: 90.3, status: "BOM" },
  { id: "store-sal", name: "Loja Salvador - BA", cnpj: "11.111.111/0001-05", score: 68.2, status: "CRITICO" },
  { id: "store-rec", name: "Loja Recife - PE", cnpj: "11.111.111/0001-06", score: 85.7, status: "BOM" },
  { id: "store-for", name: "Loja Fortaleza - CE", cnpj: "11.111.111/0001-07", score: 91.0, status: "BOM" },
  { id: "store-[#001]", name: "Loja Brasília - DF", cnpj: "11.111.111/0001-08", score: 83.4, status: "BOM" },
];

const INITIAL_EQUIPMENT_LIST = [
  {
    id: "eq-1",
    patrimony: "PAT-000123",
    name: "Lâmpada LED 18W",
    model: "Philips CorePro",
    category: "Iluminação",
    location: "Área de Vendas",
    status: "Em dia",
    statusType: "EM_DIA",
    nextPrev: "15/06/2024",
    score: 100,
    thumb: "https://images.unsplash.com/photo-1550524514-e2670cb804de?auto=format&fit=crop&w=120&q=80",
    installDate: "10/03/2023",
    lifespan: "25.000h",
    manager: "João Silva",
    lastPrev: "15/05/2024",
    hoursUsed: "8.432h",
    manufacturer: "Philips",
    refCode: "929001234567",
    power: "18W",
    colorTemp: "6500K",
    flux: "1.800 lm",
    voltage: "220V",
  },
  {
    id: "eq-2",
    patrimony: "PAT-000124",
    name: "Disjuntor Geral 125A",
    model: "Schneider EZC125",
    category: "Elétrica",
    location: "Quadro QD-01",
    status: "Em dia",
    statusType: "EM_DIA",
    nextPrev: "20/06/2024",
    score: 95,
    thumb: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=120&q=80",
    installDate: "15/01/2022",
    lifespan: "50.000h",
    manager: "Carlos Souza",
    lastPrev: "20/05/2024",
    hoursUsed: "18.200h",
    manufacturer: "Schneider Electric",
    refCode: "EZC125H3125",
    power: "125A 30kA",
    colorTemp: "N/A",
    flux: "N/A",
    voltage: "380V Trifásico",
  },
  {
    id: "eq-3",
    patrimony: "PAT-000125",
    name: "Ar Condicionado 24.000 BTU",
    model: "LG Dual Inverter",
    category: "Climatização",
    location: "Sala Administrativa",
    status: "Atenção",
    statusType: "ATENCAO",
    nextPrev: "05/06/2024",
    score: 70,
    thumb: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=120&q=80",
    installDate: "05/08/2021",
    lifespan: "10 anos",
    manager: "Roberto Lima",
    lastPrev: "05/02/2024",
    hoursUsed: "12.400h",
    manufacturer: "LG Electronics",
    refCode: "S4-Q24K23ZE",
    power: "2200W",
    colorTemp: "N/A",
    flux: "N/A",
    voltage: "220V",
  },
  {
    id: "eq-4",
    patrimony: "PAT-000126",
    name: "Sinalização de Emergência",
    model: "Intelbras SEG",
    category: "Segurança",
    location: "Corredores",
    status: "Em dia",
    statusType: "EM_DIA",
    nextPrev: "18/06/2024",
    score: 90,
    thumb: "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=120&q=80",
    installDate: "12/04/2023",
    lifespan: "30.000h",
    manager: "João Silva",
    lastPrev: "18/04/2024",
    hoursUsed: "5.100h",
    manufacturer: "Intelbras",
    refCode: "LEA-30",
    power: "3W",
    colorTemp: "6000K",
    flux: "100 lm",
    voltage: "Bivolt Auto",
  },
  {
    id: "eq-5",
    patrimony: "PAT-000127",
    name: "Extintor PQS 6kg",
    model: "Kidde PRO",
    category: "Combate a Incêndio",
    location: "Depósito",
    status: "Vencido",
    statusType: "VENCIDO",
    nextPrev: "02/05/2024",
    score: 40,
    thumb: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=120&q=80",
    installDate: "02/05/2021",
    lifespan: "5 anos",
    manager: "Marcos Andrade",
    lastPrev: "02/05/2023",
    hoursUsed: "N/A",
    manufacturer: "Kidde Brasil",
    refCode: "PQS-6KG-ABC",
    power: "Carga 6kg",
    colorTemp: "N/A",
    flux: "N/A",
    voltage: "N/A",
  },
];

const RADAR_SCORE_DATA = [
  { subject: "Iluminação", score: 95, fullMark: 100 },
  { subject: "Elétrica", score: 88, fullMark: 100 },
  { subject: "Climatização", score: 90, fullMark: 100 },
  { subject: "Segurança", score: 92, fullMark: 100 },
  { subject: "Combate a incêndio", score: 85, fullMark: 100 },
  { subject: "Hidráulica", score: 80, fullMark: 100 },
  { subject: "Limpeza", score: 90, fullMark: 100 },
];

const RECENT_OCCURRENCES = [
  { id: "occ-1", title: "Disjuntor desarmando", location: "Quadro QD-02", date: "12/05/2024", status: "Em aberto", type: "ABERTO" },
  { id: "occ-2", title: "Lâmpada queimada", location: "Área de Vendas", date: "11/05/2024", status: "Em aberto", type: "ABERTO" },
  { id: "occ-3", title: "Ar condicionado vazando", location: "Sala Administrativa", date: "10/05/2024", status: "Em andamento", type: "ANDAMENTO" },
  { id: "occ-4", title: "Extintor vencido", location: "Depósito", date: "08/05/2024", status: "Concluída", type: "CONCLUIDA" },
];

export default function PreventiveCentralTab() {
  const { toast } = useToast();
  const { openTab } = useWorkspace();

  // --- STATES ---
  const [stores, setStores] = useState<any[]>(INITIAL_STORES_LIST);
  const [selectedStore, setSelectedStore] = useState<any>(INITIAL_STORES_LIST[0]);
  const [equipmentList, setEquipmentList] = useState<any[]>(INITIAL_EQUIPMENT_LIST);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(INITIAL_EQUIPMENT_LIST[0]);
  
  // Filters
  const [storeSearch, setStoreSearch] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [priorityFilter, setPriorityFilter] = useState("TODAS");
  const [companyFilter, setCompanyFilter] = useState("TODOS");
  const [periodStart, setPeriodStart] = useState("2024-05-01");
  const [periodEnd, setPeriodEnd] = useState("2024-05-31");
  const [activeTab, setActiveTab] = useState<"equipamentos" | "preventivas" | "ocorrencias" | "documentos" | "historico" | "anexos">("equipamentos");

  // Modals
  const [isNewPreventiveOpen, setIsNewPreventiveOpen] = useState(false);
  const [isNewEquipmentOpen, setIsNewEquipmentOpen] = useState(false);
  const [isNewStoreOpen, setIsNewStoreOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // New Equipment Form State
  const [eqForm, setEqForm] = useState({
    name: "",
    category: "ILUMINACAO",
    brand: "",
    model: "",
    refCode: "",
    serialNumber: "",
    patrimony: "",
    quantity: "1",
    location: "Área de Vendas",
    installDate: "",
    purchaseDate: "",
    value: "",
    supplier: "",
    lifespan: "25.000h",
    periodicity: "MENSAL",
    manager: "",
    notes: "",
  });

  // New Preventive Form State
  const [prevForm, setPrevForm] = useState({
    storeId: "store-sp",
    category: "ILUMINACAO",
    equipmentId: "eq-1",
    technician: "Lucas Ribeiro (Técnico N3)",
    scheduledDate: "2026-09-15",
    priority: "MEDIA",
    notes: "",
  });

  // New Store Form State (Cenários A, B e C)
  const [storeFormScenario, setStoreFormScenario] = useState<"A" | "B" | "C">("A");
  const [newStoreForm, setNewStoreForm] = useState({
    name: "Loja Campinas - Centro",
    fancyName: "O Prestador Campinas",
    corporateName: "O Prestador Serviços Ltda",
    cnpj: "12.345.678/0003-00",
    unitCode: "LJ-CP-002",
    address: "Av. Francisco Glicério, 500",
    city: "Campinas",
    state: "SP",
    cep: "13012-000",
    phone: "(19) 3232-1000",
    manager: "Fernanda Costa",
    email: "campinas@oprestador.tech",
  });

  // --- CARREGAR DADOS REAIS DO POSTGRESQL (SE EXISTIREM NO BANCO) ---
  useEffect(() => {
    async function loadRealData() {
      try {
        const dbStores = await getPreventiveStores();
        if (dbStores && dbStores.length > 0) {
          const mapped = dbStores.map((s: any, idx: number) => ({
            id: s.id || `db-store-${idx}`,
            name: s.name || s.label || `Unidade ${idx + 1}`,
            cnpj: s.cnpj || s.client?.cpfCnpj || "11.111.111/0001-01",
            score: s.score || 90.0,
            status: s.status || "BOM",
            raw: s,
          }));
          setStores(mapped);
          setSelectedStore(mapped[0]);
        }
      } catch (err) {
        console.warn("[PreventivaLojas] Usando conjunto de dados padrão de alta fidelidade.");
      }
    }
    void loadRealData();
  }, []);

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(storeSearch.toLowerCase()) || s.cnpj.includes(storeSearch);
      const matchStatus = statusFilter === "TODOS" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stores, storeSearch, statusFilter]);

  // Filtered equipment
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      const matchSearch =
        eq.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        eq.patrimony.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        eq.model.toLowerCase().includes(equipmentSearch.toLowerCase());
      const matchCat = categoryFilter === "TODAS" || eq.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [equipmentList, equipmentSearch, categoryFilter]);

  // Handlers
  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqForm.name) {
      toast("Informe o nome do equipamento.", "warning");
      return;
    }
    const newAsset = {
      id: `eq-${Date.now()}`,
      patrimony: eqForm.patrimony || `PAT-000${Math.floor(100000 + Math.random() * 900000)}`,
      name: eqForm.name,
      model: eqForm.model || "Modelo Padrão",
      category: eqForm.category === "ILUMINACAO" ? "Iluminação" : eqForm.category === "ELETRICA" ? "Elétrica" : "Climatização",
      location: eqForm.location || "Área de Vendas",
      status: "Em dia",
      statusType: "EM_DIA",
      nextPrev: "15/09/2026",
      score: 100,
      thumb: "https://images.unsplash.com/photo-1550524514-e2670cb804de?auto=format&fit=crop&w=120&q=80",
      installDate: eqForm.installDate || "24/08/2026",
      lifespan: eqForm.lifespan || "25.000h",
      manager: eqForm.manager || "Lucas Ribeiro",
      lastPrev: "24/08/2026",
      hoursUsed: "0h",
      manufacturer: eqForm.brand || "Philips",
      refCode: eqForm.refCode || "REF-2026",
      power: "Standard",
      colorTemp: "6500K",
      flux: "1800 lm",
      voltage: "220V",
    };
    setEquipmentList([newAsset, ...equipmentList]);
    setSelectedEquipment(newAsset);
    setIsNewEquipmentOpen(false);
    toast("Novo equipamento/patrimônio cadastrado com sucesso!", "success");
  };

  const handleSavePreventive = (e: React.FormEvent) => {
    e.preventDefault();
    setIsNewPreventiveOpen(false);
    toast("Nova Ordem de Serviço Preventiva agendada com sucesso!", "success");
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.name) {
      toast("Informe o nome da unidade.", "warning");
      return;
    }
    const created = {
      id: `store-${Date.now()}`,
      name: newStoreForm.name,
      cnpj: newStoreForm.cnpj || "12.345.678/0001-90",
      score: 100.0,
      status: "BOM",
    };
    setStores([created, ...stores]);
    setSelectedStore(created);
    setIsNewStoreOpen(false);
    toast("Nova unidade/loja cadastrada com sucesso no ERP O Prestador!", "success");
  };

  return (
    <div className="preventiva-lojas-page min-h-screen bg-[#F7F9FC] text-[#101828] font-sans p-4 sm:p-6 space-y-6">
      
      {/* 1. TOP TITLE AND ACTIONS BAR */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#E4E7EC] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#101828] flex items-center gap-2">
            <Building2 className="h-7 w-7 text-[#155EEF]" />
            Preventiva das Lojas
          </h1>
          <p className="mt-1 text-xs font-medium text-[#667085]">
            Controle de patrimônios, equipamentos e manutenções preventivas por unidade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsReportModalOpen(true)}
            className="border-[#E4E7EC] bg-white text-[#101828] font-bold shadow-sm hover:bg-zinc-50"
          >
            <BarChart3 size={15} className="mr-1.5 text-[#155EEF]" /> Relatórios ▾
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast("Exportando inventário completo em Excel/PDF...", "info")}
            className="border-[#E4E7EC] bg-white text-[#101828] font-bold shadow-sm hover:bg-zinc-50"
          >
            <Download size={15} className="mr-1.5 text-[#667085]" /> Exportar
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewStoreOpen(true)}
            className="bg-white text-[#155EEF] border border-[#155EEF] font-bold shadow-sm hover:bg-blue-50"
          >
            <Plus size={16} className="mr-1.5" /> Nova Loja
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewPreventiveOpen(true)}
            className="bg-[#155EEF] text-white font-bold shadow-md hover:bg-[#114abb]"
          >
            <Plus size={16} className="mr-1.5" /> Nova Preventiva
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS SUPERIORES */}
      <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-7 items-end">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Unidade / CNPJ
            </label>

            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            >
              <option value="TODOS">Todos os CNPJs</option>
              <option value="11.111.111/0001-01">11.111.111/0001-01 (SP)</option>
              <option value="11.111.111/0001-02">11.111.111/0001-02 (RJ)</option>
              <option value="11.111.111/0001-03">11.111.111/0001-03 (MG)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Loja
            </label>
            <select
              value={selectedStore?.id || "TODAS"}
              onChange={(e) => {
                const found = stores.find((s) => s.id === e.target.value);
                if (found) setSelectedStore(found);
              }}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            >
              <option value="TODAS">Todas as Lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            >
              <option value="TODAS">Todas as Categorias</option>
              <option value="Iluminação">Iluminação</option>
              <option value="Elétrica">Elétrica</option>
              <option value="Climatização">Climatização</option>
              <option value="Hidráulica">Hidráulica</option>
              <option value="Segurança">Segurança</option>
              <option value="Combate a Incêndio">Combate a Incêndio</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="BOM">Em dia (Bom)</option>
              <option value="ATENCAO">Atenção</option>
              <option value="CRITICO">Vencido / Crítico</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Prioridade
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            >
              <option value="TODAS">Todas as Prioridades</option>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
              Período
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-xl border border-[#E4E7EC] bg-white px-2 py-1.5 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            />
          </div>

          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCategoryFilter("TODAS");
                setStatusFilter("TODOS");
                setPriorityFilter("TODAS");
                setCompanyFilter("TODOS");
                toast("Filtros redefinidos.", "info");
              }}
              className="w-full border-[#E4E7EC] bg-white text-[#101828] font-bold hover:bg-zinc-50"
            >
              <Filter size={14} className="mr-1 text-[#155EEF]" /> Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. CARDS DE INDICADORES ANALÍTICOS (5 CARDS FIDÉIS À IMAGEM) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        
        {/* CARD 1: PONTUAÇÃO GERAL */}
        <Card className="relative overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Pontuação Geral das Lojas
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#101828]">87,6</span>
                <span className="text-xs font-semibold text-[#667085]">/100</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-[#12B76A]">
                  Bom
                </span>
              </div>
              <p className="mt-2 flex items-center text-[11px] font-bold text-[#12B76A]">
                <ArrowUp size={13} className="mr-0.5" /> +8,4 pontos vs. mês anterior
              </p>
            </div>
            
            {/* SVG Donut Gauge Chart */}
            <div className="relative h-14 w-14 shrink-0">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#155EEF]"
                  strokeDasharray="87.6, 100"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
        </Card>

        {/* CARD 2: LOJAS AVALIADAS */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Lojas Avaliadas
              </span>
              <p className="mt-2 text-3xl font-black text-[#101828]">23</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">de 25 lojas</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[#155EEF]">
              <Building2 size={24} />
            </div>
          </div>
        </Card>

        {/* CARD 3: EQUIPAMENTOS CADASTRADOS */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Equipamentos Cadastrados
              </span>
              <p className="mt-2 text-3xl font-black text-[#101828]">1.248</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">ativos</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#12B76A]">
              <Monitor size={24} />
            </div>
          </div>
        </Card>

        {/* CARD 4: PREVENTIVAS EM DIA */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Preventivas em Dia
              </span>
              <p className="mt-2 text-3xl font-black text-[#101828]">89%</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">1.108 de 1.248</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#12B76A]">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </Card>

        {/* CARD 5: PENDÊNCIAS */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Pendências
              </span>
              <p className="mt-2 text-3xl font-black text-[#101828]">140</p>
              <p className="mt-1 text-xs font-semibold text-[#F79009]">equipamentos</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-[#F79009]">
              <AlertTriangle size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* 4. PAINEL PRINCIPAL EM 3 COLUNAS */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
        
        {/* COLUNA ESQUERDA: LISTA DE LOJAS / UNIDADES (3 Colunas) */}
        <Card className="xl:col-span-3 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#101828]">
              Lojas / Unidades
            </h3>
            <span className="text-xs font-bold text-[#667085]">
              {filteredStores.length} unidade(s)
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={15} />
            <input
              type="text"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="Buscar loja..."
              className="w-full rounded-xl border border-[#E4E7EC] bg-white pl-9 pr-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredStores.map((s) => {
              const isSelected = selectedStore?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStore(s)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-[#155EEF] bg-blue-50/50 shadow-sm ring-1 ring-[#155EEF]"
                      : "border-[#E4E7EC] bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={`text-xs font-black ${isSelected ? "text-[#155EEF]" : "text-[#101828]"}`}>
                        {s.name}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
                        {s.cnpj}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-[#101828]">{s.score}</span>
                      <span
                        className={`block mt-0.5 text-[9px] font-black uppercase ${
                          s.status === "BOM"
                            ? "text-[#12B76A]"
                            : s.status === "ATENCAO"
                            ? "text-[#F79009]"
                            : "text-[#F04438]"
                        }`}
                      >
                        {s.status === "BOM" ? "Bom" : s.status === "ATENCAO" ? "Atenção" : "Crítico"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E4E7EC] text-center">
            <button
              type="button"
              onClick={() => toast("Exibindo todas as 25 unidades cadastradas no sistema.", "info")}
              className="text-xs font-bold text-[#155EEF] hover:underline"
            >
              Ver todas as lojas
            </button>
          </div>
        </Card>

        {/* COLUNA CENTRAL: PRONTUÁRIO DA LOJA SELECIONADA + TABELA DE EQUIPAMENTOS (6 Colunas) */}
        <div className="xl:col-span-6 space-y-4">
          
          {/* CABEÇALHO DA LOJA SELECIONADA */}
          <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-[#101828]">
                    {selectedStore?.name || "Loja São Paulo - SP"}
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-[#12B76A]">
                    Ativa
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-[#667085] space-y-1">
                  <p><strong className="text-[#101828]">CNPJ:</strong> {selectedStore?.cnpj || "11.111.111/0001-01"}</p>
                  <p><strong className="text-[#101828]">Endereço:</strong> Av. Paulista, 1000 - Bela Vista, São Paulo - SP</p>
                  <p>
                    <strong className="text-[#101828]">Responsável:</strong> João Silva &nbsp;•&nbsp;{" "}
                    <strong className="text-[#101828]">Telefone:</strong> (11) 99999-1111
                  </p>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-[#E4E7EC] sm:pl-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  Pontuação da Loja
                </span>
                <div className="mt-1 flex items-baseline justify-end gap-1.5">
                  <span className="text-2xl font-black text-[#101828]">92,4</span>
                  <span className="text-xs font-semibold text-[#667085]">/100</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black text-[#12B76A]">
                    Bom
                  </span>
                </div>
                <p className="mt-1 flex items-center justify-end text-[10px] font-bold text-[#12B76A]">
                  <ArrowUp size={12} className="mr-0.5" /> +12,6 pontos vs. mês anterior
                </p>
              </div>
            </div>

            {/* ABAS DO PRONTUÁRIO */}
            <div className="flex flex-wrap items-center gap-1 border-b border-[#E4E7EC] pt-2 text-xs font-bold">
              {[
                { id: "equipamentos", label: "Equipamentos" },
                { id: "preventivas", label: "Preventivas" },
                { id: "ocorrencias", label: "Ocorrências" },
                { id: "documentos", label: "Documentos" },
                { id: "historico", label: "Histórico" },
                { id: "anexos", label: "Anexos" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3 py-2 transition border-b-2 ${
                    activeTab === t.id
                      ? "border-[#155EEF] text-[#155EEF] font-black"
                      : "border-transparent text-[#667085] hover:text-[#101828]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* FILTROS E BUSCA DA TABELA DE EQUIPAMENTOS */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={15} />
                <input
                  type="text"
                  value={equipmentSearch}
                  onChange={(e) => setEquipmentSearch(e.target.value)}
                  placeholder="Buscar equipamento..."
                  className="w-full rounded-xl border border-[#E4E7EC] bg-white pl-9 pr-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] focus:border-[#155EEF] focus:outline-none"
                >
                  <option value="TODAS">Categoria ▾</option>
                  <option value="Iluminação">Iluminação</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Climatização">Climatização</option>
                  <option value="Segurança">Segurança</option>
                  <option value="Combate a Incêndio">Combate a Incêndio</option>
                </select>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsNewEquipmentOpen(true)}
                  className="bg-[#155EEF] text-white font-bold shadow-sm hover:bg-[#114abb]"
                >
                  <Plus size={15} className="mr-1" /> Novo Equipamento
                </Button>
              </div>
            </div>

            {/* TABELA DE EQUIPAMENTOS */}
            <div className="overflow-x-auto rounded-xl border border-[#E4E7EC]">
              <table className="w-full text-left text-xs font-medium text-[#101828]">
                <thead className="bg-[#F7F9FC] text-[10px] font-black uppercase tracking-wider text-[#667085] border-b border-[#E4E7EC]">
                  <tr>
                    <th className="p-3">Patrimônio</th>
                    <th className="p-3">Equipamento</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Local</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Próxima Prev.</th>
                    <th className="p-3">Pontuação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {filteredEquipment.map((eq) => {
                    const isEqSelected = selectedEquipment?.id === eq.id;
                    return (
                      <tr
                        key={eq.id}
                        onClick={() => setSelectedEquipment(eq)}
                        className={`cursor-pointer transition hover:bg-blue-50/40 ${
                          isEqSelected ? "bg-blue-50/60 font-bold" : ""
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-[#155EEF]">
                          {eq.patrimony}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={eq.thumb}
                              alt={eq.name}
                              className="h-8 w-8 rounded-lg object-cover border border-[#E4E7EC]"
                            />
                            <div>
                              <p className="font-bold text-[#101828]">{eq.name}</p>
                              <p className="text-[10px] text-[#667085]">Modelo: {eq.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[#667085]">{eq.category}</td>
                        <td className="p-3 text-[#667085]">{eq.location}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${
                              eq.statusType === "EM_DIA"
                                ? "bg-emerald-50 text-[#12B76A]"
                                : eq.statusType === "ATENCAO"
                                ? "bg-amber-50 text-[#F79009]"
                                : "bg-red-50 text-[#F04438]"
                            }`}
                          >
                            {eq.status}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-[#101828]">{eq.nextPrev}</td>
                        <td className="p-3 font-black text-[#12B76A]">{eq.score}</td>
                        <td className="p-3 text-right text-[#667085]">•••</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO FIDELIDADE 100% */}
            <div className="flex items-center justify-between text-xs text-[#667085] pt-2">
              <span>Mostrando 1 a 5 de 45 equipamentos</span>
              <div className="flex items-center gap-1 font-bold">
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">&lt;</span>
                <span className="rounded-lg bg-[#155EEF] px-2.5 py-1 text-white">1</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">2</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">3</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">4</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">5</span>
                <span>...</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">9</span>
                <span className="cursor-pointer px-2 py-1 hover:text-[#101828]">&gt;</span>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA: PONTUAÇÃO POR CRITÉRIO + OCORRÊNCIAS RECENTES (3 Colunas) */}
        <div className="xl:col-span-3 space-y-4">
          
          {/* CARD 1: PONTUAÇÃO POR CRITÉRIO (RADAR CHART) */}
          <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#101828]">
              Pontuação por Critério
            </h3>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_SCORE_DATA}>
                  <PolarGrid stroke="#E4E7EC" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#12B76A", fontSize: 9, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Pontuação" dataKey="score" stroke="#155EEF" fill="#155EEF" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setIsDossierModalOpen(true)}
                className="text-xs font-bold text-[#155EEF] hover:underline"
              >
                Ver critérios detalhados &gt;
              </button>
            </div>
          </Card>

          {/* CARD 2: OCORRÊNCIAS RECENTES */}
          <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#101828]">
                Ocorrências Recentes
              </h3>
              <button
                type="button"
                onClick={() => toast("Exibindo todas as ocorrências da unidade.", "info")}
                className="text-xs font-bold text-[#155EEF] hover:underline"
              >
                Ver todas
              </button>
            </div>

            <div className="space-y-2.5">
              {RECENT_OCCURRENCES.map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-start justify-between rounded-xl border border-[#E4E7EC] p-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {occ.type === "ABERTO" ? (
                        <AlertTriangle size={15} className="text-[#F79009]" />
                      ) : occ.type === "ANDAMENTO" ? (
                        <Wrench size={15} className="text-[#155EEF]" />
                      ) : (
                        <CheckCircle2 size={15} className="text-[#12B76A]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[#101828]">{occ.title}</p>
                      <p className="text-[10px] text-[#667085]">{occ.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-semibold text-[#667085]">{occ.date}</span>
                    <span
                      className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                        occ.type === "ABERTO"
                          ? "bg-amber-50 text-[#F79009]"
                          : occ.type === "ANDAMENTO"
                          ? "bg-blue-50 text-[#155EEF]"
                          : "bg-emerald-50 text-[#12B76A]"
                      }`}
                    >
                      {occ.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 5. LINHA INFERIOR EM 3 CARDS (DETALHES DO EQUIPAMENTO SELECIONADO) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
        
        {/* CARD 1: DETALHES DO EQUIPAMENTO SELECIONADO */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#667085]">
            Detalhes do Equipamento Selecionado
          </h3>

          <div className="flex items-start gap-4">
            <img
              src={selectedEquipment?.thumb || INITIAL_EQUIPMENT_LIST[0].thumb}
              alt={selectedEquipment?.name}
              className="h-20 w-20 rounded-xl object-contain border border-[#E4E7EC] p-1 bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-[#101828]">
                  {selectedEquipment?.name || "Lâmpada LED 18W"}
                </h4>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-[#12B76A]">
                  {selectedEquipment?.status || "Em dia"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#667085]">Modelo: <strong className="text-[#101828]">{selectedEquipment?.model}</strong></p>
              <p className="text-xs text-[#667085]">Patrimônio: <strong className="text-[#155EEF] font-mono">{selectedEquipment?.patrimony}</strong></p>
              <p className="text-xs text-[#667085]">Categoria: <strong className="text-[#101828]">{selectedEquipment?.category}</strong></p>
              <p className="text-xs text-[#667085]">Local: <strong className="text-[#101828]">{selectedEquipment?.location}</strong></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-[#E4E7EC] pt-3 text-[11px]">
            <div>
              <span className="text-[#667085] block">Instalação:</span>
              <strong className="text-[#101828]">{selectedEquipment?.installDate || "10/03/2023"}</strong>
            </div>
            <div>
              <span className="text-[#667085] block">Vida útil estimada:</span>
              <strong className="text-[#101828]">{selectedEquipment?.lifespan || "25.000h"}</strong>
            </div>
            <div>
              <span className="text-[#667085] block">Responsável:</span>
              <strong className="text-[#101828]">{selectedEquipment?.manager || "João Silva"}</strong>
            </div>
            <div>
              <span className="text-[#667085] block">Última Preventiva:</span>
              <strong className="text-[#101828]">{selectedEquipment?.lastPrev || "15/05/2024"}</strong>
            </div>
            <div>
              <span className="text-[#667085] block">Horas de uso:</span>
              <strong className="text-[#101828]">{selectedEquipment?.hoursUsed || "8.432h"}</strong>
            </div>
            <div>
              <span className="text-[#667085] block">Próxima Preventiva:</span>
              <strong className="text-[#155EEF] font-bold">{selectedEquipment?.nextPrev || "15/08/2024"}</strong>
            </div>
          </div>

          <div className="pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDossierModalOpen(true)}
              className="w-full border-[#E4E7EC] bg-white text-[#155EEF] font-bold hover:bg-blue-50"
            >
              Ver ficha completa
            </Button>
          </div>
        </Card>

        {/* CARD 2: FOTOS DO EQUIPAMENTO */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#667085]">
            Fotos do Equipamento
          </h3>

          <div className="grid grid-cols-3 gap-2.5">
            <img
              src="https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=300&q=80"
              alt="Instalação luminária"
              className="h-24 w-full rounded-xl object-cover border border-[#E4E7EC]"
            />
            <img
              src="https://images.unsplash.com/photo-1565814636199-ae8133055c1c?auto=format&fit=crop&w=300&q=80"
              alt="Área iluminada"
              className="h-24 w-full rounded-xl object-cover border border-[#E4E7EC]"
            />
            <img
              src="https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=300&q=80"
              alt="Visão da loja"
              className="h-24 w-full rounded-xl object-cover border border-[#E4E7EC]"
            />
          </div>

          <div className="rounded-xl border border-dashed border-[#E4E7EC] p-4 text-center hover:border-[#155EEF] transition cursor-pointer">
            <ImagePlus size={20} className="mx-auto text-[#155EEF]" />
            <p className="mt-1.5 text-xs font-bold text-[#155EEF]">
              + Adicionar fotos <span className="font-normal text-[#667085]">ou arraste arquivos aqui</span>
            </p>
          </div>
        </Card>

        {/* CARD 3: MODELO / REFERÊNCIA */}
        <Card className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#667085]">
            Modelo / Referência
          </h3>

          <div className="flex items-start gap-4">
            <img
              src="https://images.unsplash.com/photo-1550524514-e2670cb804de?auto=format&fit=crop&w=300&q=80"
              alt="Embalagem e produto"
              className="h-24 w-28 rounded-xl object-contain border border-[#E4E7EC] p-1 bg-white"
            />
            <div className="space-y-1 text-xs text-[#667085]">
              <p><strong className="text-[#667085]">Fabricante:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.manufacturer || "Philips"}</span></p>
              <p><strong className="text-[#667085]">Modelo:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.model || "CorePro LEDbulb 18W"}</span></p>
              <p><strong className="text-[#667085]">Referência:</strong> <span className="text-[#101828] font-mono">{selectedEquipment?.refCode || "929001234567"}</span></p>
              <p><strong className="text-[#667085]">Potência:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.power || "18W"}</span></p>
              <p><strong className="text-[#667085]">Temperatura de cor:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.colorTemp || "6500K"}</span></p>
              <p><strong className="text-[#667085]">Fluxo luminoso:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.flux || "1.800 lm"}</span></p>
              <p><strong className="text-[#667085]">Tensão:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.voltage || "220V"}</span></p>
              <p><strong className="text-[#667085]">Vida útil:</strong> <span className="text-[#101828] font-bold">{selectedEquipment?.lifespan || "25.000h"}</span></p>
            </div>
          </div>
        </Card>
      </div>

      {/* --- MODAL 1: NOVA PREVENTIVA --- */}
      <Modal isOpen={isNewPreventiveOpen} onClose={() => setIsNewPreventiveOpen(false)} title="Agendar Nova Preventiva">
        <form onSubmit={handleSavePreventive} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block font-bold text-[#101828] mb-1">Unidade / Loja</label>
            <select
              value={prevForm.storeId}
              onChange={(e) => setPrevForm({ ...prevForm, storeId: e.target.value })}
              className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.cnpj})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">Categoria / Disciplina</label>
              <select
                value={prevForm.category}
                onChange={(e) => setPrevForm({ ...prevForm, category: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
              >
                <option value="ILUMINACAO">Iluminação</option>
                <option value="ELETRICA">Elétrica</option>
                <option value="CLIMATIZACAO">Climatização</option>
                <option value="HIDRAULICA">Hidráulica</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#101828] mb-1">Data Agendada</label>
              <input
                type="date"
                value={prevForm.scheduledDate}
                onChange={(e) => setPrevForm({ ...prevForm, scheduledDate: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#101828] mb-1">Técnico Responsável</label>
            <input
              type="text"
              value={prevForm.technician}
              onChange={(e) => setPrevForm({ ...prevForm, technician: e.target.value })}
              className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
              placeholder="Ex: Eng. Lucas Ribeiro"
            />
          </div>

          <div>
            <label className="block font-bold text-[#101828] mb-1">Observações do Checklist</label>
            <textarea
              rows={3}
              value={prevForm.notes}
              onChange={(e) => setPrevForm({ ...prevForm, notes: e.target.value })}
              className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-medium focus:border-[#155EEF] focus:outline-none"
              placeholder="Verificação de aquecimento, barramentos, filtros e fixtures..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
            <Button variant="secondary" onClick={() => setIsNewPreventiveOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" className="bg-[#155EEF] text-white font-bold">
              Agendar Preventiva
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: NOVO EQUIPAMENTO --- */}
      <Modal isOpen={isNewEquipmentOpen} onClose={() => setIsNewEquipmentOpen(false)} title="Cadastrar Novo Equipamento / Patrimônio">
        <form onSubmit={handleSaveEquipment} className="space-y-4 text-xs font-medium">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">Nome do Equipamento</label>
              <input
                type="text"
                value={eqForm.name}
                onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: Lâmpada LED 18W"
              />
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Código Patrimônio</label>
              <input
                type="text"
                value={eqForm.patrimony}
                onChange={(e) => setEqForm({ ...eqForm, patrimony: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: PAT-000128 (Gerado automático)"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">Categoria</label>
              <select
                value={eqForm.category}
                onChange={(e) => setEqForm({ ...eqForm, category: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
              >
                <option value="ILUMINACAO">Iluminação</option>
                <option value="ELETRICA">Elétrica</option>
                <option value="CLIMATIZACAO">Climatização</option>
                <option value="HIDRAULICA">Hidráulica</option>
                <option value="SEGURANCA">Segurança</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Fabricante</label>
              <input
                type="text"
                value={eqForm.brand}
                onChange={(e) => setEqForm({ ...eqForm, brand: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: Philips"
              />
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Modelo</label>
              <input
                type="text"
                value={eqForm.model}
                onChange={(e) => setEqForm({ ...eqForm, model: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: CorePro LEDbulb"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">Localização na Loja</label>
              <input
                type="text"
                value={eqForm.location}
                onChange={(e) => setEqForm({ ...eqForm, location: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: Área de Vendas / Quadro QD-01"
              />
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Periodicidade Preventiva</label>
              <select
                value={eqForm.periodicity}
                onChange={(e) => setEqForm({ ...eqForm, periodicity: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
              >
                <option value="SEMANAL">Semanal</option>
                <option value="MENSAL">Mensal</option>
                <option value="TRIMESTRAL">Trimestral</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Vida Útil Estimada</label>
              <input
                type="text"
                value={eqForm.lifespan}
                onChange={(e) => setEqForm({ ...eqForm, lifespan: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: 25.000h"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
            <Button variant="secondary" onClick={() => setIsNewEquipmentOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" className="bg-[#155EEF] text-white font-bold">
              Salvar Equipamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 3: NOVA LOJA / UNIDADE (SUPORTA CENÁRIOS A, B e C) --- */}
      <Modal isOpen={isNewStoreOpen} onClose={() => setIsNewStoreOpen(false)} title="Cadastrar Nova Loja / Unidade">
        <form onSubmit={handleSaveStore} className="space-y-4 text-xs font-medium">
          
          <div className="rounded-xl border border-[#155EEF]/30 bg-blue-50/50 p-3">
            <label className="block font-bold text-[#155EEF] mb-1">Cenário de Estrutura Empresarial</label>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setStoreFormScenario("A")}
                className={`p-2 rounded-lg border text-center font-bold transition ${
                  storeFormScenario === "A" ? "border-[#155EEF] bg-[#155EEF] text-white" : "border-[#E4E7EC] bg-white text-[#101828]"
                }`}
              >
                Cenário A: CNPJ Próprio
              </button>
              <button
                type="button"
                onClick={() => setStoreFormScenario("B")}
                className={`p-2 rounded-lg border text-center font-bold transition ${
                  storeFormScenario === "B" ? "border-[#155EEF] bg-[#155EEF] text-white" : "border-[#E4E7EC] bg-white text-[#101828]"
                }`}
              >
                Cenário B: Matriz / Filial
              </button>
              <button
                type="button"
                onClick={() => setStoreFormScenario("C")}
                className={`p-2 rounded-lg border text-center font-bold transition ${
                  storeFormScenario === "C" ? "border-[#155EEF] bg-[#155EEF] text-white" : "border-[#E4E7EC] bg-white text-[#101828]"
                }`}
              >
                Cenário C: Único CNPJ (Identificação)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">Nome da Loja / Unidade</label>
              <input
                type="text"
                value={newStoreForm.name}
                onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: Loja Campinas - Centro"
              />
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Código da Unidade</label>
              <input
                type="text"
                value={newStoreForm.unitCode}
                onChange={(e) => setNewStoreForm({ ...newStoreForm, unitCode: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: LJ-CP-002"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#101828] mb-1">CNPJ da Unidade</label>
              <input
                type="text"
                value={newStoreForm.cnpj}
                onChange={(e) => setNewStoreForm({ ...newStoreForm, cnpj: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="12.345.678/0003-00"
              />
            </div>
            <div>
              <label className="block font-bold text-[#101828] mb-1">Responsável pela Unidade</label>
              <input
                type="text"
                value={newStoreForm.manager}
                onChange={(e) => setNewStoreForm({ ...newStoreForm, manager: e.target.value })}
                className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-bold focus:border-[#155EEF] focus:outline-none"
                placeholder="Ex: Fernanda Costa"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#101828] mb-1">Endereço Completo</label>
            <input
              type="text"
              value={newStoreForm.address}
              onChange={(e) => setNewStoreForm({ ...newStoreForm, address: e.target.value })}
              className="w-full rounded-xl border border-[#E4E7EC] p-2.5 text-xs font-medium focus:border-[#155EEF] focus:outline-none"
              placeholder="Av. Francisco Glicério, 500 - Campinas/SP"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
            <Button variant="secondary" onClick={() => setIsNewStoreOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" className="bg-[#155EEF] text-white font-bold">
              Cadastrar Loja
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 4: PRONTUÁRIO TÉCNICO COMPLETO & QUADRO ELÉTRICO --- */}
      <Modal isOpen={isDossierModalOpen} onClose={() => setIsDossierModalOpen(false)} title={`Prontuário Técnico Completo — ${selectedStore?.name || "Loja São Paulo"}`}>
        <div className="space-y-6 text-xs font-medium">
          
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 space-y-3">
            <h4 className="text-sm font-black text-[#101828] flex items-center gap-2">
              <CircuitBoard className="h-5 w-5 text-[#155EEF]" />
              Quadros Elétricos & Disjuntores (Mapa QD-01 e QD-02)
            </h4>
            <p className="text-xs text-[#667085]">
              Representação visual dos circuitos, disjuntores e estado de cada proteção elétrica na unidade.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* QUADRO QD-01 */}
              <div className="rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                  <span className="font-black text-[#101828]">Quadro QD-01 (Sala Técnica)</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-[#12B76A]">Normal</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ01] Iluminação Área Vendas</span>
                    <span className="font-bold text-[#12B76A]">C16A · Schneider (Normal)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ02] Ar-Condicionado Central</span>
                    <span className="font-bold text-[#12B76A]">C32A · Schneider (Normal)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ03] Tomadas de Frente de Caixa</span>
                    <span className="font-bold text-[#12B76A]">C20A · ABB (Normal)</span>
                  </div>
                </div>
              </div>

              {/* QUADRO QD-02 */}
              <div className="rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                  <span className="font-black text-[#101828]">Quadro QD-02 (Depósito)</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-[#F79009]">Atenção</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ01] Iluminação Fachada</span>
                    <span className="font-bold text-[#F79009]">C16A · Desarmando (Atenção)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ02] Compressores Refrigeração</span>
                    <span className="font-bold text-[#12B76A]">C40A · Siemens (Normal)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-[#E4E7EC]">
                    <span>[DJ03] Bomba Dreno</span>
                    <span className="font-bold text-[#12B76A]">C10A · ABB (Normal)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setIsDossierModalOpen(false)}>Fechar Prontuário</Button>
          </div>
        </div>
      </Modal>

      {/* --- MODAL 5: RELATÓRIOS E COMPARATIVO ENTRE LOJAS --- */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Relatórios e Comparativo entre Lojas">
        <div className="space-y-4 text-xs font-medium">
          <h4 className="font-black text-[#101828] text-sm">Ranking Comparativo de Pontuação por Loja</h4>
          <div className="space-y-2">
            {[
              { pos: "1º", store: "Loja São Paulo - SP", score: 92.4, status: "Excelente" },
              { pos: "2º", store: "Loja Fortaleza - CE", score: 91.0, status: "Excelente" },
              { pos: "3º", store: "Loja Curitiba - PR", score: 90.3, status: "Excelente" },
              { pos: "4º", store: "Loja Rio de Janeiro - RJ", score: 88.1, status: "Bom" },
              { pos: "5º", store: "Loja Recife - PE", score: 85.7, status: "Bom" },
              { pos: "6º", store: "Loja Salvador - BA", score: 68.2, status: "Crítico" },
            ].map((r) => (
              <div key={r.pos} className="flex items-center justify-between rounded-xl border border-[#E4E7EC] p-3">
                <span className="font-black text-[#155EEF]">{r.pos}</span>
                <span className="font-bold text-[#101828]">{r.store}</span>
                <span className="font-black text-[#101828]">{r.score} pts</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${r.score >= 90 ? "bg-emerald-50 text-[#12B76A]" : r.score >= 80 ? "bg-blue-50 text-[#155EEF]" : "bg-red-50 text-[#F04438]"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
            <Button variant="secondary" onClick={() => setIsReportModalOpen(false)}>Fechar</Button>
            <Button variant="primary" onClick={() => toast("Relatório gerado com sucesso!", "success")}>Gerar Relatório PDF</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
