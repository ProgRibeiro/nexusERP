import Link from "next/link";
import { requirePortalAccess } from "@/lib/auth";

const COMMERCIAL_NAV = [
  { href: "/comercial", label: "Dashboard" },
  { href: "/comercial/propostas", label: "Propostas" },
  { href: "/comercial/leads", label: "Leads" },
  { href: "/comercial/pipeline", label: "Pipeline" },
  { href: "/comercial/metas", label: "Metas" },
  { href: "/comercial/comissoes", label: "Comissões" },
  { href: "/comercial/agenda", label: "Agenda" },
  { href: "/comercial/relatorios", label: "Relatórios" },
];

export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  await requirePortalAccess("commercial");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#155eef]">Nexus Platform</p>
            <h1 className="text-lg font-black">Portal Comercial</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {COMMERCIAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:border-[#155eef]/50 hover:text-[#f3d56f]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
