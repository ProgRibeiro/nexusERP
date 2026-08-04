"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getDataGraphAction, getImportBatchDetailsAction, getImportGraphHistoryAction, type DataGraphEdge, type DataGraphNode, type DataGraphNodeType } from "@/app/actions/dataGraphActions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AlertCircle, Boxes, ChevronRight, CircleDollarSign, FileCheck2, FileText, GitBranch, Loader2, Minus, Package, Plus, Receipt, RefreshCw, Search, UserRound, Users, Wrench } from "lucide-react";

type ClientOption = { id: string; name: string; cpfCnpj: string | null; status: string };
type ImportHistory = { id: string; type: string; status: string; total: number; created: number; updated: number; skipped: number; errors: number; createdAt: string; user: string };
type ImportDetail = { id: string; rowNumber: number; status: string; entityType: string; entityId: string | null; label: string; error: string | null };

const TYPE_META: Record<DataGraphNodeType, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  CLIENTE: { label: "Cliente", color: "#2563eb", icon: UserRound },
  CONTATO: { label: "Contato", color: "#8b5cf6", icon: Users },
  EQUIPAMENTO: { label: "Equipamento", color: "#64748b", icon: Boxes },
  ORCAMENTO: { label: "Orçamento", color: "#f59e0b", icon: FileText },
  OS: { label: "Ordem de serviço", color: "#0ea5e9", icon: Wrench },
  CONTRATO: { label: "Contrato", color: "#14b8a6", icon: FileCheck2 },
  NOTA: { label: "Nota fiscal", color: "#a855f7", icon: Receipt },
  RECEBER: { label: "Conta a receber", color: "#22c55e", icon: CircleDollarSign },
  PAGAR: { label: "Conta a pagar", color: "#ef4444", icon: CircleDollarSign },
  PRODUTO: { label: "Produto", color: "#f97316", icon: Package },
};

const WIDTH = 1120;
const HEIGHT = 720;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

function money(value?: number) {
  if (value === undefined) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function GraphNodeCard({ node, x, y, onOpen }: { node: DataGraphNode; x: number; y: number; onOpen: () => void }) {
  const meta = TYPE_META[node.type];
  const Icon = meta.icon;
  const central = node.type === "CLIENTE";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`absolute -translate-x-1/2 -translate-y-1/2 text-left rounded-2xl border bg-white dark:bg-zinc-900 shadow-lg hover:-translate-y-[54%] hover:shadow-xl transition-all cursor-pointer group ${central ? "w-52 p-4 z-20 ring-4 ring-blue-500/10" : "w-40 p-3 z-10"}`}
      style={{ left: x, top: y, borderColor: `${meta.color}55` }}
      title={`Abrir ${meta.label.toLowerCase()}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="p-1.5 rounded-lg shrink-0" style={{ color: meta.color, backgroundColor: `${meta.color}14` }}><Icon size={central ? 18 : 15} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase font-black tracking-wider mb-0.5" style={{ color: meta.color }}>{meta.label}</div>
          <div className={`${central ? "text-sm" : "text-[11px]"} font-black text-zinc-900 dark:text-zinc-100 truncate`}>{node.label}</div>
          <div className="text-[9px] text-zinc-500 truncate mt-0.5">{node.subtitle}</div>
        </div>
        <ChevronRight size={12} className="text-zinc-300 group-hover:text-zinc-600 shrink-0 mt-1" />
      </div>
      {(node.status || node.value !== undefined) && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[8px] font-bold text-zinc-500 truncate">{node.status?.replaceAll("_", " ")}</span>
          <span className="text-[9px] font-black text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{money(node.value)}</span>
        </div>
      )}
    </button>
  );
}

export default function DataGraphTab() {
  const { openTab } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [focusId, setFocusId] = useState<string | undefined>();
  const [nodes, setNodes] = useState<DataGraphNode[]>([]);
  const [edges, setEdges] = useState<DataGraphEdge[]>([]);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(0.82);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<ImportDetail[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const load = useCallback(async (selected?: string, term?: string) => {
    setLoading(true);
    setError("");
    const result = await getDataGraphAction(selected, term);
    if (result.success) {
      setClients(result.clients);
      setFocusId(result.focusId || undefined);
      setNodes(result.nodes);
      setEdges(result.edges);
      setTruncated(result.truncated || false);
    } else {
      setError(result.error || "Não foi possível carregar os vínculos.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void getImportGraphHistoryAction().then((result) => result.success && setHistory(result.batches));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(undefined, search), 350);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const visibleNodes = useMemo(() => {
    const central = nodes.find((node) => node.type === "CLIENTE");
    const rest = nodes.filter((node) => node.type !== "CLIENTE").slice(0, 44);
    return central ? [central, ...rest] : rest;
  }, [nodes]);

  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    const central = visibleNodes.find((node) => node.type === "CLIENTE");
    if (central) result.set(central.id, CENTER);
    const rest = visibleNodes.filter((node) => node.type !== "CLIENTE");
    const groups: DataGraphNodeType[][] = [
      ["CONTATO", "EQUIPAMENTO"],
      ["ORCAMENTO", "CONTRATO"],
      ["OS", "PRODUTO"],
      ["NOTA", "RECEBER", "PAGAR"],
    ];
    const quadrants = [Math.PI, Math.PI * 1.5, Math.PI * 2, Math.PI * 0.5];
    groups.forEach((types, groupIndex) => {
      const group = rest.filter((node) => types.includes(node.type));
      group.forEach((node, index) => {
        const span = Math.PI * 0.42;
        const base = quadrants[groupIndex];
        const angle = group.length === 1 ? base : base - span / 2 + (span * index) / (group.length - 1);
        const ring = index % 2 === 0 ? 240 : 330;
        result.set(node.id, { x: CENTER.x + Math.cos(angle) * ring, y: CENTER.y + Math.sin(angle) * ring });
      });
    });
    return result;
  }, [visibleNodes]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const counts = useMemo(() => visibleNodes.reduce<Record<string, number>>((acc, node) => ({ ...acc, [node.type]: (acc[node.type] || 0) + 1 }), {}), [visibleNodes]);

  const showBatch = async (batchId: string) => {
    if (selectedBatch === batchId) {
      setSelectedBatch(null);
      setBatchRows([]);
      return;
    }
    setSelectedBatch(batchId);
    setBatchLoading(true);
    const result = await getImportBatchDetailsAction(batchId);
    setBatchRows(result.success ? result.rows : []);
    setBatchLoading(false);
  };

  const openImportedEntity = (row: ImportDetail) => {
    if (!row.entityId) return;
    if (row.entityType === "CLIENTE") openTab("clientes", row.label, { id: row.entityId });
    else if (row.entityType === "PRODUTO") openTab("estoque", "Estoque");
    else if (row.entityType === "SERVICO") openTab("servicos", "Serviços");
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><GitBranch size={20} className="text-primary" /><h1 className="text-lg font-black text-zinc-950 dark:text-white">Teia de Dados</h1></div>
          <p className="text-[11px] text-zinc-500 mt-1">Navegue do cliente até a operação, estoque, faturamento e financeiro sem perder o contexto.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))} className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"><Minus size={14} /></button>
          <span className="text-[10px] font-bold text-zinc-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))} className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"><Plus size={14} /></button>
          <button type="button" onClick={() => void load(focusId, search)} className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-4">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm">
            <label className="relative block"><Search size={13} className="absolute left-3 top-2.5 text-zinc-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente ou documento" className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] outline-none focus:border-primary" /></label>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1">
              {clients.map((client) => (
                <button key={client.id} type="button" onClick={() => void load(client.id, search)} className={`w-full text-left px-3 py-2 rounded-xl cursor-pointer transition-colors ${focusId === client.id ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                  <div className="text-[11px] font-bold truncate">{client.name}</div><div className="text-[9px] text-zinc-500 mt-0.5">{client.cpfCnpj}</div>
                </button>
              ))}
              {!loading && clients.length === 0 && <p className="p-3 text-[10px] text-zinc-400 text-center">Nenhum cliente encontrado.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-3">Pontos desta teia</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(counts).map(([type, count]) => <div key={type} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-2"><div className="text-base font-black" style={{ color: TYPE_META[type as DataGraphNodeType].color }}>{count}</div><div className="text-[8px] font-bold text-zinc-500 truncate">{TYPE_META[type as DataGraphNodeType].label}</div></div>)}
            </div>
          </div>
        </aside>

        <section className="relative min-h-[650px] overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_48%)] dark:bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_50%)] shadow-sm">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#94a3b8 0.7px, transparent 0.7px)", backgroundSize: "20px 20px" }} />
          {loading ? <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm"><Loader2 size={28} className="animate-spin text-primary" /></div> : error ? <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 text-red-500"><AlertCircle size={24} /><span className="text-xs font-bold">{error}</span></div> : null}
          <div className="absolute left-1/2 top-1/2 origin-center transition-transform duration-300" style={{ width: WIDTH, height: HEIGHT, transform: `translate(-50%, -50%) scale(${zoom})` }}>
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
              <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#94a3b8" /></marker></defs>
              {visibleEdges.map((edge) => {
                const source = positions.get(edge.source); const target = positions.get(edge.target); if (!source || !target) return null;
                const mx = (source.x + target.x) / 2; const my = (source.y + target.y) / 2;
                return <g key={edge.id}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#94a3b8" strokeWidth="1.25" strokeOpacity="0.55" markerEnd="url(#arrow)" /><rect x={mx - 38} y={my - 8} width="76" height="16" rx="8" fill="white" fillOpacity="0.88" /><text x={mx} y={my + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#64748b">{edge.label}</text></g>;
              })}
            </svg>
            {visibleNodes.map((node) => { const position = positions.get(node.id); if (!position) return null; return <GraphNodeCard key={node.id} node={node} x={position.x} y={position.y} onOpen={() => openTab(node.tab, node.label, node.params)} />; })}
          </div>
          {truncated && <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-200 dark:border-amber-500/20">Mostrando os vínculos mais recentes</div>}
        </section>
      </div>

      {history.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-3"><GitBranch size={14} className="text-primary" /><h2 className="text-xs font-black">Linhagem das entradas recentes</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {history.map((batch) => (
              <button type="button" onClick={() => void showBatch(batch.id)} key={batch.id} className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${selectedBatch === batch.id ? "border-primary bg-blue-50/60 dark:bg-blue-500/5" : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>
                <div className="flex justify-between gap-2"><span className="text-[9px] font-black uppercase text-primary">{batch.type}</span><span className={`text-[8px] font-bold ${batch.errors ? "text-amber-600" : "text-emerald-600"}`}>{batch.status.replaceAll("_", " ")}</span></div>
                <div className="text-xs font-black mt-1">{batch.created} novos · {batch.updated} atualizados</div>
                <div className="text-[9px] text-zinc-500 mt-1">{batch.total} linhas · {batch.user} · {new Date(batch.createdAt).toLocaleString("pt-BR")}</div>
              </button>
            ))}
          </div>
          {selectedBatch && (
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-2">Planilha → linha normalizada → registro do ERP</div>
              {batchLoading ? <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-primary" /></div> : (
                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                  {batchRows.map((row) => (
                    <button type="button" disabled={!row.entityId} onClick={() => openImportedEntity(row)} key={row.id} className="w-full grid grid-cols-[60px_90px_minmax(0,1fr)] md:grid-cols-[60px_100px_minmax(0,1fr)_200px] items-center gap-3 py-2.5 px-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:cursor-default cursor-pointer rounded-lg">
                      <span className="text-[9px] font-bold text-zinc-400">Linha {row.rowNumber}</span>
                      <span className={`text-[8px] font-black ${row.status === "ERRO" ? "text-red-600" : row.status === "IGNORADO" ? "text-amber-600" : "text-emerald-600"}`}>{row.status}</span>
                      <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 truncate">{row.label}</span>
                      <span className="hidden md:block text-[9px] text-zinc-500 truncate">{row.error || `${row.entityType} conectado ao ERP`}</span>
                    </button>
                  ))}
                  {batchRows.length === 0 && <div className="py-8 text-center text-[10px] text-zinc-400">Nenhuma linha disponível neste lote.</div>}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
