import Link from "next/link";
import { getDevLicensingAction } from "@/app/actions/devActions";

export default async function DevTenantsPage() {
  const result = await getDevLicensingAction();
  if (!result.success) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
        <div className="mx-auto w-full max-w-6xl rounded-xl border border-red-400/30 bg-red-500/10 p-5">
          <h1 className="text-lg font-black text-red-200">Falha ao carregar tenants</h1>
          <p className="mt-2 text-sm text-red-100">{result.error}</p>
          <Link href="/dev" className="mt-4 inline-block rounded-lg border border-red-200/40 px-3 py-1.5 text-xs font-bold">
            Voltar ao console
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-black">Portal Dev · Tenants e Licenciamento</h1>
          <Link href="/dev" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
            Console principal
          </Link>
        </header>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Usuários</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expiração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {result.tenants.map((tenant: { id: string; companyName: string; cnpj: string; plan: string; maxUsers: number; status: string; expiresAt: string }) => (
                <tr key={tenant.id}>
                  <td className="px-4 py-3 font-semibold text-white">{tenant.companyName}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{tenant.cnpj}</td>
                  <td className="px-4 py-3 text-zinc-200">{tenant.plan}</td>
                  <td className="px-4 py-3 text-zinc-200">{tenant.maxUsers}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${tenant.status === "ATIVO" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-200"}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{tenant.expiresAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
