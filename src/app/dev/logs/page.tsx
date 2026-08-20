import Link from "next/link";
import { getDevLogsAndErrorsAction } from "@/app/actions/devActions";

export default async function DevLogsPage() {
  const result = await getDevLogsAndErrorsAction();
  if (!result.success) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto w-full max-w-5xl rounded-xl border border-red-400/30 bg-red-500/10 p-5">
          <h1 className="text-lg font-black text-red-200">Falha ao carregar logs</h1>
          <p className="mt-2 text-sm text-red-100">{result.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Logs e Auditoria</h1>
          <Link href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </Link>
        </header>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Auditoria</h2>
            <div className="mt-3 space-y-2 text-xs">
              {result.auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="font-semibold text-white">{log.action} · {log.entity}</p>
                  <p className="text-zinc-400">{new Date(log.timestamp).toLocaleString("pt-BR")}</p>
                  <p className="text-zinc-500">{log.user?.email || "Sem usuário"}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Erros reportados</h2>
            <div className="mt-3 space-y-2 text-xs">
              {result.errorReports.map((errorReport) => (
                <div key={errorReport.id} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="font-semibold text-white">{errorReport.description.slice(0, 90) || "Erro sem descrição"}</p>
                  <p className="text-zinc-400">{new Date(errorReport.createdAt).toLocaleString("pt-BR")}</p>
                  <p className="text-amber-300">{errorReport.status}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
