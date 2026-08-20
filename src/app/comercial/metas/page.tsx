import { getCommercialGoalsAction, saveCommercialGoalsAction } from "@/app/actions/platformConfigActions";

export default async function ComercialMetasPage() {
  const goals = await getCommercialGoalsAction();

  async function saveGoal(formData: FormData) {
    "use server";
    const current = await getCommercialGoalsAction();
    const next = [...current];
    const id = String(formData.get("id") || "");
    const monthlyTarget = Number(formData.get("monthlyTarget") || 0);
    const achieved = Number(formData.get("achieved") || 0);
    const name = String(formData.get("name") || "");
    const owner = String(formData.get("owner") || "");
    const active = formData.get("active") === "on";
    const existing = next.find((item) => item.id === id);
    if (existing) {
      existing.name = name;
      existing.monthlyTarget = monthlyTarget;
      existing.achieved = achieved;
      existing.owner = owner;
      existing.active = active;
    } else {
      next.push({ id: id || `goal-${Date.now()}`, name, monthlyTarget, achieved, owner, active });
    }
    await saveCommercialGoalsAction(next);
  }

  return (
    <section className="space-y-5">
      <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Metas comerciais</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((goal) => (
          <form key={goal.id} action={saveGoal} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <input type="hidden" name="id" value={goal.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="name" defaultValue={goal.name} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              <input name="owner" defaultValue={goal.owner} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              <input name="monthlyTarget" type="number" defaultValue={goal.monthlyTarget} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              <input name="achieved" type="number" defaultValue={goal.achieved} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input name="active" type="checkbox" defaultChecked={goal.active} /> Ativa
            </label>
            <button className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-black">Salvar meta</button>
          </form>
        ))}
      </div>
    </section>
  );
}
