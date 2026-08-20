import Link from "next/link";
import { requirePortalAccess } from "@/lib/auth";
import { listBackups } from "@/lib/backup";

export default async function DevBackupsPage() {
  await requirePortalAccess("developer");
  const backups = listBackups(30);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Backups</h1>
          <Link href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </Link>
        </header>
        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Remoto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {backups.map((backup) => (
                <tr key={backup.fileName}>
                  <td className="px-4 py-3 font-mono text-zinc-200">{backup.fileName}</td>
                  <td className="px-4 py-3 text-zinc-300">{backup.type}</td>
                  <td className="px-4 py-3 text-zinc-300">{new Date(backup.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-zinc-300">{Math.round(backup.sizeBytes / 1024 / 1024)} MB</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${backup.remoteUploaded ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {backup.remoteUploaded ? "Sincronizado" : "Local"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </main>
  );
}
