import { getDevSubscriptionsAction, saveDevSubscriptionsAction } from "@/app/actions/platformConfigActions";

export default async function DevSubscriptionsPage() {
  const subscriptions = await getDevSubscriptionsAction();

  async function saveSubscription(formData: FormData) {
    "use server";
    const current = await getDevSubscriptionsAction();
    const next = [...current];
    const id = String(formData.get("id") || "");
    const tenantName = String(formData.get("tenantName") || "");
    const plan = String(formData.get("plan") || "");
    const startsAt = String(formData.get("startsAt") || "");
    const endsAt = String(formData.get("endsAt") || "");
    const status = String(formData.get("status") || "");
    const seats = Number(formData.get("seats") || 0);
    const existing = next.find((item) => item.id === id);
    if (existing) {
      existing.tenantName = tenantName;
      existing.plan = plan;
      existing.startsAt = startsAt;
      existing.endsAt = endsAt;
      existing.status = status;
      existing.seats = seats;
    } else {
      next.push({ id: id || `sub-${Date.now()}`, tenantName, plan, startsAt, endsAt, status, seats });
    }
    await saveDevSubscriptionsAction(next);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Assinaturas</h1>
          <a href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </a>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          {subscriptions.map((sub) => (
            <form key={sub.id} action={saveSubscription} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <input type="hidden" name="id" value={sub.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="tenantName" defaultValue={sub.tenantName} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
                <input name="plan" defaultValue={sub.plan} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
                <input name="startsAt" type="date" defaultValue={sub.startsAt} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
                <input name="endsAt" type="date" defaultValue={sub.endsAt} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
                <input name="status" defaultValue={sub.status} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
                <input name="seats" type="number" defaultValue={sub.seats} className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm" />
              </div>
              <button className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-black">Salvar assinatura</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
