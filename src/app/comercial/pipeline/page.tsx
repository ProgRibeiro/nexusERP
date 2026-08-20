import { getCommercialPipelineAction } from "@/app/actions/commercialActions";

export default async function ComercialPipelinePage() {
  const result = await getCommercialPipelineAction();
  if (!result.success) {
    return (
      <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-black text-red-200">Erro ao carregar pipeline</h2>
        <p className="mt-2 text-sm text-red-100">{result.error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Funil comercial</h2>
      <div className="grid gap-4 lg:grid-cols-4">
        {result.pipeline.map((column) => (
          <article key={column.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{column.name}</h3>
              <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-zinc-300">
                {column.leads.length}
              </span>
            </div>
            <div className="space-y-3">
              {column.leads.length === 0 && <p className="text-xs text-zinc-500">Sem leads nesta etapa.</p>}
              {column.leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                  <p className="text-sm font-semibold text-white">{lead.name}</p>
                  <p className="text-xs text-zinc-400">{lead.company || "Sem empresa"}</p>
                  <p className="mt-2 text-xs text-[#d4af37]">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value)}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Próximo contato: {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString("pt-BR") : "não definido"}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
