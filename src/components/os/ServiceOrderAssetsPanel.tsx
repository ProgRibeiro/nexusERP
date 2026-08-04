"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Check, Cpu, ImageIcon, Loader2, MapPin, Search, Star, Tag, X } from "lucide-react";
import {
  getServiceOrderAssetWorkspace,
  saveServiceOrderAssets,
  type ServiceOrderAssetInput,
} from "@/app/actions/serviceOrderAssetActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface AssetCandidate {
  kind: "STORE_ASSET" | "CLIENT_EQUIPMENT";
  assetId: string;
  name: string;
  category: string;
  subtitle: string;
  location: string;
  projectName: string;
  tag?: string | null;
  serialNumber?: string | null;
  componentCount: number;
  photoCount: number;
}

interface Props {
  serviceOrderId: string;
  onChanged: () => Promise<void> | void;
}

function keyOf(item: { kind: string; assetId: string }) {
  return `${item.kind}:${item.assetId}`;
}

export default function ServiceOrderAssetsPanel({ serviceOrderId, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [selected, setSelected] = useState<ServiceOrderAssetInput[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const result = await getServiceOrderAssetWorkspace(serviceOrderId);
      if (!active) return;
      if (!result.success) {
        toast(result.error || "Erro ao carregar patrimônio.", "error");
      } else {
        setCandidates(result.candidates);
        setSelected(result.current);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [serviceOrderId, toast]);

  const selectedKeys = useMemo(() => new Set(selected.map(keyOf)), [selected]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((asset) => [asset.name, asset.category, asset.subtitle, asset.location, asset.projectName, asset.tag, asset.serialNumber]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
  }, [candidates, search]);

  const toggle = (asset: AssetCandidate) => {
    const key = keyOf(asset);
    if (selectedKeys.has(key)) {
      const remaining = selected.filter((item) => keyOf(item) !== key);
      if (remaining.length && !remaining.some((item) => item.isPrimary)) remaining[0] = { ...remaining[0], isPrimary: true };
      setSelected(remaining);
      return;
    }
    setSelected((current) => [
      ...current,
      { kind: asset.kind, assetId: asset.assetId, isPrimary: current.length === 0, problem: "" },
    ]);
  };

  const setPrimary = (key: string) => {
    setSelected((current) => current.map((item) => ({ ...item, isPrimary: keyOf(item) === key })));
  };

  const setProblem = (key: string, problem: string) => {
    setSelected((current) => current.map((item) => keyOf(item) === key ? { ...item, problem } : item));
  };

  const save = async () => {
    setSaving(true);
    const result = await saveServiceOrderAssets(serviceOrderId, selected);
    setSaving(false);
    if (!result.success) return toast(result.error || "Erro ao salvar ativos.", "error");
    toast(`${result.count} ativo(s) vinculado(s) à OS.`, "success");
    await onChanged();
  };

  if (loading) {
    return <div className="flex min-h-56 items-center justify-center text-zinc-400"><Loader2 className="mr-2 animate-spin" size={18} /> Carregando patrimônio do cliente...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200/75">Escopo técnico</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-black">Ativos envolvidos nesta OS</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-blue-100/70">Selecione máquinas, quadros, luminárias ou equipamentos. Um deles será o ativo principal e todos conservarão histórico próprio.</p>
          </div>
          <span className="w-fit rounded-xl bg-white/10 px-3 py-2 text-xs font-black">{selected.length} selecionado(s)</span>
        </div>
      </div>

      {selected.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">Escopo selecionado</h4><span className="text-[10px] font-semibold text-zinc-500">Defina o problema por ativo</span></div>
          {selected.map((link) => {
            const asset = candidates.find((candidate) => keyOf(candidate) === keyOf(link));
            if (!asset) return null;
            const key = keyOf(link);
            return (
              <div key={key} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-zinc-900"><Cpu size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{asset.name}</strong>{link.isPrimary && <span className="rounded-md bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800"><Star className="mr-1 inline" size={10} fill="currentColor" /> Principal</span>}</div>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">{asset.projectName} · {asset.location}</p>
                  </div>
                  <button type="button" onClick={() => toggle(asset)} className="rounded-lg p-2 text-zinc-400 hover:bg-white hover:text-red-600" aria-label={`Remover ${asset.name}`}><X size={16} /></button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
                  <button type="button" onClick={() => setPrimary(key)} className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${link.isPrimary ? "border-amber-300 bg-amber-50 text-amber-800" : "border-zinc-200 bg-white text-zinc-500 hover:border-amber-300 dark:bg-zinc-900"}`}><Star className="mr-1 inline" size={12} /> Tornar principal</button>
                  <input value={link.problem || ""} onChange={(event) => setProblem(key, event.target.value)} placeholder="Falha, sintoma ou serviço específico deste ativo" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, categoria, loja, local, tag ou número de série" className="pl-10" /></div>
        {!filtered.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700"><Boxes className="mx-auto text-zinc-300" /><p className="mt-2 text-sm font-bold">Nenhum ativo encontrado</p><p className="text-xs text-zinc-500">Cadastre o patrimônio na Central da Preventiva ou refine a pesquisa.</p></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((asset) => {
              const selectedAsset = selectedKeys.has(keyOf(asset));
              return (
                <button key={keyOf(asset)} type="button" onClick={() => toggle(asset)} className={`rounded-2xl border p-4 text-left transition ${selectedAsset ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-950/20" : "border-zinc-200 bg-white hover:border-blue-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selectedAsset ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>{selectedAsset ? <Check size={17} /> : <Cpu size={17} />}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{asset.name}</strong><span className="mt-1 block truncate text-[10px] font-semibold text-zinc-500">{asset.subtitle}</span></span>
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-[8px] font-black uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{asset.category.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold text-zinc-500"><span><MapPin className="mr-1 inline" size={10} />{asset.location}</span>{asset.tag && <span><Tag className="mr-1 inline" size={10} />{asset.tag}</span>}{asset.photoCount > 0 && <span><ImageIcon className="mr-1 inline" size={10} />{asset.photoCount} foto(s)</span>}{asset.componentCount > 0 && <span><Boxes className="mr-1 inline" size={10} />{asset.componentCount} componente(s)</span>}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end border-t border-zinc-200 bg-white/95 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"><Button type="button" onClick={save} loading={saving}><Check size={15} /> Salvar ativos da OS</Button></div>
    </div>
  );
}
