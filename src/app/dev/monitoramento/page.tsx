import Link from "next/link";
import { getDevSystemHealthAction } from "@/app/actions/devActions";

export default async function DevMonitoringPage() {
  const result = await getDevSystemHealthAction();
  if (!result.success) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-red-400/30 bg-red-500/10 p-5">
          <h1 className="text-lg font-black text-red-200">Falha no monitoramento</h1>
          <p className="mt-2 text-sm text-red-100">{result.error}</p>
        </div>
      </main>
    );
  }

  const { health } = result;
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Monitoramento</h1>
          <Link href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </Link>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Status" value={health.status} />
          <Metric label="Latência DB" value={`${health.dbLatencyMs}ms`} />
          <Metric label="Erros abertos" value={String(health.openErrorsCount)} />
          <Metric label="Backups" value={String(health.backupCount)} />
          <Metric label="Ambiente" value={health.environment.toUpperCase()} />
          <Metric label="Node" value={health.nodeVersion} />
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </article>
  );
}
