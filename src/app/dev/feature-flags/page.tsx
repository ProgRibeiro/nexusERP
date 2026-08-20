import { getDevFeatureFlagsAction, saveDevFeatureFlagsAction } from "@/app/actions/platformConfigActions";

export default async function DevFeatureFlagsPage() {
  const flags = await getDevFeatureFlagsAction();

  async function saveFlags(formData: FormData) {
    "use server";
    const current = await getDevFeatureFlagsAction();
    const next = current.map((item) => ({
      ...item,
      enabled: formData.get(item.code) === "on",
    }));
    await saveDevFeatureFlagsAction(next);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Feature Flags</h1>
          <a href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </a>
        </header>
        <form action={saveFlags} className="grid gap-4 lg:grid-cols-2">
          {flags.map((flag) => (
            <label key={flag.code} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{flag.name}</p>
                  <p className="text-xs text-zinc-400">{flag.category} · {flag.code}</p>
                </div>
                <input name={flag.code} type="checkbox" defaultChecked={flag.enabled} className="h-4 w-4" />
              </div>
            </label>
          ))}
          <button className="rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-black lg:col-span-2">Salvar feature flags</button>
        </form>
      </div>
    </main>
  );
}
