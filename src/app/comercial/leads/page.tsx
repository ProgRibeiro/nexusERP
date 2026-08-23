import { createCommercialLeadAction, getCommercialLeadsAction } from "@/app/actions/commercialActions";

export default async function ComercialLeadsPage() {
  const result = await getCommercialLeadsAction();
  if (!result.success) {
    return (
      <section className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-black text-red-200">Erro ao carregar leads</h2>
        <p className="mt-2 text-sm text-red-100">{result.error}</p>
      </section>
    );
  }

  async function submitLead(formData: FormData) {
    "use server";
    await createCommercialLeadAction({
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      company: String(formData.get("company") || ""),
      source: String(formData.get("source") || ""),
      value: Number(formData.get("value") || 0),
      notes: String(formData.get("notes") || ""),
      closePrediction: String(formData.get("closePrediction") || ""),
    });
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Novo lead comercial</h2>
        <form action={submitLead} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Nome do contato" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="phone" required placeholder="Telefone / WhatsApp" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="email" placeholder="Email" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="company" placeholder="Empresa" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="source" placeholder="Origem do lead" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="value" type="number" step="0.01" min="0" placeholder="Valor estimado" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="closePrediction" type="date" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
          <input name="notes" placeholder="Observações" className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm sm:col-span-2" />
          <button type="submit" className="rounded-lg bg-[#155eef] px-4 py-2 text-sm font-black text-black hover:bg-[#60a5fa] sm:col-span-2">
            Salvar lead
          </button>
        </form>
      </article>

      <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Próximo contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {result.leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{lead.name}</p>
                  <p className="text-xs text-zinc-400">{lead.company || "Sem empresa"} · {lead.phone}</p>
                </td>
                <td className="px-4 py-3 text-zinc-200">{lead.stageName}</td>
                <td className="px-4 py-3 text-zinc-300">{lead.ownerName || "Não definido"}</td>
                <td className="px-4 py-3 text-[#155eef]">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value)}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString("pt-BR") : "Sem follow-up"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
