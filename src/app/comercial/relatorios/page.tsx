import { getCommercialDashboardAction } from "@/app/actions/commercialActions";

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function ComercialRelatoriosPage() {
  const result = await getCommercialDashboardAction();
  if (!result.success) {
    return (
      <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-black text-red-200">Erro ao gerar relatório comercial</h2>
        <p className="mt-2 text-sm text-red-100">{result.error}</p>
      </section>
    );
  }

  const { totals, stageBreakdown } = result.snapshot;
  return (
    <section className="space-y-5">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Indicadores comerciais</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Taxa de conversão</p>
          <p className="mt-2 text-2xl font-black text-emerald-300">{toPercent(totals.convertedLeads, totals.leads)}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Taxa de perda</p>
          <p className="mt-2 text-2xl font-black text-rose-300">{toPercent(totals.lostLeads, totals.leads)}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Leads ativos</p>
          <p className="mt-2 text-2xl font-black text-blue-300">{toPercent(totals.openLeads, totals.leads)}</p>
        </article>
      </div>

      <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Distribuição por etapa</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {stageBreakdown.map((stage) => (
            <li key={stage.stageId} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
              <span className="text-zinc-200">{stage.stageName}</span>
              <span className="font-semibold text-zinc-100">{stage.leads} leads</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
