import { getCommercialCommissionsAction, saveCommercialCommissionsAction } from "@/app/actions/platformConfigActions";

export default async function ComercialComissoesPage() {
  const commissions = await getCommercialCommissionsAction();

  async function saveCommission(formData: FormData) {
    "use server";
    const current = await getCommercialCommissionsAction();
    const next = [...current];
    const id = String(formData.get("id") || "");
    const rep = String(formData.get("rep") || "");
    const percentage = Number(formData.get("percentage") || 0);
    const baseGoal = Number(formData.get("baseGoal") || 0);
    const active = formData.get("active") === "on";
    const existing = next.find((item) => item.id === id);
    if (existing) {
      existing.rep = rep;
      existing.percentage = percentage;
      existing.baseGoal = baseGoal;
      existing.active = active;
    } else {
      next.push({ id: id || `comm-${Date.now()}`, rep, percentage, baseGoal, active });
    }
    await saveCommercialCommissionsAction(next);
  }

  return (
    <section className="space-y-5">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Comissões comerciais</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {commissions.map((commission) => (
          <form key={commission.id} action={saveCommission} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <input type="hidden" name="id" value={commission.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="rep" defaultValue={commission.rep} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              <input name="percentage" type="number" step="0.1" defaultValue={commission.percentage} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              <input name="baseGoal" type="number" defaultValue={commission.baseGoal} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm sm:col-span-2" />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input name="active" type="checkbox" defaultChecked={commission.active} /> Ativa
            </label>
            <button className="rounded-lg bg-[#155eef] px-4 py-2 text-xs font-black text-black">Salvar comissão</button>
          </form>
        ))}
      </div>
    </section>
  );
}
