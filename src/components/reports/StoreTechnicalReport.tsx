"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useMemo } from "react";
import {
  ArrowLeft,
  Building2,
  CircuitBoard,
  Download,
  FileText,
  LampCeiling,
  MapPin,
  Printer,
  Snowflake,
  Wrench,
} from "lucide-react";

const disciplineLabels: Record<string, string> = {
  ELETRICA: "Elétrica",
  ILUMINACAO: "Iluminação",
  CLIMATIZACAO: "Climatização",
  CIVIL: "Civil e acabamentos",
  HIDRAULICA: "Hidráulica",
  REFRIGERACAO: "Refrigeração",
  INCENDIO: "Prevenção de incêndio",
  SEGURANCA: "Segurança",
  DADOS_AUTOMACAO: "Dados e automação",
  MOBILIARIO: "Mobiliário",
  OUTROS: "Outras disciplinas",
};

const disciplineColors: Record<string, string> = {
  ELETRICA: "bg-violet-600",
  ILUMINACAO: "bg-amber-500",
  CLIMATIZACAO: "bg-blue-600",
  CIVIL: "bg-orange-600",
  HIDRAULICA: "bg-sky-600",
  REFRIGERACAO: "bg-cyan-600",
  INCENDIO: "bg-red-600",
  SEGURANCA: "bg-rose-600",
  DADOS_AUTOMACAO: "bg-indigo-600",
  MOBILIARIO: "bg-emerald-600",
  OUTROS: "bg-slate-600",
};

const technicalTypeLabel = (value?: string | null) =>
  value ? value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "Item técnico";

const parseSpecifications = (value?: string | null) => {
  try {
    return JSON.parse(value || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

const formatTechnicalKey = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function StoreTechnicalReport({ dossier, discipline }: { dossier: any; discipline: string }) {
  const selectedDiscipline = disciplineLabels[discipline] ? discipline : "";
  const assets = useMemo(() => dossier.environments.flatMap((environment: any) =>
    environment.assets
      .filter((asset: any) => !selectedDiscipline || asset.category === selectedDiscipline)
      .map((asset: any) => ({ ...asset, environmentName: environment.name })),
  ), [dossier.environments, selectedDiscipline]);
  const allItems = useMemo(() => assets.flatMap((asset: any) => [
    { ...asset, parentName: "", component: false },
    ...(asset.components || []).map((component: any) => ({
      ...component,
      environmentName: asset.environmentName,
      parentName: asset.name,
      component: true,
    })),
  ]), [assets]);

  const groups = useMemo(() => {
    const map = new Map<string, any>();
    allItems.forEach((item: any) => {
      const specs = parseSpecifications(item.specificationsJson);
      const key = [
        item.category,
        item.assetType,
        item.brand,
        item.model,
        item.manufacturerCode,
        JSON.stringify(specs),
      ].join("|");
      const current = map.get(key) || {
        ...item,
        quantityTotal: 0,
        environments: new Set<string>(),
        occurrences: 0,
      };
      current.quantityTotal += item.quantity || 1;
      current.environments.add(item.environmentName);
      current.occurrences += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).map((item) => ({
      ...item,
      environments: Array.from(item.environments),
    }));
  }, [allItems]);

  const disciplines = useMemo(() => Array.from(new Set(assets.map((asset: any) => asset.category))), [assets]);
  const boards = assets.filter((asset: any) => asset.category === "ELETRICA" && asset.assetType === "QUADRO_ELETRICO");
  const hvac = assets.filter((asset: any) => asset.category === "CLIMATIZACAO");
  const lightingGroups = groups.filter((item: any) => item.category === "ILUMINACAO");
  const civilGroups = groups.filter((item: any) => item.category === "CIVIL");
  const hydraulicGroups = groups.filter((item: any) => item.category === "HIDRAULICA");
  const storeAddress = dossier.store.address
    ? `${dossier.store.address.street}, ${dossier.store.address.number}${dossier.store.address.complement ? ` · ${dossier.store.address.complement}` : ""} · ${dossier.store.address.city}/${dossier.store.address.state}`
    : "Endereço não informado";

  const downloadCsv = () => {
    const header = [
      "Ambiente",
      "Disciplina",
      "Tipo",
      "Equipamento principal",
      "Item",
      "Marca",
      "Modelo",
      "Código fabricante",
      "TAG",
      "Série",
      "Quantidade",
      "Unidade",
      "Criticidade",
      "Local exato",
      "Dados técnicos",
    ];
    const rows = allItems.map((item: any) => {
      const specifications = parseSpecifications(item.specificationsJson);
      return [
        item.environmentName,
        disciplineLabels[item.category] || item.category,
        technicalTypeLabel(item.assetType),
        item.parentName,
        item.name,
        item.brand,
        item.model,
        item.manufacturerCode,
        item.tag,
        item.serialNumber,
        item.quantity,
        item.unit,
        item.criticality,
        item.location,
        Object.entries(specifications).map(([key, value]) => `${formatTechnicalKey(key)}: ${value}`).join(" | "),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inventario-${dossier.store.label.replace(/\W+/g, "-").toLowerCase()}${selectedDiscipline ? `-${selectedDiscipline.toLowerCase()}` : ""}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <style jsx global>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .report-page { max-width: none !important; padding: 0 !important; }
          .report-section { break-inside: avoid; box-shadow: none !important; }
          .page-break { break-before: page; }
          .print-compact { font-size: 9px !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <button onClick={() => window.close()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"><ArrowLeft size={17} /> Voltar para a Central</button>
          <div className="flex gap-2">
            <button onClick={downloadCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"><Download size={16} /> Baixar inventário CSV</button>
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200"><Printer size={16} /> Imprimir / salvar PDF</button>
          </div>
        </div>
      </div>

      <div className="report-page mx-auto max-w-[1120px] space-y-6 px-4 py-7 sm:px-8 print:space-y-4">
        <header className="report-section overflow-hidden rounded-3xl bg-[#071331] text-white shadow-xl print:rounded-none">
          <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-black">NX</span><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">Prontuário técnico da loja</p><p className="text-xs text-slate-400">Inventário de instalações, equipamentos e componentes</p></div></div>
              <h1 className="mt-7 text-3xl font-black tracking-tight">{dossier.store.label}</h1>
              <p className="mt-2 text-sm text-slate-400">{dossier.store.groupName} · {dossier.store.code}</p>
              <p className="mt-5 flex items-start gap-2 text-sm text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-blue-300" />{storeAddress}</p>
              {selectedDiscipline && <span className="mt-5 inline-flex rounded-full bg-blue-500/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-blue-200">Relatório de {disciplineLabels[selectedDiscipline]}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ReportKpi value={dossier.environments.length} label="Ambientes" />
              <ReportKpi value={allItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)} label="Itens" />
              <ReportKpi value={groups.length} label="Modelos" />
            </div>
          </div>
        </header>

        <section className="report-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Resumo executivo</p><h2 className="mt-1 text-xl font-black">Cobertura do inventário</h2></div><FileText className="text-slate-300" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {disciplines.map((category) => {
              const disciplineItems = allItems.filter((item: any) => item.category === category);
              return <div key={String(category)} className="rounded-xl border border-slate-200 p-4"><span className={`block h-1.5 w-12 rounded-full ${disciplineColors[String(category)] || disciplineColors.OUTROS}`} /><h3 className="mt-3 text-sm font-black">{disciplineLabels[String(category)] || String(category)}</h3><p className="mt-1 text-xs text-slate-500">{disciplineItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)} itens · {new Set(disciplineItems.map((item: any) => `${item.brand}|${item.model}|${item.manufacturerCode}`)).size} modelos</p></div>;
            })}
          </div>
        </section>

        {lightingGroups.length > 0 && (
          <ReportTableSection icon={LampCeiling} eyebrow="Iluminação" title="Modelos de lâmpadas, luminárias e comandos" description="Consolidação para reposição, padronização e compras.">
            <ModelTable groups={lightingGroups} />
          </ReportTableSection>
        )}

        {boards.length > 0 && (
          <section className="report-section page-break rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionHeading icon={CircuitBoard} eyebrow="Elétrica" title="Quadros e componentes mapeados" description="Relação de disjuntores, DR, DPS, contatores, relés, barramentos e circuitos por quadro." />
            <div className="mt-5 space-y-5">
              {boards.map((board: any) => <EquipmentAssembly key={board.id} asset={board} />)}
            </div>
          </section>
        )}

        {hvac.length > 0 && (
          <section className="report-section page-break rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionHeading icon={Snowflake} eyebrow="Climatização" title="Equipamentos e componentes de climatização" description="Máquinas, fan coils, compressores, correias, filtros, motores e controles associados." />
            <div className="mt-5 space-y-5">
              {hvac.map((asset: any) => <EquipmentAssembly key={asset.id} asset={asset} />)}
            </div>
          </section>
        )}

        {civilGroups.length > 0 && (
          <ReportTableSection icon={Building2} eyebrow="Civil" title="Cores, tintas, revestimentos e acabamentos" description="Referências para recomposição visual e manutenção do padrão da loja.">
            <ModelTable groups={civilGroups} />
          </ReportTableSection>
        )}

        {hydraulicGroups.length > 0 && (
          <ReportTableSection icon={Wrench} eyebrow="Hidráulica" title="Itens hidráulicos e especificações" description="Modelos, bitolas, materiais, conexões e localização.">
            <ModelTable groups={hydraulicGroups} />
          </ReportTableSection>
        )}

        {groups.filter((item: any) => !["ILUMINACAO", "ELETRICA", "CLIMATIZACAO", "CIVIL", "HIDRAULICA"].includes(item.category)).length > 0 && (
          <ReportTableSection icon={FileText} eyebrow="Demais disciplinas" title="Inventário técnico complementar" description="Refrigeração, incêndio, segurança, dados, automação e mobiliário.">
            <ModelTable groups={groups.filter((item: any) => !["ILUMINACAO", "ELETRICA", "CLIMATIZACAO", "CIVIL", "HIDRAULICA"].includes(item.category))} />
          </ReportTableSection>
        )}

        {!allItems.length && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center"><FileText className="mx-auto text-slate-300" size={40} /><h2 className="mt-4 font-black">Nenhum item cadastrado neste relatório</h2><p className="mt-2 text-sm text-slate-500">Volte à Central e cadastre os itens técnicos nos ambientes da loja.</p></section>}

        <footer className="flex flex-col gap-2 border-t border-slate-300 px-2 py-5 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>O Prestador · Prontuário técnico gerado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dossier.generatedAt))}</span>
          <span>Documento de apoio operacional. Confirmar dados críticos em campo antes de intervenções.</span>
        </footer>
      </div>
    </main>
  );
}

function ReportKpi({ value, label }: { value: number; label: string }) {
  return <div className="min-w-20 rounded-xl border border-white/10 bg-white/[0.07] p-3 text-center"><b className="block text-xl">{value}</b><span className="text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</span></div>;
}

function SectionHeading({ icon: Icon, eyebrow, title, description }: any) {
  return <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon size={20} /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p><h2 className="mt-1 text-lg font-black">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div></div>;
}

function ReportTableSection({ icon, eyebrow, title, description, children }: any) {
  return <section className="report-section rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><SectionHeading icon={icon} eyebrow={eyebrow} title={title} description={description} /><div className="mt-5 overflow-x-auto">{children}</div></section>;
}

function ModelTable({ groups }: { groups: any[] }) {
  return <table className="print-compact w-full min-w-[760px] border-collapse text-left text-[11px]"><thead><tr className="border-y border-slate-200 bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Tipo / item</th><th className="px-3 py-3">Marca / modelo</th><th className="px-3 py-3">Dados técnicos</th><th className="px-3 py-3">Ambientes</th><th className="px-3 py-3 text-right">Quantidade</th></tr></thead><tbody>{groups.map((item, index) => { const specs = parseSpecifications(item.specificationsJson); return <tr key={`${item.category}-${item.assetType}-${item.model}-${index}`} className="border-b border-slate-100 align-top"><td className="px-3 py-3"><b className="block">{technicalTypeLabel(item.assetType)}</b><span className="text-slate-500">{item.name}</span></td><td className="px-3 py-3"><b className="block">{[item.brand, item.model].filter(Boolean).join(" · ") || "Não informado"}</b><span className="text-slate-500">{item.manufacturerCode || item.tag || ""}</span></td><td className="max-w-xs px-3 py-3 text-slate-600">{Object.entries(specs).filter(([, value]) => Boolean(value)).map(([key, value]) => `${formatTechnicalKey(key)}: ${value}`).join(" · ") || "—"}</td><td className="px-3 py-3 text-slate-600">{item.environments.join(", ")}</td><td className="px-3 py-3 text-right font-black">{item.quantityTotal} {item.unit || "UN"}</td></tr>; })}</tbody></table>;
}

function EquipmentAssembly({ asset }: { asset: any }) {
  const specs = parseSpecifications(asset.specificationsJson);
  return <article className="overflow-hidden rounded-xl border border-slate-200"><div className="grid gap-4 bg-slate-950 p-4 text-white sm:grid-cols-[1fr_auto]"><div><p className="text-[9px] font-black uppercase tracking-wide text-blue-300">{technicalTypeLabel(asset.assetType)} · {asset.environmentName}</p><h3 className="mt-1 text-base font-black">{asset.name}</h3><p className="mt-1 text-[10px] text-slate-400">{[asset.brand, asset.model, asset.manufacturerCode].filter(Boolean).join(" · ") || "Modelo não informado"}{asset.tag ? ` · TAG ${asset.tag}` : ""}</p></div><span className="self-start rounded-full bg-white/10 px-3 py-1 text-[9px] font-black">{asset.components?.length || 0} componentes</span></div><div className="grid gap-4 p-4 lg:grid-cols-[.7fr_1.3fr]"><div>{asset.photos?.[0] ? <img src={asset.photos[0].dataUrl} alt={asset.name} className="aspect-[16/9] w-full rounded-lg object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-slate-100"><CircuitBoard className="text-slate-300" size={34} /></div>}<dl className="mt-3 grid grid-cols-2 gap-2">{Object.entries(specs).filter(([, value]) => Boolean(value)).slice(0, 8).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-2"><dt className="text-[8px] font-black uppercase text-slate-400">{formatTechnicalKey(key)}</dt><dd className="mt-1 text-[10px] font-bold">{String(value)}</dd></div>)}</dl></div><div className="overflow-x-auto"><table className="print-compact w-full min-w-[520px] text-left text-[10px]"><thead><tr className="border-b border-slate-200 text-[8px] uppercase text-slate-400"><th className="pb-2">Componente</th><th className="pb-2">Marca / modelo</th><th className="pb-2">Identificação</th><th className="pb-2 text-right">Qtd.</th></tr></thead><tbody>{asset.components?.map((component: any) => <tr key={component.id} className="border-b border-slate-100"><td className="py-2"><b className="block">{technicalTypeLabel(component.assetType)}</b><span className="text-slate-500">{component.name}</span></td><td className="py-2">{[component.brand, component.model, component.manufacturerCode].filter(Boolean).join(" · ") || "—"}</td><td className="py-2">{component.tag || component.serialNumber || "—"}</td><td className="py-2 text-right font-black">{component.quantity} {component.unit || "UN"}</td></tr>)}{!asset.components?.length && <tr><td colSpan={4} className="py-8 text-center text-slate-400">Nenhum componente interno cadastrado.</td></tr>}</tbody></table></div></div></article>;
}
