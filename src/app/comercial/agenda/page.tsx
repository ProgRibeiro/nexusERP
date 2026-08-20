import { getCommercialAgendaAction } from "@/app/actions/commercialActions";

export default async function ComercialAgendaPage() {
  const result = await getCommercialAgendaAction();
  if (!result.success) {
    return (
      <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-black text-red-200">Erro ao carregar agenda comercial</h2>
        <p className="mt-2 text-sm text-red-100">{result.error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Agenda comercial e follow-ups</h2>
      <div className="space-y-3">
        {result.activities.length === 0 && (
          <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
            Nenhuma atividade registrada na janela atual.
          </article>
        )}
        {result.activities.map((activity) => (
          <article key={activity.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{activity.leadName}</h3>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${activity.done ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                {activity.done ? "Concluído" : "Pendente"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-300">{activity.type} · {activity.description}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {new Date(activity.date).toLocaleString("pt-BR")} · responsável: {activity.ownerName || "não definido"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
