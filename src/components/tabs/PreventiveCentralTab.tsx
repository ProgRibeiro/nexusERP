"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Box,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  CircuitBoard,
  Download,
  FileText,
  FileImage,
  Filter,
  ExternalLink,
  LampCeiling,
  LayoutDashboard,
  Layers,
  Loader2,
  Link2,
  Map,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Snowflake,
  Trash2,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import {
  addStoreAssetPhotos,
  createStoreAsset,
  createStoreProject,
  createProvisionalStore,
  createStoreTicket,
  deleteStoreAssetPhoto,
  assignContractStore,
  getPreventiveStore,
  getPreventiveStores,
  importClientEquipmentsToProject,
  getOrCreateStorePortal,
  rotateStorePortalToken,
  saveProjectFloorPlan,
  saveContractStore,
  savePreventiveStoreProfile,
  setStorePortalEnabled,
  updateStoreAsset,
  updateStoreAssetPosition,
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PreventiveStoreOverview } from "@/components/preventive/PreventiveStoreOverview";

const categoryOptions = [
  { value: "ELETRICA", label: "Elétrica / quadros e circuitos" },
  { value: "ILUMINACAO", label: "Iluminação / lâmpadas e luminárias" },
  { value: "CLIMATIZACAO", label: "Climatização / ar-condicionado" },
  { value: "CIVIL", label: "Civil / tintas e acabamentos" },
  { value: "HIDRAULICA", label: "Hidráulica / água e esgoto" },
  { value: "REFRIGERACAO", label: "Refrigeração" },
  { value: "INCENDIO", label: "Prevenção e combate a incêndio" },
  { value: "SEGURANCA", label: "Segurança / sensores" },
  { value: "DADOS_AUTOMACAO", label: "Dados, rede e automação" },
  { value: "MOBILIARIO", label: "Mobiliário" },
  { value: "OUTROS", label: "Outras disciplinas" },
];

const categoryStyle: Record<string, { color: string; marker: string; icon: React.ElementType }> = {
  ELETRICA: { color: "text-violet-700 bg-violet-50 border-violet-200", marker: "bg-violet-600", icon: CircuitBoard },
  ILUMINACAO: { color: "text-amber-700 bg-amber-50 border-amber-200", marker: "bg-amber-500", icon: LampCeiling },
  CLIMATIZACAO: { color: "text-blue-700 bg-blue-50 border-blue-200", marker: "bg-blue-600", icon: Snowflake },
  CIVIL: { color: "text-orange-700 bg-orange-50 border-orange-200", marker: "bg-orange-600", icon: Layers },
  HIDRAULICA: { color: "text-sky-700 bg-sky-50 border-sky-200", marker: "bg-sky-600", icon: Wrench },
  REFRIGERACAO: { color: "text-cyan-700 bg-cyan-50 border-cyan-200", marker: "bg-cyan-600", icon: Snowflake },
  INCENDIO: { color: "text-red-700 bg-red-50 border-red-200", marker: "bg-red-600", icon: AlertTriangle },
  SEGURANCA: { color: "text-red-700 bg-red-50 border-red-200", marker: "bg-red-600", icon: AlertTriangle },
  DADOS_AUTOMACAO: { color: "text-indigo-700 bg-indigo-50 border-indigo-200", marker: "bg-indigo-600", icon: CircuitBoard },
  MOBILIARIO: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", marker: "bg-emerald-600", icon: Box },
  OUTROS: { color: "text-zinc-700 bg-zinc-50 border-zinc-200", marker: "bg-zinc-600", icon: Package },
};

const assetTypeOptions: Record<string, Array<{ value: string; label: string }>> = {
  ELETRICA: [
    { value: "QUADRO_ELETRICO", label: "Quadro elétrico" },
    { value: "DISJUNTOR", label: "Disjuntor" },
    { value: "DPS", label: "DPS" },
    { value: "DR", label: "Dispositivo DR" },
    { value: "CONTATOR", label: "Contator" },
    { value: "RELE", label: "Relé" },
    { value: "BARRAMENTO", label: "Barramento" },
    { value: "CABO", label: "Cabo / alimentador" },
    { value: "TOMADA", label: "Tomada" },
    { value: "TRANSFORMADOR", label: "Transformador" },
    { value: "NOBREAK", label: "Nobreak / UPS" },
    { value: "OUTRO_ELETRICO", label: "Outro item elétrico" },
  ],
  ILUMINACAO: [
    { value: "LAMPADA", label: "Lâmpada" },
    { value: "LUMINARIA", label: "Luminária" },
    { value: "DRIVER", label: "Driver LED" },
    { value: "REATOR", label: "Reator" },
    { value: "FITA_LED", label: "Fita LED" },
    { value: "SENSOR_PRESENCA", label: "Sensor de presença" },
    { value: "INTERRUPTOR", label: "Interruptor / comando" },
  ],
  CLIMATIZACAO: [
    { value: "SPLIT", label: "Ar-condicionado Split" },
    { value: "CASSETE", label: "Ar-condicionado Cassete" },
    { value: "FANCOIL", label: "Fan coil" },
    { value: "CHILLER", label: "Chiller" },
    { value: "CONDENSADORA", label: "Condensadora" },
    { value: "EVAPORADORA", label: "Evaporadora" },
    { value: "COMPRESSOR", label: "Compressor" },
    { value: "CORREIA", label: "Correia" },
    { value: "FILTRO_AR", label: "Filtro de ar" },
    { value: "MOTOR", label: "Motor / ventilador" },
    { value: "TERMOSTATO", label: "Termostato / controlador" },
    { value: "BOMBA_DRENO", label: "Bomba de dreno" },
  ],
  CIVIL: [
    { value: "TINTA", label: "Tinta / pintura" },
    { value: "REVESTIMENTO", label: "Revestimento" },
    { value: "PISO", label: "Piso" },
    { value: "FORRO", label: "Forro" },
    { value: "PORTA", label: "Porta / ferragem" },
    { value: "VIDRO", label: "Vidro / esquadria" },
    { value: "IMPERMEABILIZACAO", label: "Impermeabilização" },
    { value: "ESTRUTURA", label: "Estrutura / alvenaria" },
  ],
  HIDRAULICA: [
    { value: "TORNEIRA", label: "Torneira" },
    { value: "REGISTRO", label: "Registro" },
    { value: "VALVULA", label: "Válvula" },
    { value: "BOMBA", label: "Bomba" },
    { value: "TUBULACAO", label: "Tubulação" },
    { value: "CAIXA_DAGUA", label: "Reservatório / caixa d'água" },
    { value: "RALO", label: "Ralo" },
    { value: "SIFAO", label: "Sifão" },
    { value: "LOUCA_SANITARIA", label: "Louça sanitária" },
  ],
  REFRIGERACAO: [
    { value: "BALCAO_REFRIGERADO", label: "Balcão refrigerado" },
    { value: "CAMARA_FRIA", label: "Câmara fria" },
    { value: "COMPRESSOR", label: "Compressor" },
    { value: "CONDENSADOR", label: "Condensador" },
    { value: "EVAPORADOR", label: "Evaporador" },
    { value: "CONTROLADOR", label: "Controlador" },
  ],
  INCENDIO: [
    { value: "EXTINTOR", label: "Extintor" },
    { value: "HIDRANTE", label: "Hidrante" },
    { value: "SPRINKLER", label: "Sprinkler" },
    { value: "DETECTOR", label: "Detector" },
    { value: "CENTRAL_INCENDIO", label: "Central de incêndio" },
    { value: "SINALIZACAO", label: "Sinalização / rota de fuga" },
  ],
  SEGURANCA: [
    { value: "CAMERA", label: "Câmera" },
    { value: "ALARME", label: "Alarme" },
    { value: "SENSOR", label: "Sensor" },
    { value: "CONTROLE_ACESSO", label: "Controle de acesso" },
  ],
  DADOS_AUTOMACAO: [
    { value: "RACK", label: "Rack" },
    { value: "SWITCH", label: "Switch" },
    { value: "ACCESS_POINT", label: "Access point" },
    { value: "CONTROLADOR", label: "Controlador / automação" },
    { value: "CABEAMENTO", label: "Cabeamento estruturado" },
  ],
  MOBILIARIO: [
    { value: "MOVEL", label: "Móvel" },
    { value: "PRATELEIRA", label: "Prateleira" },
    { value: "BALCAO", label: "Balcão" },
    { value: "EXPOSITOR", label: "Expositor" },
  ],
  OUTROS: [{ value: "OUTRO", label: "Outro item técnico" }],
};

type TechnicalField = { key: string; label: string; placeholder?: string };

const categoryFields: Record<string, TechnicalField[]> = {
  ELETRICA: [
    { key: "tensao", label: "Tensão", placeholder: "Ex: 220/380 V" },
    { key: "fases", label: "Número de fases", placeholder: "Ex: Trifásico" },
    { key: "correnteNominal", label: "Corrente nominal", placeholder: "Ex: 250 A" },
    { key: "capacidadeRuptura", label: "Capacidade de ruptura", placeholder: "Ex: 10 kA" },
    { key: "polos", label: "Polos", placeholder: "Ex: 3P" },
    { key: "curva", label: "Curva", placeholder: "Ex: Curva C" },
    { key: "circuito", label: "Circuito protegido", placeholder: "Ex: Iluminação salão" },
    { key: "bitola", label: "Bitola / seção", placeholder: "Ex: 16 mm²" },
  ],
  ILUMINACAO: [
    { key: "potencia", label: "Potência", placeholder: "Ex: 12 W" },
    { key: "temperaturaCor", label: "Temperatura de cor", placeholder: "Ex: 3000 K" },
    { key: "soquete", label: "Soquete", placeholder: "Ex: GU10" },
    { key: "tensao", label: "Tensão", placeholder: "Ex: Bivolt" },
    { key: "fluxoLuminoso", label: "Fluxo luminoso", placeholder: "Ex: 900 lm" },
    { key: "angulo", label: "Ângulo do facho", placeholder: "Ex: 36°" },
    { key: "dimensoes", label: "Dimensões", placeholder: "Ex: Ø 50 × 55 mm" },
    { key: "corAcabamento", label: "Cor / acabamento", placeholder: "Ex: Branco" },
  ],
  CLIMATIZACAO: [
    { key: "capacidade", label: "Capacidade", placeholder: "Ex: 36.000 BTU/h ou 10 TR" },
    { key: "refrigerante", label: "Fluido refrigerante", placeholder: "Ex: R-410A" },
    { key: "tensao", label: "Tensão", placeholder: "Ex: 220 V trifásico" },
    { key: "vazao", label: "Vazão de ar", placeholder: "Ex: 5.000 m³/h" },
    { key: "tipoCompressor", label: "Tipo do compressor", placeholder: "Ex: Scroll" },
    { key: "modeloCorreia", label: "Modelo da correia", placeholder: "Ex: A-42" },
    { key: "modeloFiltro", label: "Modelo / dimensão do filtro", placeholder: "Ex: G4 500×500×25" },
    { key: "potenciaMotor", label: "Potência do motor", placeholder: "Ex: 3 cv" },
  ],
  CIVIL: [
    { key: "material", label: "Material", placeholder: "Ex: Acrílico premium" },
    { key: "nomeCor", label: "Nome da cor", placeholder: "Ex: Branco neve" },
    { key: "codigoCor", label: "Código da cor", placeholder: "Ex: NCS S 0500-N" },
    { key: "linhaProduto", label: "Linha do produto", placeholder: "Ex: Suvinil Fosco Completo" },
    { key: "acabamento", label: "Acabamento", placeholder: "Ex: Fosco" },
    { key: "dimensoes", label: "Dimensões / paginação", placeholder: "Ex: 90 × 90 cm" },
    { key: "areaAplicacao", label: "Área de aplicação", placeholder: "Ex: Paredes do salão" },
    { key: "quantidadeDemaos", label: "Demãos / composição", placeholder: "Ex: 3 demãos" },
  ],
  HIDRAULICA: [
    { key: "diametro", label: "Diâmetro / bitola", placeholder: "Ex: 25 mm / 3/4 pol." },
    { key: "material", label: "Material", placeholder: "Ex: PVC marrom" },
    { key: "pressao", label: "Pressão", placeholder: "Ex: PN 20" },
    { key: "tipoConexao", label: "Tipo de conexão", placeholder: "Ex: Roscável" },
    { key: "vazao", label: "Vazão", placeholder: "Ex: 25 l/min" },
    { key: "capacidade", label: "Capacidade", placeholder: "Ex: 1.000 litros" },
  ],
  REFRIGERACAO: [
    { key: "temperaturaTrabalho", label: "Temperatura de trabalho", placeholder: "Ex: 2 a 8 °C" },
    { key: "refrigerante", label: "Fluido refrigerante", placeholder: "Ex: R-134a" },
    { key: "potencia", label: "Potência", placeholder: "Ex: 1/2 HP" },
    { key: "tensao", label: "Tensão", placeholder: "Ex: 220 V" },
  ],
  INCENDIO: [
    { key: "agente", label: "Agente / classe", placeholder: "Ex: CO₂ / Classe C" },
    { key: "capacidade", label: "Capacidade", placeholder: "Ex: 6 kg" },
    { key: "validade", label: "Validade / inspeção", placeholder: "Ex: 08/2027" },
    { key: "certificacao", label: "Certificação", placeholder: "Ex: INMETRO..." },
  ],
  SEGURANCA: [
    { key: "resolucao", label: "Resolução / alcance", placeholder: "Ex: 4 MP" },
    { key: "alimentacao", label: "Alimentação", placeholder: "Ex: PoE" },
    { key: "enderecoRede", label: "Endereço / canal", placeholder: "Ex: 192.168.1.45" },
  ],
  DADOS_AUTOMACAO: [
    { key: "portas", label: "Portas / capacidade", placeholder: "Ex: 24 portas PoE" },
    { key: "categoriaCabo", label: "Categoria do cabo", placeholder: "Ex: CAT6" },
    { key: "enderecoRede", label: "IP / identificação", placeholder: "Ex: 192.168.1.10" },
    { key: "firmware", label: "Firmware", placeholder: "Ex: 3.2.1" },
  ],
  MOBILIARIO: [
    { key: "material", label: "Material", placeholder: "Ex: MDF amadeirado" },
    { key: "corAcabamento", label: "Cor / acabamento", placeholder: "Ex: Carvalho natural" },
    { key: "dimensoes", label: "Dimensões", placeholder: "Ex: 2,40 × 0,60 × 2,10 m" },
  ],
  OUTROS: [
    { key: "referencia", label: "Referência técnica" },
    { key: "dimensoes", label: "Dimensões" },
  ],
};

const emptyAsset = {
  category: "ILUMINACAO",
  assetType: "LAMPADA",
  name: "",
  brand: "",
  model: "",
  manufacturerCode: "",
  serialNumber: "",
  tag: "",
  quantity: 1,
  unit: "UN",
  criticality: "NORMAL",
  status: "ATIVO",
  location: "",
  specifications: "",
  notes: "",
};

const emptyStore = {
  contractId: "",
  duplicateContract: false,
  provisionalContract: false,
  clientId: "",
  addressId: "",
  label: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
};

const emptyProfile = {
  client: {
    name: "",
    socialName: "",
    fancyName: "",
    email: "",
    phone: "",
    whatsapp: "",
    segment: "",
    notes: "",
  },
  contact: {
    id: "",
    name: "",
    role: "",
    email: "",
    phone: "",
    whatsapp: "",
  },
};

const emptyTicket = {
  title: "",
  description: "",
  priority: "MEDIA",
  projectId: "",
  assetId: "",
};

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const assetTypeLabel = (category: string, assetType?: string | null) =>
  assetTypeOptions[category]?.find((item) => item.value === assetType)?.label
  || assetType?.replaceAll("_", " ").toLowerCase()
  || "Item técnico";

const isResolvedPreventiveOrder = (status?: string) =>
  ["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"].includes(status || "");

export default function PreventiveCentralTab() {
  const { toast } = useToast();
  const { openTab } = useWorkspace();
  const mapRef = useRef<HTMLDivElement>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [store, setStore] = useState<any | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [contractedOnly, setContractedOnly] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [assetDisciplineFilter, setAssetDisciplineFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"overview" | "pendencias" | "map" | "assets" | "history" | "reports">("overview");
  const [loading, setLoading] = useState(true);
  const [storeLoading, setStoreLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [assetModal, setAssetModal] = useState(false);
  const [storeModal, setStoreModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [portalModal, setPortalModal] = useState(false);
  const [ticketModal, setTicketModal] = useState(false);
  const [assetDetail, setAssetDetail] = useState<any | null>(null);
  const [projectForm, setProjectForm] = useState({ name: "", addressId: "", description: "" });
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [storeForm, setStoreForm] = useState(emptyStore);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [assetParentId, setAssetParentId] = useState("");
  const [editingAssetId, setEditingAssetId] = useState("");
  const [assetPhotos, setAssetPhotos] = useState<Array<{ dataUrl: string; fileName: string; mimeType: string }>>([]);
  const [assetAttributes, setAssetAttributes] = useState<Record<string, string>>({});
  const [portal, setPortal] = useState<any | null>(null);
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [ticketPhotos, setTicketPhotos] = useState<Array<{ dataUrl: string; fileName: string; mimeType: string }>>([]);
  const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
  const [contractAddressId, setContractAddressId] = useState("");
  const [temporaryPositions, setTemporaryPositions] = useState<Record<string, { x: number; y: number }>>({});

  const loadStore = async (clientId: string, preferredProjectId?: string) => {
    if (!clientId) return;
    setStoreLoading(true);
    const data = await getPreventiveStore(clientId);
    setStore(data);
    setSelectedStoreId(clientId);
    setPortal(data?.selectedContract?.portal || null);
    setContractAddressId(data?.selectedContract?.addressId || "");
    const projectId = preferredProjectId && data?.storeProjects.some((project: any) => project.id === preferredProjectId)
      ? preferredProjectId
      : data?.storeProjects[0]?.id || "";
    setSelectedProjectId(projectId);
    setTemporaryPositions({});
    setPlacingAssetId(null);
    setStoreLoading(false);
  };

  const loadInitial = async () => {
    setLoading(true);
    const [rows, clientRows] = await Promise.all([getPreventiveStores(), getClients()]);
    setStores(rows);
    setClients(clientRows);
    const first = rows.find((item: any) => item.hasActiveContract) || rows[0];
    if (first) await loadStore(first.id);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInitial(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredStores = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return stores.filter((item) => {
      if (contractedOnly && !item.hasAssignedStore) return false;
      if (companyFilter && item.clientId !== companyFilter) return false;
      if (categoryFilter && !item.categories?.includes(categoryFilter)) return false;
      if (priorityFilter && !item.priorities?.includes(priorityFilter)) return false;
      if ((periodStart || periodEnd) && !(item.activityDates || []).some((value: Date | string) => {
        const date = new Date(value);
        const start = periodStart ? new Date(`${periodStart}T00:00:00`) : null;
        const end = periodEnd ? new Date(`${periodEnd}T23:59:59`) : null;
        return (!start || date >= start) && (!end || date <= end);
      })) return false;
      if (healthFilter === "EM_DIA" && (item.healthScore === null || item.healthScore < 80)) return false;
      if (healthFilter === "ATENCAO" && (item.healthScore === null || item.healthScore < 70 || item.healthScore >= 80)) return false;
      if (healthFilter === "CRITICO" && (item.healthScore === null || item.healthScore >= 70)) return false;
      if (!normalized) return true;
      return [item.name, item.fancyName, item.socialName, item.cpfCnpj]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [stores, query, contractedOnly, companyFilter, categoryFilter, priorityFilter, healthFilter, periodStart, periodEnd]);

  const companyOptions = useMemo(() => {
    const unique = new globalThis.Map<string, string>();
    stores.forEach((item) => unique.set(item.clientId, item.name));
    return Array.from(unique, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [stores]);

  const overviewMetrics = useMemo(() => {
    const totalAssets = filteredStores.reduce((sum, item) => sum + (item.assetCount || 0), 0);
    const criticalAssets = filteredStores.reduce((sum, item) => sum + (item.criticalAssetCount || 0), 0);
    const attentionAssets = filteredStores.reduce((sum, item) => sum + (item.attentionAssetCount || 0), 0);
    const evaluated = filteredStores.filter((item) => item.healthScore !== null);
    const average = evaluated.length ? evaluated.reduce((sum, item) => sum + item.healthScore, 0) / evaluated.length : null;
    const healthyAssets = Math.max(0, totalAssets - criticalAssets - attentionAssets);
    return { totalAssets, criticalAssets, attentionAssets, healthyAssets, evaluated: evaluated.length, average, openOrders: filteredStores.reduce((sum, item) => sum + (item.openOrderCount || 0), 0) };
  }, [filteredStores]);

  const project = store?.storeProjects.find((item: any) => item.id === selectedProjectId) || null;
  const assets = project?.assets || [];
  const topLevelAssets = assets.filter((asset: any) => !asset.parentAssetId);
  const visibleTopLevelAssets = assetDisciplineFilter
    ? topLevelAssets.filter((asset: any) => asset.category === assetDisciplineFilter)
    : topLevelAssets;
  const storeTechnicalAssets = (store?.storeProjects || []).flatMap((item: any) =>
    item.assets.filter((asset: any) => !asset.parentAssetId).map((asset: any) => ({
      ...asset,
      environmentName: item.name,
    })),
  );
  const disciplineSummary = categoryOptions.map((category) => {
    const roots = storeTechnicalAssets.filter((asset: any) => asset.category === category.value);
    const components = roots.flatMap((asset: any) => asset.components || []);
    const allItems = [...roots, ...components];
    return {
      ...category,
      roots,
      components,
      quantity: allItems.reduce((sum: number, asset: any) => sum + (asset.quantity || 1), 0),
      models: new Set(allItems.map((asset: any) => [asset.brand, asset.model, asset.manufacturerCode].filter(Boolean).join("|")).filter(Boolean)).size,
      environments: new Set(roots.map((asset: any) => asset.environmentName)).size,
    };
  }).filter((item) => item.quantity > 0);
  const openPreventives = store?.serviceOrders.filter((order: any) =>
    !["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"].includes(order.status),
  ) || [];
  const preventiveOrders = store?.serviceOrders.filter((order: any) => order.type === "PREVENTIVA") || [];

  const refreshStore = async (projectId?: string) => {
    const rows = await getPreventiveStores();
    setStores(rows);
    await loadStore(selectedStoreId, projectId || selectedProjectId);
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await createStoreProject({
      clientId: store.id,
      contractId: selectedStoreId,
      ...projectForm,
      addressId: projectForm.addressId || store.selectedContract?.addressId || "",
    });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível criar o ambiente.", "error");
    setProjectModal(false);
    setProjectForm({ name: "", addressId: "", description: "" });
    await refreshStore(result.projectId);
    toast("Ambiente da loja criado.", "success");
  };

  const handleCreateAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return toast("Crie ou selecione um ambiente antes de cadastrar o item técnico.", "warning");
    setSaving(true);
    const result = editingAssetId
      ? await updateStoreAsset({
          assetId: editingAssetId,
          attributes: assetAttributes,
          ...assetForm,
        })
      : await createStoreAsset({
          projectId: selectedProjectId,
          parentAssetId: assetParentId || undefined,
          photos: assetPhotos,
          attributes: assetAttributes,
          ...assetForm,
        });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível cadastrar o item.", "error");
    setAssetModal(false);
    setAssetForm(emptyAsset);
    setAssetParentId("");
    setEditingAssetId("");
    setAssetPhotos([]);
    setAssetAttributes({});
    await refreshStore();
    toast(editingAssetId ? "Ficha técnica atualizada." : assetParentId ? "Componente vinculado ao equipamento." : "Item cadastrado e posicionado automaticamente na planta.", "success");
  };

  const readPhotoFiles = async (files?: FileList | null, limit = 8) => {
    if (!files) return [];
    const selected = Array.from(files).slice(0, limit);
    const invalid = selected.find((file) => !file.type.startsWith("image/") || file.size > 3 * 1024 * 1024);
    if (invalid) {
      toast("Use fotos JPG, PNG ou WEBP de até 3 MB cada.", "warning");
      return [];
    }
    return Promise.all(selected.map(async (file) => ({
      dataUrl: await fileToDataUrl(file),
      fileName: file.name,
      mimeType: file.type,
    })));
  };

  const openAssetCreation = (parent?: any) => {
    const category = parent?.category || "ILUMINACAO";
    setAssetParentId(parent?.id || "");
    setEditingAssetId("");
    setAssetForm({
      ...emptyAsset,
      category,
      assetType: assetTypeOptions[category]?.[0]?.value || "OUTRO",
      location: parent?.location || "",
    });
    setAssetAttributes({});
    setAssetPhotos([]);
    setAssetModal(true);
  };

  const openAssetEdit = (asset: any) => {
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(asset.specificationsJson || "{}"); } catch {}
    const { description = "", ...attributes } = parsed;
    setEditingAssetId(asset.id);
    setAssetParentId(asset.parentAssetId || "");
    setAssetForm({
      category: asset.category || "OUTROS",
      assetType: asset.assetType || assetTypeOptions[asset.category]?.[0]?.value || "OUTRO",
      name: asset.name || "",
      brand: asset.brand || "",
      model: asset.model || "",
      manufacturerCode: asset.manufacturerCode || "",
      serialNumber: asset.serialNumber || "",
      tag: asset.tag || "",
      quantity: asset.quantity || 1,
      unit: asset.unit || "UN",
      criticality: asset.criticality || "NORMAL",
      status: asset.status || "ATIVO",
      location: asset.location || "",
      specifications: description,
      notes: asset.notes || "",
    });
    setAssetAttributes(attributes);
    setAssetPhotos([]);
    setAssetDetail(null);
    setAssetModal(true);
  };

  const openPortal = async () => {
    setSaving(true);
    const result = await getOrCreateStorePortal(selectedStoreId);
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível preparar o portal.", "error");
    setPortal(result.portal);
    setPortalModal(true);
  };

  const updatePortal = async (enabled: boolean, allowTicketCreation: boolean) => {
    setSaving(true);
    const result = await setStorePortalEnabled({ contractId: selectedStoreId, enabled, allowTicketCreation });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível atualizar o portal.", "error");
    setPortal(result.portal);
    toast("Acesso do cliente atualizado.", "success");
  };

  const rotatePortal = async () => {
    setSaving(true);
    const result = await rotateStorePortalToken(selectedStoreId);
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível gerar outro link.", "error");
    setPortal(result.portal);
    toast("Novo link gerado. O endereço anterior deixou de funcionar.", "success");
  };

  const portalUrl = portal && typeof window !== "undefined" ? `${window.location.origin}/portal/loja/${portal.token}` : "";

  const openTicketCreation = (asset?: any) => {
    setTicketForm({
      ...emptyTicket,
      projectId: asset?.projectId || selectedProjectId,
      assetId: asset?.id || "",
      title: asset ? `Atendimento em ${asset.name}` : "",
    });
    setTicketPhotos([]);
    setTicketModal(true);
  };

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await createStoreTicket({ contractId: selectedStoreId, ...ticketForm, photos: ticketPhotos });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível abrir o chamado.", "error");
    setTicketModal(false);
    setTicketForm(emptyTicket);
    setTicketPhotos([]);
    await refreshStore();
    toast(`Chamado ${result.code} aberto e ligado a esta loja.`, "success");
  };

  const addPhotosToAsset = async (files?: FileList | null) => {
    if (!assetDetail) return;
    const photos = await readPhotoFiles(files, 8);
    if (!photos.length) return;
    setSaving(true);
    const result = await addStoreAssetPhotos({ assetId: assetDetail.id, photos });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível salvar as fotos.", "error");
    const fresh = await getPreventiveStore(selectedStoreId);
    setStore(fresh);
    const nextAsset = fresh?.storeProjects.flatMap((item: any) => item.assets).find((item: any) => item.id === assetDetail.id);
    setAssetDetail(nextAsset || null);
    toast(`${result.added} foto(s) adicionada(s).`, "success");
  };

  const removeAssetPhoto = async (photoId: string) => {
    setSaving(true);
    const result = await deleteStoreAssetPhoto(photoId);
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível excluir a foto.", "error");
    setAssetDetail((current: any) => current ? { ...current, photos: current.photos.filter((photo: any) => photo.id !== photoId) } : null);
    await refreshStore();
  };

  const handleFloorPlan = async (file?: File) => {
    if (!file || !selectedProjectId) return;
    if (!file.type.startsWith("image/")) {
      toast("Use PNG, JPG, WEBP ou SVG. Para PDF/DWG, exporte a prancha como imagem.", "warning");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast("A imagem da planta deve ter no máximo 4 MB.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setSaving(true);
      const result = await saveProjectFloorPlan({
        projectId: selectedProjectId,
        dataUrl: String(reader.result),
        fileName: file.name,
        mimeType: file.type,
      });
      setSaving(false);
      if (!result.success) return toast(result.error || "Não foi possível salvar a planta.", "error");
      await refreshStore();
      toast("Planta importada. Os ativos já podem ser posicionados sobre ela.", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleMapClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!placingAssetId || !mapRef.current) return;
    const bounds = mapRef.current.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setTemporaryPositions((current) => ({ ...current, [placingAssetId]: { x, y } }));
    const assetId = placingAssetId;
    setPlacingAssetId(null);
    const result = await updateStoreAssetPosition({ assetId, positionX: x, positionY: y });
    if (!result.success) {
      toast(result.error || "Não foi possível salvar a posição.", "error");
      return;
    }
    toast("Posição salva na planta.", "success");
  };

  const importExisting = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    const result = await importClientEquipmentsToProject(selectedProjectId);
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível importar.", "error");
    await refreshStore();
    toast(result.imported ? `${result.imported} equipamento(s) incorporado(s) ao ambiente.` : "Todos os equipamentos já estavam neste ambiente.", "success");
  };

  const assignStoreAddress = async () => {
    if (!contractAddressId) return toast("Selecione o endereço que representa esta loja.", "warning");
    setSaving(true);
    const result = await assignContractStore({ contractId: selectedStoreId, addressId: contractAddressId });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível vincular a loja.", "error");
    await refreshStore();
    toast("Contrato vinculado à loja. Esta unidade agora é independente na central.", "success");
  };

  const openNewStore = () => {
    const unassigned = stores.find((item) => !item.hasAssignedStore);
    const baseContract = unassigned || stores.find((item) => !item.isProvisional) || stores[0];
    if (!baseContract) {
      if (!clients[0]) {
        toast("Cadastre ao menos um cliente ou grupo para criar a loja provisória.", "warning");
        return;
      }
      setStoreForm({
        ...emptyStore,
        provisionalContract: true,
        clientId: clients[0].id,
      });
      setStoreModal(true);
      return;
    }
    setStoreForm({
      ...emptyStore,
      contractId: baseContract.id,
      duplicateContract: !unassigned,
      clientId: baseContract.clientId,
    });
    setStoreModal(true);
  };

  const openEditStore = () => {
    const address = store?.selectedContract?.address;
    if (!address) return openNewStore();
    setStoreForm({
      contractId: selectedStoreId,
      duplicateContract: false,
      provisionalContract: false,
      clientId: store.id,
      addressId: address.id,
      label: address.label || "",
      cep: address.cep || "",
      street: address.street || "",
      number: address.number || "",
      complement: address.complement || "",
      neighborhood: address.neighborhood || "",
      city: address.city || "",
      state: address.state || "",
      reference: address.reference || "",
    });
    setStoreModal(true);
  };

  const handleSaveStore = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = storeForm.provisionalContract
      ? await createProvisionalStore({
          clientId: storeForm.clientId,
          label: storeForm.label,
          cep: storeForm.cep,
          street: storeForm.street,
          number: storeForm.number,
          complement: storeForm.complement,
          neighborhood: storeForm.neighborhood,
          city: storeForm.city,
          state: storeForm.state,
          reference: storeForm.reference,
        })
      : await saveContractStore(storeForm);
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível salvar a loja.", "error");
    setStoreModal(false);
    const rows = await getPreventiveStores();
    setStores(rows);
    const nextContractId = "contractId" in result && result.contractId ? result.contractId : storeForm.contractId;
    await loadStore(nextContractId, "projectId" in result ? result.projectId : undefined);
    toast(storeForm.addressId ? "Dados da loja atualizados." : "Loja adicionada à Central de Preventivas.", "success");
    setStoreForm(emptyStore);
  };

  const openProfile = () => {
    const contact = store?.selectedContract?.contact || store?.contacts?.[0];
    setProfileForm({
      client: {
        name: store?.name || "",
        socialName: store?.socialName || "",
        fancyName: store?.fancyName || "",
        email: store?.email || "",
        phone: store?.phone || "",
        whatsapp: store?.whatsapp || "",
        segment: store?.segment || "",
        notes: store?.notes || "",
      },
      contact: {
        id: contact?.id || "",
        name: contact?.name || "",
        role: contact?.role || "",
        email: contact?.email || "",
        phone: contact?.phone || "",
        whatsapp: contact?.whatsapp || "",
      },
    });
    setProfileModal(true);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await savePreventiveStoreProfile({ contractId: selectedStoreId, ...profileForm });
    setSaving(false);
    if (!result.success) return toast(result.error || "Não foi possível salvar o cadastro.", "error");
    setProfileModal(false);
    await refreshStore();
    toast("Cadastro e responsável da loja atualizados.", "success");
  };

  if (loading) {
    return <Card className="flex min-h-[520px] items-center justify-center gap-3 text-sm font-bold text-zinc-500"><Loader2 className="animate-spin text-blue-600" /> Carregando lojas e contratos...</Card>;
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#101828] dark:text-white">Preventiva das Lojas</h1>
            <p className="mt-1 text-xs text-[#667085]">Controle de patrimônios, equipamentos e manutenções preventivas por unidade.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setWorkspaceView("reports")}><BarChart3 size={14} /> Relatórios</Button>
            <Button variant="secondary" disabled={!selectedStoreId} onClick={() => window.open(`/relatorios/loja/${selectedStoreId}`, "_blank", "noopener,noreferrer")}><Download size={14} /> Exportar</Button>
            <Button variant="secondary" onClick={openNewStore}><Plus size={14} /> Nova Loja</Button>
            <Button onClick={() => openTab("ordens-servico", "Nova Preventiva", { new: "true", requestId: String(Date.now()), clientId: store?.id || "", contractId: selectedStoreId, type: "PREVENTIVA" })}><Plus size={14} /> Nova Preventiva</Button>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-[#E4E7EC] bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_1.3fr_auto]">
          <label className="block"><span className="mb-1 block text-[9px] font-black text-[#667085]">Empresa / CNPJ</span><select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><option value="">Todas</option>{companyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[9px] font-black text-[#667085]">Loja / Unidade</span><select value={selectedStoreId} onChange={(event) => void loadStore(event.target.value)} className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{filteredStores.map((item) => <option key={item.id} value={item.id}>{item.storeLabel || item.fancyName || item.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[9px] font-black text-[#667085]">Categoria</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><option value="">Todas</option>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label.split(" / ")[0]}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[9px] font-black text-[#667085]">Status</span><select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)} className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><option value="">Todos</option><option value="EM_DIA">Em dia</option><option value="ATENCAO">Atenção</option><option value="CRITICO">Crítico</option></select></label>
          <label className="block"><span className="mb-1 block text-[9px] font-black text-[#667085]">Prioridade</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[10px] font-bold text-[#344054] outline-none focus:border-[#155EEF] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"><option value="">Todas</option><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Crítica</option></select></label>
          <div><span className="mb-1 block text-[9px] font-black text-[#667085]">Período</span><div className="flex gap-1"><input aria-label="Data inicial" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#E4E7EC] px-1 text-[9px] dark:border-zinc-700 dark:bg-zinc-800" /><input aria-label="Data final" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#E4E7EC] px-1 text-[9px] dark:border-zinc-700 dark:bg-zinc-800" /></div></div>
          <div className="flex items-end gap-1"><Button size="sm" variant="secondary"><Filter size={13} /> Filtros</Button><button type="button" onClick={() => { setCompanyFilter(""); setCategoryFilter(""); setHealthFilter(""); setPriorityFilter(""); setPeriodStart(""); setPeriodEnd(""); setContractedOnly(false); }} className="h-9 px-2 text-[9px] font-black text-[#667085] hover:text-[#155EEF]">Limpar</button></div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Pontuação Geral das Lojas", value: overviewMetrics.average === null ? "—" : overviewMetrics.average.toFixed(1).replace(".", ","), detail: overviewMetrics.average === null ? "Sem avaliações" : "/ 100 · situação atual", color: "text-[#155EEF]" },
            { label: "Lojas Avaliadas", value: overviewMetrics.evaluated, detail: `de ${filteredStores.length} lojas`, color: "text-[#101828]" },
            { label: "Equipamentos Cadastrados", value: overviewMetrics.totalAssets.toLocaleString("pt-BR"), detail: "ativos mapeados", color: "text-[#101828]" },
            { label: "Preventivas em Dia", value: overviewMetrics.totalAssets ? `${Math.round((overviewMetrics.healthyAssets / overviewMetrics.totalAssets) * 100)}%` : "—", detail: `${overviewMetrics.healthyAssets.toLocaleString("pt-BR")} de ${overviewMetrics.totalAssets.toLocaleString("pt-BR")}`, color: "text-emerald-600" },
            { label: "Pendências", value: overviewMetrics.openOrders, detail: `${overviewMetrics.criticalAssets} itens críticos`, color: overviewMetrics.criticalAssets ? "text-red-600" : "text-amber-600" },
          ].map((metric) => <div key={metric.label} className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><span className="text-[9px] font-black text-[#667085]">{metric.label}</span><strong className={`mt-2 block text-2xl font-black ${metric.color}`}>{metric.value}</strong><span className="mt-1 block text-[9px] text-[#667085]">{metric.detail}</span></div>)}
        </div>
      </section>

      <div className="grid min-h-[calc(100vh-168px)] overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50 lg:border-b-0 lg:border-r">
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Controle preventivo</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Lojas atendidas</h2>
            </div>
            <button type="button" onClick={openNewStore} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 dark:shadow-none">
              <Plus size={15} /> Loja
            </button>
          </div>
          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar loja ou CNPJ" className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs font-bold leading-relaxed text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={contractedOnly} onChange={(event) => setContractedOnly(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
            Mostrar somente contratos já vinculados a uma loja
          </label>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-390px)]">
          {filteredStores.map((item) => (
            <button key={item.id} type="button" onClick={() => void loadStore(item.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedStoreId === item.id ? "border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:ring-blue-900" : "border-transparent hover:bg-white dark:hover:bg-zinc-800"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{item.storeLabel || item.fancyName || item.name}</p>
                  <p className="mt-1 truncate text-[10px] text-zinc-500">{item.cpfCnpj || "CNPJ não informado"}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-black ${item.healthScore === null ? "bg-zinc-100 text-zinc-500" : item.healthScore >= 80 ? "bg-emerald-50 text-emerald-700" : item.healthScore >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{item.healthScore === null ? "—" : item.healthScore.toFixed(1).replace(".", ",")}</span>
              </div>
              <div className="mt-3 flex gap-4 text-[9px] font-black uppercase tracking-wide text-zinc-400">
                <span>{item.isProvisional ? "Provisória" : item.hasAssignedStore ? "Ativa" : "Definir loja"}</span>
                <span>{item.assetCount || 0} equipamento(s)</span>
              </div>
            </button>
          ))}
          {!filteredStores.length && <p className="p-6 text-center text-xs text-zinc-500">Nenhuma loja encontrada neste filtro.</p>}
        </div>
      </aside>

      <main className="flex min-w-0 flex-col">
        {storeLoading ? (
          <div className="flex min-h-[600px] items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : !store ? (
          <div className="flex min-h-[600px] flex-col items-center justify-center text-center"><Building2 size={36} className="text-zinc-300" /><p className="mt-3 text-sm font-bold text-zinc-600">Selecione uma loja para abrir a central.</p></div>
        ) : (
          <>
            {workspaceView !== "overview" && <header className="relative min-h-[250px] overflow-hidden bg-gradient-to-r from-[#07112d] via-[#0c1d4d] to-[#17356f] p-6 text-white sm:p-8">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-blue-200">Central da preventiva</span>
                    {store.selectedContract?.status === "ATIVO"
                      ? <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-200">Contrato ativo</span>
                      : <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[9px] font-black uppercase text-amber-200">Contrato provisório</span>}
                  </div>
                  <h1 className="mt-5 text-3xl font-black tracking-tight">{store.selectedContract?.address?.label || store.fancyName || store.name}</h1>
                  <p className="mt-1.5 text-sm text-slate-400">{store.selectedContract?.code} · {store.socialName || store.name} · {store.cpfCnpj}</p>
                  <p className="mt-5 flex items-start gap-2.5 text-sm text-slate-300"><MapPin size={17} className="mt-0.5 shrink-0 text-blue-300" />{store.selectedContract?.address ? `${store.selectedContract.address.street}, ${store.selectedContract.address.number} · ${store.selectedContract.address.city}/${store.selectedContract.address.state}` : "Contrato ainda não vinculado a uma loja/endereço"}</p>
                  <p className="mt-3 flex items-center gap-2.5 text-sm text-slate-300">
                    <Phone size={17} className="shrink-0 text-blue-300" />
                    {store.selectedContract?.contact
                      ? `${store.selectedContract.contact.name} · ${store.selectedContract.contact.phone}`
                      : "Responsável da loja ainda não definido"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={openProfile} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-white/15">
                      <User size={14} /> Editar cadastro e contato
                    </button>
                    {store.selectedContract?.addressId && (
                      <button type="button" onClick={openEditStore} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-white/15">
                        <MapPin size={14} /> Editar endereço da loja
                      </button>
                    )}
                    <button type="button" onClick={() => void openPortal()} className="inline-flex items-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500/20 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/30">
                      <Link2 size={14} /> Portal exclusivo da loja
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex h-24 min-w-24 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-center"><p className="text-2xl font-black">{store.contracts.length}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">Contratos</p></div>
                  <div className="flex h-24 min-w-24 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-center"><p className="text-2xl font-black">{store.storeProjects.length}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">Ambientes</p></div>
                  <div className="flex h-24 min-w-24 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-center"><p className="text-2xl font-black">{store.storeProjects.reduce((sum: number, item: any) => sum + item.assets.length, 0)}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">Ativos</p></div>
                </div>
              </div>
            </header>}

            {!store.selectedContract?.addressId && (
              <div className="border-b border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200">Defina qual loja pertence a este contrato</p>
                    <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">Esse vínculo separa ambientes, inventário técnico, planta e histórico das demais lojas do mesmo cliente.</p>
                  </div>
                  <div className="min-w-64">
                    <Select
                      label="Endereço da loja"
                      value={contractAddressId}
                      onChange={(event) => setContractAddressId(event.target.value)}
                      options={[
                        { value: "", label: "Selecione uma loja/endereço" },
                        ...store.addresses.map((address: any) => ({ value: address.id, label: `${address.label} — ${address.street}, ${address.number}` })),
                      ]}
                    />
                  </div>
                  <Button onClick={() => void assignStoreAddress()} loading={saving}>Vincular loja</Button>
                </div>
              </div>
            )}

            <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { id: "overview", label: "Resumo da Loja", icon: LayoutDashboard },
                    { id: "pendencias", label: "Pendências & Chamados", icon: AlertTriangle },
                    { id: "assets", label: "Patrimônio", icon: Package },
                    { id: "history", label: "Preventivas & Relatórios", icon: CalendarClock },
                    { id: "map", label: "Planta 2D", icon: Map },
                    { id: "reports", label: "Inventário & Dossiê", icon: FileText },
                  ].map((item) => <button key={item.id} type="button" onClick={() => setWorkspaceView(item.id as typeof workspaceView)} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${workspaceView === item.id ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}><item.icon size={16} />{item.label}</button>)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setProjectModal(true)}><Plus size={15} /> Ambiente</Button>
                  <Button disabled={!selectedProjectId} onClick={() => openAssetCreation()}><Plus size={15} /> Patrimônio</Button>
                </div>
              </div>
              {store.storeProjects.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {store.storeProjects.map((item: any) => (
                    <button key={item.id} type="button" onClick={() => { setSelectedProjectId(item.id); setTemporaryPositions({}); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold ${selectedProjectId === item.id ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"}`}>
                      {item.name} · {item.assets.length} itens
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 p-5 sm:p-7">
              {workspaceView === "overview" ? (
                <PreventiveStoreOverview
                  store={store}
                  onNewAsset={() => {
                    if (!selectedProjectId) {
                      toast("Crie ou selecione um ambiente antes de cadastrar o equipamento.", "warning");
                      setProjectModal(true);
                      return;
                    }
                    openAssetCreation();
                  }}
                  onViewAsset={setAssetDetail}
                  onNewOccurrence={openTicketCreation}
                  onOpenOrder={(order) => openTab("ordens-servico", order.code, { id: order.id, section: isResolvedPreventiveOrder(order.status) ? "relatorio" : undefined })}
                />
              ) : !project ? (
                <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 text-center dark:border-zinc-700">
                  <LayoutDashboard size={44} className="text-blue-300" />
                  <h3 className="mt-5 text-lg font-black text-zinc-900 dark:text-white">Crie o primeiro ambiente desta loja</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">Um ambiente representa o salão, estoque, provador, vitrine, copa, casa de máquinas ou outro setor. Dentro dele ficam todas as disciplinas e itens técnicos.</p>
                  <Button className="mt-6" onClick={() => setProjectModal(true)}><Plus size={16} /> Criar ambiente</Button>
                </div>
              ) : workspaceView === "pendencias" ? (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-black text-zinc-900 dark:text-white">Pendências e chamados da loja</h3>
                      <p className="mt-1 text-xs text-zinc-500">{openPreventives.length} em aberto · {store.serviceOrders.length} no histórico deste contrato</p>
                    </div>
                    <Button onClick={() => openTicketCreation()}>
                      <Plus size={14} /> Nova pendência
                    </Button>
                  </div>
                  {store.serviceOrders.length ? (
                    <div className="space-y-3">
                      {store.serviceOrders.map((order: any) => {
                        const resolved = ["CONCLUIDA", "CONCLUIDO", "RELATORIO_ENVIADO", "FATURADA", "CANCELADA"].includes(order.status);
                        const inProgress = ["DESLOCAMENTO", "EXECUCAO", "PAUSADA", "AGUARDANDO_PECA", "AGUARDANDO_CLIENTE"].includes(order.status);
                        return (
                          <div key={order.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-black text-zinc-900 dark:text-white">{order.problemReported || `${order.type.replaceAll("_", " ")} — ${order.code}`}</h4>
                                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                                    resolved ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" :
                                    inProgress ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" :
                                    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                  }`}>{resolved ? "Resolvida" : inProgress ? "Em andamento" : "Aberta"}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-zinc-500">
                                  <span>{order.type === "PREVENTIVA" ? "Identificado/registrado na preventiva" : "Chamado da loja"}</span>
                                  <span>·</span>
                                  <span className={["ALTA", "URGENTE"].includes(order.priority) ? "text-red-600" : "text-amber-600"}>Prioridade {order.priority?.toLowerCase()}</span>
                                  <span>·</span>
                                  <span>{formatDate(order.scheduledDate || order.createdAt)}</span>
                                  <span>·</span>
                                  <span>{order._count?.photos || 0} foto(s)</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {!resolved && <Button size="sm" variant="secondary" onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: "relatorio" })}><Upload size={13} /> Anexar foto</Button>}
                                <Button size="sm" variant={resolved ? "secondary" : "primary"} onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: resolved ? "relatorio" : undefined })}>
                                  {resolved ? <FileImage size={13} /> : <Wrench size={13} />} {resolved ? "Ver relatório" : "Abrir OS"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                      <CheckCircle2 className="mx-auto text-emerald-500" size={30} />
                      <p className="mt-3 text-sm font-black text-zinc-800 dark:text-zinc-200">Nenhuma pendência nesta loja</p>
                      <p className="mt-1 text-xs text-zinc-500">Os chamados e ocorrências do contrato aparecerão aqui.</p>
                    </div>
                  )}
                </div>
              ) : workspaceView === "map" ? (
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><h3 className="font-black text-zinc-900 dark:text-white">{project.name} · Planta técnica 2D</h3><p className="mt-0.5 text-[10px] text-zinc-500">{project.floorPlanFileName || "Planta esquemática gerada pelo sistema"}</p></div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar planta
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => void handleFloorPlan(event.target.files?.[0])} />
                      </label>
                    </div>
                    {placingAssetId && <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"><span>Toque no ponto da planta onde o item deve ficar.</span><button onClick={() => setPlacingAssetId(null)}><X size={14} /></button></div>}
                    <div ref={mapRef} onClick={(event) => void handleMapClick(event)} className={`relative aspect-[16/10] min-h-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-inner dark:border-zinc-700 dark:bg-zinc-950 ${placingAssetId ? "cursor-crosshair ring-2 ring-blue-500" : ""}`}>
                      {project.floorPlanData ? (
                        <img src={project.floorPlanData} alt={`Planta 2D ${project.name}`} className="h-full w-full object-contain" draggable={false} />
                      ) : (
                        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
                          <div className="absolute inset-[8%] rounded-xl border-2 border-zinc-400 bg-white/60">
                            <div className="absolute left-[34%] top-0 h-full border-l-2 border-zinc-300" />
                            <div className="absolute left-[68%] top-0 h-full border-l-2 border-zinc-300" />
                            <div className="absolute left-0 top-1/2 w-full border-t-2 border-zinc-300" />
                          </div>
                        </div>
                      )}
                      {assets.map((asset: any, index: number) => {
                        const style = categoryStyle[asset.category] || categoryStyle.OUTROS;
                        const temporary = temporaryPositions[asset.id];
                        const x = temporary?.x ?? asset.positionX;
                        const y = temporary?.y ?? asset.positionY;
                        const Icon = style.icon;
                        return (
                          <button key={asset.id} type="button" onClick={(event) => { event.stopPropagation(); setPlacingAssetId(asset.id); }} style={{ left: `${x}%`, top: `${y}%` }} className={`group absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition hover:z-20 hover:scale-125 ${style.marker} ${placingAssetId === asset.id ? "ring-4 ring-blue-300" : ""}`} title={`${asset.name} — clique e depois escolha a nova posição`}>
                            <Icon size={14} />
                            <span className="absolute -top-2 left-6 hidden min-w-max rounded bg-zinc-950 px-2 py-1 text-[9px] font-bold text-white shadow-xl group-hover:block">{index + 1}. {asset.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500">Para mover: toque em um marcador e depois toque no novo local. A posição fica salva automaticamente.</p>
                  </div>
                  <aside className="space-y-3">
                    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Legenda da planta</p>
                      <div className="mt-3 space-y-2">
                        {categoryOptions.map((category) => {
                          const count = assets.filter((asset: any) => asset.category === category.value).reduce((sum: number, asset: any) => sum + asset.quantity, 0);
                          if (!count) return null;
                          const style = categoryStyle[category.value];
                          return <div key={category.value} className="flex items-center justify-between text-[10px] font-bold text-zinc-600 dark:text-zinc-300"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${style.marker}`} />{category.label}</span><span>{count}</span></div>;
                        })}
                        {!assets.length && <p className="text-xs text-zinc-500">Cadastre itens para formar o mapa técnico.</p>}
                      </div>
                    </div>
                    {store.equipments.length > 0 && (
                      <button type="button" disabled={saving} onClick={() => void importExisting()} className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-xs font-bold text-blue-700 transition hover:border-blue-400 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                        <span className="flex items-center gap-2"><RefreshCw size={14} /> Trazer equipamentos antigos</span>
                        <span className="mt-1 block text-[10px] font-medium opacity-75">{store.equipments.length} item(ns) do cadastro anterior, sem duplicar.</span>
                      </button>
                    )}
                  </aside>
                </div>
              ) : workspaceView === "assets" ? (
                <div>
                  <div className="mb-4 flex items-center justify-between"><div><h3 className="font-black text-zinc-900 dark:text-white">Inventário técnico do ambiente</h3><p className="text-xs text-zinc-500">Elétrica, iluminação, climatização, civil, hidráulica e demais disciplinas.</p></div><Button size="sm" onClick={() => openAssetCreation()}><Plus size={13} /> Item técnico</Button></div>
                  {topLevelAssets.length > 0 && <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                    <button type="button" onClick={() => setAssetDisciplineFilter("")} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${!assetDisciplineFilter ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"}`}>Todas · {topLevelAssets.length}</button>
                    {categoryOptions.map((category) => {
                      const count = topLevelAssets.filter((asset: any) => asset.category === category.value).length;
                      if (!count) return null;
                      return <button key={category.value} type="button" onClick={() => setAssetDisciplineFilter(category.value)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black ${assetDisciplineFilter === category.value ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"}`}>{category.label} · {count}</button>;
                    })}
                  </div>}
                  {visibleTopLevelAssets.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{visibleTopLevelAssets.map((asset: any) => {
                    const style = categoryStyle[asset.category] || categoryStyle.OUTROS;
                    const Icon = style.icon;
                    let specifications = "";
                    try { specifications = JSON.parse(asset.specificationsJson || "{}").description || JSON.parse(asset.specificationsJson || "{}").capacity || ""; } catch {}
                    return <div key={asset.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-900"><div className="relative aspect-[16/8] overflow-hidden bg-zinc-100 dark:bg-zinc-800">{asset.photos?.[0] ? <img src={asset.photos[0].dataUrl} alt={asset.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Icon size={38} className="text-zinc-300" /></div>}<span className={`absolute left-3 top-3 rounded-lg border p-2 shadow-sm ${style.color}`}><Icon size={17} /></span><span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[9px] font-black text-zinc-600 shadow-sm">{asset.photos?.length || 0} foto(s)</span></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="mb-1 text-[9px] font-black uppercase tracking-wide text-blue-600">{assetTypeLabel(asset.category, asset.assetType)}</p><h4 className="text-sm font-black text-zinc-900 dark:text-white">{asset.name} {asset.quantity > 1 && <span className="text-blue-600">× {asset.quantity}</span>}</h4><p className="mt-1 text-[10px] font-semibold text-zinc-500">{[asset.brand, asset.model, asset.manufacturerCode].filter(Boolean).join(" · ") || "Marca/modelo não informado"}</p></div><StatusBadge status={asset.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800"><span className="block text-zinc-400">Identificação</span><b>{asset.tag || asset.serialNumber || "—"}</b></div><div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800"><span className="block text-zinc-400">Componentes</span><b>{asset.components?.length || 0} item(ns)</b></div><div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800"><span className="block text-zinc-400">Quantidade</span><b>{asset.quantity} {asset.unit || "UN"}</b></div><div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800"><span className="block text-zinc-400">Criticidade</span><b>{asset.criticality || "NORMAL"}</b></div></div>{specifications && <p className="mt-3 line-clamp-2 text-[10px] text-zinc-500">{specifications}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setAssetDetail(asset)}><FileImage size={13} /> Ficha técnica</Button><Button size="sm" variant="secondary" onClick={() => openAssetCreation(asset)}><Plus size={13} /> Componente</Button><button onClick={() => { setWorkspaceView("map"); setPlacingAssetId(asset.id); }} className="px-2 text-[10px] font-bold text-blue-600">Posicionar →</button></div></div></div>;
                  })}</div> : <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-xs text-zinc-500">{assetDisciplineFilter ? "Nenhum item cadastrado nesta disciplina." : "Nenhum item técnico neste ambiente."}</div>}
                </div>
              ) : workspaceView === "reports" ? (
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Prontuário técnico da loja</p>
                      <h3 className="mt-2 text-xl font-black text-zinc-900 dark:text-white">Inventário consolidado por disciplina</h3>
                      <p className="mt-1 text-xs text-zinc-500">Relatórios agrupam modelos, quantidades, ambientes e todos os componentes internos cadastrados.</p>
                    </div>
                    <Button onClick={() => window.open(`/relatorios/loja/${selectedStoreId}`, "_blank", "noopener,noreferrer")}><FileText size={15} /> Emitir dossiê completo</Button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {disciplineSummary.map((discipline) => {
                      const style = categoryStyle[discipline.value] || categoryStyle.OUTROS;
                      const Icon = style.icon;
                      return (
                        <div key={discipline.value} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-xl border p-3 ${style.color}`}><Icon size={20} /></span>
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[9px] font-black uppercase text-zinc-500 dark:bg-zinc-800">{discipline.environments} ambiente(s)</span>
                          </div>
                          <h4 className="mt-4 text-sm font-black text-zinc-900 dark:text-white">{discipline.label}</h4>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800"><b className="block text-lg text-zinc-900 dark:text-white">{discipline.quantity}</b><span className="text-[8px] font-black uppercase text-zinc-400">Itens</span></div>
                            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800"><b className="block text-lg text-zinc-900 dark:text-white">{discipline.models}</b><span className="text-[8px] font-black uppercase text-zinc-400">Modelos</span></div>
                            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800"><b className="block text-lg text-zinc-900 dark:text-white">{discipline.components.length}</b><span className="text-[8px] font-black uppercase text-zinc-400">Componentes</span></div>
                          </div>
                          <button type="button" onClick={() => window.open(`/relatorios/loja/${selectedStoreId}?disciplina=${discipline.value}`, "_blank", "noopener,noreferrer")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 transition hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"><FileText size={14} /> Emitir relatório desta disciplina</button>
                        </div>
                      );
                    })}
                  </div>

                  {!disciplineSummary.length && (
                    <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
                      <FileText className="mx-auto text-zinc-300" size={36} />
                      <p className="mt-4 text-sm font-black text-zinc-800 dark:text-zinc-200">O inventário ainda está vazio</p>
                      <p className="mt-1 text-xs text-zinc-500">Cadastre os itens por ambiente para liberar os relatórios técnicos.</p>
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="flex items-start gap-3"><Download size={20} className="mt-0.5 shrink-0 text-blue-600" /><div><h4 className="text-sm font-black text-blue-950 dark:text-blue-200">O que o dossiê entrega</h4><p className="mt-1 text-xs leading-6 text-blue-800 dark:text-blue-300">Lista de modelos de lâmpadas e quantidades por ambiente; quadros com disjuntores, DR, DPS e circuitos; equipamentos de climatização com compressor, correia, filtro e motor; tintas com nome e código da cor; hidráulica com materiais e bitolas; além de inventário CSV para compras e manutenção.</p></div></div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  <section><h3 className="mb-3 font-black text-zinc-900 dark:text-white">Contratos da loja</h3><div className="space-y-3">{store.contracts.length ? store.contracts.map((contract: any) => <div key={contract.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-black text-blue-600">{contract.code}</span><StatusBadge status={contract.status} /></div><p className="mt-2 text-lg font-black text-zinc-900 dark:text-white">{formatCurrency(contract.value)} <span className="text-[10px] text-zinc-400">/ {contract.billingPeriod.toLowerCase()}</span></p><p className="mt-1 text-[10px] text-zinc-500">Vigência até {formatDate(contract.endDate)}</p><div className="mt-3 space-y-1">{contract.items.map((item: any) => <p key={item.id} className="text-[10px] text-zinc-600 dark:text-zinc-300">• {item.description}</p>)}</div></div>) : <p className="rounded-xl border border-dashed p-6 text-center text-xs text-zinc-500">Nenhum contrato cadastrado.</p>}</div></section>
                  <section><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-zinc-900 dark:text-white">Histórico preventivo</h3><span className="text-[10px] font-bold text-zinc-400">{preventiveOrders.length} visita(s)</span></div><div className="space-y-3">{preventiveOrders.length ? preventiveOrders.map((order: any) => <button key={order.id} onClick={() => openTab("ordens-servico", order.code, { id: order.id, section: "relatorio" })} className="w-full rounded-xl border border-zinc-200 p-4 text-left transition hover:border-blue-300 dark:border-zinc-700"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-black text-blue-600">{order.code}</span><StatusBadge status={order.status} /></div><p className="mt-2 line-clamp-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">{order.problemReported || "Manutenção preventiva"}</p><p className="mt-2 text-[10px] text-zinc-500">{formatDate(order.scheduledDate || order.createdAt)} · {order._count.photos} foto(s) · {order.contract?.code || "Contrato não vinculado"}</p></button>) : <p className="rounded-xl border border-dashed p-6 text-center text-xs text-zinc-500">Nenhuma preventiva realizada.</p>}</div></section>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      </div>

      <Modal isOpen={profileModal} onClose={() => setProfileModal(false)} title="Cadastro e responsável da loja">
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <div>
                <h4 className="text-xs font-black text-zinc-900 dark:text-white">Dados cadastrais</h4>
                <p className="text-[10px] text-zinc-500">A atualização também ficará sincronizada no cadastro geral do ERP.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome no sistema *" required value={profileForm.client.name} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, name: event.target.value } }))} />
              <Input label="Nome fantasia" value={profileForm.client.fancyName} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, fancyName: event.target.value } }))} />
              <Input label="Razão social" value={profileForm.client.socialName} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, socialName: event.target.value } }))} />
              <Input label="Segmento" value={profileForm.client.segment} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, segment: event.target.value } }))} />
              <Input label="E-mail cadastral *" type="email" required value={profileForm.client.email} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, email: event.target.value } }))} />
              <Input label="Telefone cadastral *" required value={profileForm.client.phone} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, phone: event.target.value } }))} />
              <Input label="WhatsApp cadastral" value={profileForm.client.whatsapp} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, whatsapp: event.target.value } }))} />
              <Input label="Observações cadastrais" value={profileForm.client.notes} onChange={(event) => setProfileForm((current) => ({ ...current, client: { ...current.client, notes: event.target.value } }))} />
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/10">
            <div className="mb-4 flex items-center gap-2">
              <User size={16} className="text-blue-600" />
              <div>
                <h4 className="text-xs font-black text-zinc-900 dark:text-white">Responsável desta loja</h4>
                <p className="text-[10px] text-zinc-500">Este contato fica ligado ao contrato e será usado nas preventivas e OS da unidade.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome do responsável *" required value={profileForm.contact.name} onChange={(event) => setProfileForm((current) => ({ ...current, contact: { ...current.contact, name: event.target.value } }))} />
              <Input label="Cargo / função" value={profileForm.contact.role} onChange={(event) => setProfileForm((current) => ({ ...current, contact: { ...current.contact, role: event.target.value } }))} />
              <Input label="E-mail" type="email" value={profileForm.contact.email} onChange={(event) => setProfileForm((current) => ({ ...current, contact: { ...current.contact, email: event.target.value } }))} />
              <Input label="Telefone *" required value={profileForm.contact.phone} onChange={(event) => setProfileForm((current) => ({ ...current, contact: { ...current.contact, phone: event.target.value } }))} />
              <Input label="WhatsApp" value={profileForm.contact.whatsapp} onChange={(event) => setProfileForm((current) => ({ ...current, contact: { ...current.contact, whatsapp: event.target.value } }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setProfileModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar cadastro e contato</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={storeModal} onClose={() => setStoreModal(false)} title={storeForm.addressId ? "Editar loja da preventiva" : "Adicionar loja à Central de Preventivas"}>
        <form onSubmit={handleSaveStore} className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
            {storeForm.provisionalContract
              ? "A loja entrará imediatamente na operação com vínculo provisório de 90 dias e valor zero. Ambientes, inventário técnico e histórico poderão ser cadastrados normalmente."
              : storeForm.duplicateContract
              ? "O contrato escolhido será usado como modelo. O sistema criará outro contrato ativo, independente e exclusivo para a nova loja."
              : "A loja será ligada diretamente ao contrato ativo ainda disponível. Ambientes, inventário técnico, planta 2D e preventivas ficarão isolados nesta unidade."}
          </div>
          {!storeForm.addressId && (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              <button
                type="button"
                disabled={!stores.some((item) => !item.hasAssignedStore)}
                onClick={() => {
                  const available = stores.find((item) => !item.hasAssignedStore);
                  setStoreForm((current) => ({ ...current, duplicateContract: false, provisionalContract: false, contractId: available?.id || "", clientId: available?.clientId || current.clientId }));
                }}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${!storeForm.duplicateContract && !storeForm.provisionalContract ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-zinc-200"}`}
              >
                <span className="block text-xs font-black text-zinc-900">Usar contrato disponível</span>
                <span className="mt-1 block text-[10px] text-zinc-500">Para contrato ativo que ainda não possui loja.</span>
              </button>
              <button
                type="button"
                disabled={!stores.some((item) => !item.isProvisional)}
                onClick={() => {
                  const base = stores.find((item) => !item.isProvisional);
                  setStoreForm((current) => ({ ...current, duplicateContract: true, provisionalContract: false, contractId: base?.id || "", clientId: base?.clientId || current.clientId }));
                }}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${storeForm.duplicateContract && !storeForm.provisionalContract ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-zinc-200"}`}
              >
                <span className="block text-xs font-black text-zinc-900">Criar contrato para a nova loja</span>
                <span className="mt-1 block text-[10px] text-zinc-500">Copia condições e escopo de um contrato ativo.</span>
              </button>
              <button
                type="button"
                disabled={!clients.length}
                onClick={() => setStoreForm((current) => ({ ...current, duplicateContract: false, provisionalContract: true, contractId: "", clientId: current.clientId || clients[0]?.id || "" }))}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${storeForm.provisionalContract ? "border-amber-500 bg-amber-50 ring-2 ring-amber-100" : "border-zinc-200"}`}
              >
                <span className="block text-xs font-black text-zinc-900">Loja provisória</span>
                <span className="mt-1 block text-[10px] text-zinc-500">Não exige contrato ativo nem valor definido.</span>
              </button>
            </div>
          )}
          {storeForm.provisionalContract ? (
            <Select
              label="Cliente ou grupo responsável pela loja *"
              value={storeForm.clientId}
              onChange={(event) => setStoreForm((current) => ({ ...current, clientId: event.target.value }))}
              options={[
                { value: "", label: "Selecione o cliente ou grupo" },
                ...clients.map((client) => ({
                  value: client.id,
                  label: `${client.name} — ${client.cpfCnpj}`,
                })),
              ]}
            />
          ) : (
            <Select
              label={storeForm.duplicateContract ? "Contrato usado como modelo *" : "Contrato da loja *"}
              value={storeForm.contractId}
              disabled={Boolean(storeForm.addressId)}
              onChange={(event) => {
                const nextStore = stores.find((item) => item.id === event.target.value);
                setStoreForm((current) => ({ ...current, contractId: event.target.value, clientId: nextStore?.clientId || current.clientId }));
              }}
              options={[
                { value: "", label: "Selecione o contrato" },
                ...stores
                  .filter((item) => storeForm.duplicateContract ? !item.isProvisional : !item.hasAssignedStore || item.id === storeForm.contractId)
                  .map((item) => ({
                    value: item.id,
                    label: `${item.contracts[0].code} — ${item.name}${item.storeLabel ? ` — ${item.storeLabel}` : ""}${storeForm.duplicateContract ? " — copiar condições" : ""}`,
                  })),
              ]}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <Input label="Nome da loja / unidade *" required value={storeForm.label} onChange={(event) => setStoreForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ex: Farm — Búzios, Loja Barra, Unidade 025" />
            </div>
            <div className="sm:col-span-4">
              <Input label="CEP" value={storeForm.cep} onChange={(event) => setStoreForm((current) => ({ ...current, cep: event.target.value }))} />
            </div>
            <div className="sm:col-span-8">
              <Input label="Logradouro *" required value={storeForm.street} onChange={(event) => setStoreForm((current) => ({ ...current, street: event.target.value }))} />
            </div>
            <div className="sm:col-span-4">
              <Input label="Número *" required value={storeForm.number} onChange={(event) => setStoreForm((current) => ({ ...current, number: event.target.value }))} />
            </div>
            <div className="sm:col-span-5">
              <Input label="Bairro" value={storeForm.neighborhood} onChange={(event) => setStoreForm((current) => ({ ...current, neighborhood: event.target.value }))} />
            </div>
            <div className="sm:col-span-5">
              <Input label="Cidade *" required value={storeForm.city} onChange={(event) => setStoreForm((current) => ({ ...current, city: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Input label="UF *" required maxLength={2} value={storeForm.state} onChange={(event) => setStoreForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} />
            </div>
            <div className="sm:col-span-6">
              <Input label="Complemento" value={storeForm.complement} onChange={(event) => setStoreForm((current) => ({ ...current, complement: event.target.value }))} />
            </div>
            <div className="sm:col-span-6">
              <Input label="Referência" value={storeForm.reference} onChange={(event) => setStoreForm((current) => ({ ...current, reference: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setStoreModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>{storeForm.addressId ? "Salvar loja" : "Adicionar à central"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={projectModal} onClose={() => setProjectModal(false)} title="Novo ambiente ou setor da loja">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input label="Nome do ambiente *" required value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Salão de vendas, Vitrine, Estoque, Provadores, Casa de máquinas" />
          <Select label="Endereço / unidade" value={projectForm.addressId} onChange={(event) => setProjectForm((current) => ({ ...current, addressId: event.target.value }))} options={[{ value: "", label: "Sem endereço específico" }, ...(store?.addresses || []).map((address: any) => ({ value: address.id, label: `${address.label} — ${address.street}, ${address.number}` }))]} />
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-500">Descrição e referência do ambiente</span><textarea rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex: Salão principal, térreo, lado esquerdo da entrada" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setProjectModal(false)}>Cancelar</Button><Button type="submit" loading={saving}>Criar ambiente</Button></div>
        </form>
      </Modal>

      <Modal isOpen={assetModal} onClose={() => setAssetModal(false)} title={editingAssetId ? "Editar ficha técnica do item" : assetParentId ? "Cadastrar componente do equipamento" : "Cadastrar item técnico no ambiente"} size="lg">
        <form onSubmit={handleCreateAsset} className="space-y-4">
          {assetParentId && <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold text-violet-800">Este item será ligado a <b>{assets.find((item: any) => item.id === assetParentId)?.name}</b> e aparecerá na representação técnica 2D do equipamento.</div>}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <p className="text-xs font-black text-blue-950 dark:text-blue-200">1. Classificação técnica</p>
            <p className="mt-1 text-[10px] leading-5 text-blue-700 dark:text-blue-300">Escolha a disciplina e o tipo exato. Isso define os campos, relatórios e agrupamentos do inventário.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Disciplina *" disabled={Boolean(assetParentId)} value={assetForm.category} onChange={(event) => {
              const category = event.target.value;
              setAssetForm((current) => ({ ...current, category, assetType: assetTypeOptions[category]?.[0]?.value || "OUTRO" }));
              setAssetAttributes({});
            }} options={categoryOptions} />
            <Select label="Tipo técnico *" required value={assetForm.assetType} onChange={(event) => setAssetForm((current) => ({ ...current, assetType: event.target.value }))} options={assetTypeOptions[assetForm.category] || assetTypeOptions.OUTROS} />
            <div className="sm:col-span-2"><Input label="Nome de identificação *" required value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Spot do provador, QDL-01, Fan coil salão, Tinta parede principal" /></div>
            <Input label="Marca" value={assetForm.brand} onChange={(event) => setAssetForm((current) => ({ ...current, brand: event.target.value }))} />
            <Input label="Modelo" value={assetForm.model} onChange={(event) => setAssetForm((current) => ({ ...current, model: event.target.value }))} />
            <Input label="Código do fabricante / referência" value={assetForm.manufacturerCode} onChange={(event) => setAssetForm((current) => ({ ...current, manufacturerCode: event.target.value }))} placeholder="Ex: 9290030012" />
            <Input label="Número de série" value={assetForm.serialNumber} onChange={(event) => setAssetForm((current) => ({ ...current, serialNumber: event.target.value }))} />
            <Input label="TAG / identificação" value={assetForm.tag} onChange={(event) => setAssetForm((current) => ({ ...current, tag: event.target.value }))} />
            <Input label="Quantidade" type="number" min={1} value={assetForm.quantity} onChange={(event) => setAssetForm((current) => ({ ...current, quantity: Number(event.target.value) }))} />
            <Select label="Unidade" value={assetForm.unit} onChange={(event) => setAssetForm((current) => ({ ...current, unit: event.target.value }))} options={[{ value: "UN", label: "Unidade" }, { value: "M", label: "Metro" }, { value: "M2", label: "Metro quadrado" }, { value: "M3", label: "Metro cúbico" }, { value: "L", label: "Litro" }, { value: "KG", label: "Quilograma" }, { value: "CJ", label: "Conjunto" }]} />
            <Select label="Criticidade operacional" value={assetForm.criticality} onChange={(event) => setAssetForm((current) => ({ ...current, criticality: event.target.value }))} options={[{ value: "BAIXA", label: "Baixa" }, { value: "NORMAL", label: "Normal" }, { value: "ALTA", label: "Alta" }, { value: "CRITICA", label: "Crítica — paralisa a loja" }]} />
            <Select label="Situação do item" value={assetForm.status} onChange={(event) => setAssetForm((current) => ({ ...current, status: event.target.value }))} options={[{ value: "ATIVO", label: "Ativo / instalado" }, { value: "MANUTENCAO", label: "Em manutenção" }, { value: "INATIVO", label: "Inativo" }, { value: "SUBSTITUIR", label: "Programado para substituição" }]} />
            <Input label="Local exato dentro do ambiente" value={assetForm.location} onChange={(event) => setAssetForm((current) => ({ ...current, location: event.target.value }))} placeholder="Ex: Parede esquerda, circuito 7, teto do provador 2" />
          </div>
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="text-xs font-black text-zinc-900 dark:text-white">2. Dados específicos de {assetTypeLabel(assetForm.category, assetForm.assetType).toLowerCase()}</p>
            <p className="mt-1 text-[10px] text-zinc-500">Estes dados serão usados para localizar reposições e emitir os relatórios técnicos.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(categoryFields[assetForm.category] || categoryFields.OUTROS).map((field) => (
                <Input key={field.key} label={field.label} value={assetAttributes[field.key] || ""} onChange={(event) => setAssetAttributes((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} />
              ))}
            </div>
          </div>
          <Input label="Descrição técnica complementar" value={assetForm.specifications} onChange={(event) => setAssetForm((current) => ({ ...current, specifications: event.target.value }))} placeholder="Informações adicionais que não aparecem nos campos acima" />
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-500">Observações</span><textarea rows={2} value={assetForm.notes} onChange={(event) => setAssetForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800" /></label>
          {!editingAssetId && <div>
            <p className="mb-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">Fotos do modelo e da instalação</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-xs font-bold text-blue-700 transition hover:border-blue-500 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"><Upload size={16} /> Selecionar até 8 fotos<input type="file" accept="image/*" multiple className="hidden" onChange={async (event) => setAssetPhotos(await readPhotoFiles(event.target.files, 8))} /></label>
            {assetPhotos.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">{assetPhotos.map((photo, index) => <div key={`${photo.fileName}-${index}`} className="relative aspect-square overflow-hidden rounded-lg"><img src={photo.dataUrl} alt={photo.fileName} className="h-full w-full object-cover" /><button type="button" onClick={() => setAssetPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-full bg-zinc-950/70 p-1 text-white"><X size={10} /></button></div>)}</div>}
          </div>}
          <div className="rounded-lg bg-blue-50 p-3 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{assetParentId ? "As fotos e dados deste componente ficarão agrupados na ficha do equipamento principal." : "O sistema cria o ponto 2D automaticamente. Depois você pode tocar no marcador e reposicioná-lo sobre a planta."}</div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAssetModal(false)}>Cancelar</Button><Button type="submit" loading={saving}>{editingAssetId ? "Salvar ficha técnica" : "Cadastrar e mapear"}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={ticketModal} onClose={() => setTicketModal(false)} title="Abrir chamado nesta loja" size="lg">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <p className="text-xs font-black text-blue-900 dark:text-blue-200">{store?.selectedContract?.address?.label || store?.name}</p>
            <p className="mt-1 text-[10px] text-blue-700 dark:text-blue-300">O chamado será criado como OS corretiva e permanecerá ligado somente a esta loja, ao ambiente e ao patrimônio selecionados.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Ambiente / setor" value={ticketForm.projectId} onChange={(event) => setTicketForm((current) => ({ ...current, projectId: event.target.value, assetId: "" }))} options={[{ value: "", label: "Chamado geral da loja" }, ...(store?.storeProjects || []).map((item: any) => ({ value: item.id, label: item.name }))]} />
            <Select label="Patrimônio relacionado" value={ticketForm.assetId} onChange={(event) => setTicketForm((current) => ({ ...current, assetId: event.target.value }))} options={[{ value: "", label: "Sem patrimônio específico" }, ...((store?.storeProjects.find((item: any) => item.id === ticketForm.projectId)?.assets || []).map((item: any) => ({ value: item.id, label: `${item.name}${item.tag ? ` · ${item.tag}` : ""}` })))]} />
            <div className="sm:col-span-2"><Input label="Título do chamado *" required value={ticketForm.title} onChange={(event) => setTicketForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Ar-condicionado do salão não está gelando" /></div>
            <Select label="Prioridade *" value={ticketForm.priority} onChange={(event) => setTicketForm((current) => ({ ...current, priority: event.target.value }))} options={[{ value: "BAIXA", label: "Baixa" }, { value: "MEDIA", label: "Média" }, { value: "ALTA", label: "Alta" }, { value: "URGENTE", label: "Urgente" }]} />
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-500">Descrição do problema *</span><textarea required rows={5} value={ticketForm.description} onChange={(event) => setTicketForm((current) => ({ ...current, description: event.target.value }))} placeholder="Informe o defeito, local e sinais observados." className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800" /></label>
          <div><p className="mb-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">Fotos da ocorrência</p><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-xs font-bold text-blue-700"><Upload size={16} /> Anexar até 5 fotos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={async (event) => setTicketPhotos(await readPhotoFiles(event.target.files, 5))} /></label>{ticketPhotos.length > 0 && <div className="mt-3 grid grid-cols-5 gap-2">{ticketPhotos.map((photo, index) => <div key={`${photo.fileName}-${index}`} className="relative aspect-square overflow-hidden rounded-lg"><img src={photo.dataUrl} alt={photo.fileName} className="h-full w-full object-cover" /><button type="button" onClick={() => setTicketPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-full bg-zinc-950/70 p-1 text-white"><X size={10} /></button></div>)}</div>}</div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setTicketModal(false)}>Cancelar</Button><Button type="submit" loading={saving}>Criar chamado e OS</Button></div>
        </form>
      </Modal>

      <Modal isOpen={portalModal} onClose={() => setPortalModal(false)} title="Portal exclusivo do cliente" size="lg">
        {portal && <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-[#07112d] to-[#17356f] p-5 text-white">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-500/20 p-2.5 text-blue-200"><Link2 size={20} /></span><div><p className="text-xs font-black">Página exclusiva de {store?.selectedContract?.address?.label || store?.name}</p><p className="mt-1 text-[10px] leading-5 text-slate-300">O cliente vê somente esta loja, seu patrimônio, fotos, mapa 2D e os chamados do próprio contrato.</p></div></div>
          </div>
          <div><p className="mb-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">Link para compartilhar</p><div className="flex gap-2"><input readOnly value={portalUrl} className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" /><Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(portalUrl); toast("Link copiado.", "success"); }}><Clipboard size={14} /> Copiar</Button><Button variant="secondary" onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={14} /> Abrir</Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><input type="checkbox" checked={portal.enabled} onChange={(event) => void updatePortal(event.target.checked, portal.allowTicketCreation)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span><b className="block text-xs text-zinc-900 dark:text-white">Portal liberado</b><span className="mt-1 block text-[10px] text-zinc-500">Desative para bloquear o acesso sem apagar dados.</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><input type="checkbox" checked={portal.allowTicketCreation} disabled={!portal.enabled} onChange={(event) => void updatePortal(portal.enabled, event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span><b className="block text-xs text-zinc-900 dark:text-white">Cliente pode abrir chamados</b><span className="mt-1 block text-[10px] text-zinc-500">A solicitação entra automaticamente como OS desta loja.</span></span></label>
          </div>
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700"><p className="max-w-md text-[10px] leading-5 text-zinc-500">Se o link for enviado à pessoa errada, gere outro. O endereço anterior é invalidado imediatamente.</p><Button variant="secondary" loading={saving} onClick={() => void rotatePortal()}><RotateCw size={14} /> Gerar novo link</Button></div>
        </div>}
      </Modal>

      <AdminAssetDetail
        asset={assetDetail}
        saving={saving}
        onClose={() => setAssetDetail(null)}
        onAddPhotos={addPhotosToAsset}
        onDeletePhoto={removeAssetPhoto}
        onEdit={openAssetEdit}
        onOpenComponent={setAssetDetail}
        onAddComponent={(asset: any) => { setAssetDetail(null); openAssetCreation(asset); }}
        onTicket={(asset: any) => { setAssetDetail(null); openTicketCreation(asset); }}
      />
    </div>
  );
}

function AdminAssetDetail({ asset, saving, onClose, onAddPhotos, onDeletePhoto, onEdit, onOpenComponent, onAddComponent, onTicket }: any) {
  if (!asset) return null;
  const style = categoryStyle[asset.category] || categoryStyle.OUTROS;
  const Icon = style.icon;
  let specifications = "";
  let technicalEntries: Array<[string, string]> = [];
  try {
    const parsed = JSON.parse(asset.specificationsJson || "{}");
    specifications = parsed.description || "";
    technicalEntries = Object.entries(parsed).filter(([key, value]) => key !== "description" && Boolean(value)) as Array<[string, string]>;
  } catch {}
  return (
    <Modal isOpen={Boolean(asset)} onClose={onClose} title={`Ficha técnica · ${asset.name}`} size="xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)]">
        <section>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`rounded-xl border p-2.5 ${style.color}`}><Icon size={20} /></span><div><p className="text-[9px] font-black uppercase tracking-wide text-blue-600">{assetTypeLabel(asset.category, asset.assetType)}</p><h3 className="text-sm font-black text-zinc-900 dark:text-white">{asset.name}</h3><p className="text-[10px] text-zinc-500">{[asset.brand, asset.model, asset.manufacturerCode].filter(Boolean).join(" · ") || "Modelo não informado"}</p></div></div><Button size="sm" variant="secondary" onClick={() => onEdit(asset)}>Editar ficha</Button></div>
          {asset.photos?.length ? <div className="mt-4 grid grid-cols-3 gap-2">{asset.photos.map((photo: any, index: number) => <div key={photo.id} className={`group relative overflow-hidden rounded-xl ${index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}><img src={photo.dataUrl} alt={photo.caption || asset.name} className="h-full w-full object-cover" /><button type="button" disabled={saving} onClick={() => void onDeletePhoto(photo.id)} className="absolute right-2 top-2 rounded-full bg-zinc-950/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"><Trash2 size={12} /></button></div>)}</div> : <div className="mt-4 flex aspect-[16/8] items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800"><Icon size={44} className="text-zinc-300" /></div>}
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-3 text-xs font-bold text-blue-700"><Upload size={15} /> Adicionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void onAddPhotos(event.target.files)} /></label>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">{[["TAG", asset.tag], ["Série", asset.serialNumber], ["Local", asset.location], ["Quantidade", `${asset.quantity} ${asset.unit || "UN"}`], ["Criticidade", asset.criticality], ["Código fabricante", asset.manufacturerCode], ["Descrição", specifications], ["Observações", asset.notes]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800"><span className="block font-black uppercase tracking-wide text-zinc-400">{label}</span><b className="mt-1 block text-zinc-700 dark:text-zinc-200">{value || "Não informado"}</b></div>)}</div>
          {technicalEntries.length > 0 && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"><p className="text-[10px] font-black uppercase tracking-wide text-blue-600">Dados técnicos mapeados</p><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">{technicalEntries.map(([key, value]) => <div key={key}><dt className="text-[9px] font-bold uppercase text-zinc-400">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="mt-0.5 text-xs font-black text-zinc-800 dark:text-zinc-200">{value}</dd></div>)}</dl></div>}
        </section>
        <section>
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-zinc-900 dark:text-white">Modelo técnico 2D</h3><p className="mt-1 text-[10px] leading-5 text-zinc-500">Componentes agrupados dentro do equipamento principal.</p></div><Button size="sm" variant="secondary" onClick={() => onAddComponent(asset)}><Plus size={13} /> Componente</Button></div>
          <div className={`mt-4 min-h-72 rounded-2xl border-2 p-4 ${asset.category === "ELETRICA" ? "border-zinc-700 bg-zinc-950" : "border-blue-200 bg-gradient-to-b from-blue-50 to-white"}`}>
            {asset.category === "CLIMATIZACAO" && <div className="mx-auto mb-5 mt-2 max-w-sm rounded-2xl border border-blue-200 bg-white p-5 shadow-lg"><div className="h-2 rounded-full bg-blue-100"><div className="h-full w-2/3 rounded-full bg-blue-500" /></div><div className="mt-7 flex items-center justify-between"><Snowflake size={22} className="text-blue-500" /><div className="flex gap-1">{[1,2,3,4,5].map((item) => <span key={item} className="h-1 w-8 rounded bg-zinc-200" />)}</div></div></div>}
            <div className={asset.category === "ELETRICA" ? "grid grid-cols-2 gap-3" : "space-y-3"}>{asset.components?.map((component: any, index: number) => <button key={component.id} onClick={() => onOpenComponent(component)} className={`w-full rounded-xl border p-3 text-left transition hover:ring-2 hover:ring-blue-300 ${asset.category === "ELETRICA" ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800"}`}><div className="flex items-center gap-3">{component.photos?.[0] ? <img src={component.photos[0].dataUrl} alt={component.name} className="h-11 w-11 rounded-lg object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500"><CircuitBoard size={17} /></span>}<div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wide opacity-50">{assetTypeLabel(component.category, component.assetType)} · {index + 1}</p><p className="truncate text-xs font-black">{component.name}</p><p className="truncate text-[9px] opacity-60">{[component.brand, component.model, component.manufacturerCode].filter(Boolean).join(" · ") || component.tag || "Sem modelo"}</p></div></div></button>)}</div>
            {!asset.components?.length && <div className={`flex min-h-44 flex-col items-center justify-center text-center ${asset.category === "ELETRICA" ? "text-zinc-500" : "text-zinc-400"}`}><CircuitBoard size={30} /><p className="mt-3 text-xs font-bold">Nenhum componente interno mapeado.</p></div>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => onAddComponent(asset)}><Plus size={14} /> Adicionar peça</Button><Button onClick={() => onTicket(asset)}><Wrench size={14} /> Abrir chamado</Button></div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">O 2D usa dados e fotos reais do cadastro. Para gerar um 3D fiel, será necessário fotografar o item em vários ângulos ou usar escaneamento compatível.</p>
        </section>
      </div>
    </Modal>
  );
}
