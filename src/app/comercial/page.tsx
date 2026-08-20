import Link from "next/link";
import { getCommercialDashboardAction } from "@/app/actions/commercialActions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ComercialDashboardPage() {
  const result = await getCommercialDashboardAction();
  if (!result.success) {
    return (
      <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
        <h2 className="text-xl font-black text-red-200">Falha ao carregar dashboard comercial</h2>
        <p className="mt-2 text-sm text-red-100">{result.error}</p>
      </section>
    );
  }

  const { totals, stageBreakdown, dueFollowUps } = result.snapshot;
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Leads totais" value={String(totals.leads)} />
        <Card label="Leads em negociação" value={String(totals.openLeads)} />
        <Card label="Convertidos" value={String(totals.convertedLeads)} />
        <Card label="Perdidos" value={String(totals.lostLeads)} />
        <Card label="Valor em aberto" value={formatCurrency(totals.openValue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300">Pipeline por etapa</h3>
          <div className="mt-4 space-y-3">
            {stageBreakdown.map((item) => (
              <div key={item.stageId} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <p className="text-sm font-bold text-white">{item.stageName}</p>
                <p className="text-xs text-zinc-300">{item.leads} leads</p>
                <p className="text-xs font-semibold text-[#d4af37]">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-300">Follow-ups vencidos</h3>
          <div className="mt-4 space-y-3">
            {dueFollowUps.length === 0 && <p className="text-sm text-zinc-400">Nenhuma atividade vencida.</p>}
            {dueFollowUps.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="text-sm font-semibold text-amber-100">{item.leadName}</p>
                <p className="text-xs text-amber-50">{item.type} · {item.description}</p>
                <p className="text-xs text-amber-200">{new Date(item.date).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/comercial/pipeline" className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-black hover:bg-[#f0cf63]">
          Abrir pipeline
        </Link>
        <Link href="/comercial/leads" className="rounded-lg border border-[#d4af37]/50 px-4 py-2 text-xs font-black text-[#d4af37] hover:bg-[#d4af37]/10">
          Gerenciar leads
        </Link>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </article>
  );
}
