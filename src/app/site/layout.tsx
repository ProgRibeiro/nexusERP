import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nexus · Plataforma SaaS",
  description: "Nexus ERP: plataforma SaaS para operação, financeiro, serviços e gestão integrada.",
};

const menu = [
  { href: "/", label: "Home" },
  { href: "/recursos", label: "Recursos" },
  { href: "/solucoes", label: "Soluções" },
  { href: "/planos", label: "Planos" },
  { href: "/demonstracao", label: "Demonstração" },
  { href: "/contato", label: "Contato" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-sm font-black tracking-wide text-[#d4af37]">NEXUS</Link>
          <nav className="hidden items-center gap-5 text-xs font-semibold text-zinc-300 md:flex">
            {menu.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10">
              Entrar
            </Link>
            <Link href="/cadastro" className="rounded-lg bg-[#d4af37] px-3 py-2 text-xs font-black text-black hover:bg-[#e6c653]">
              Começar
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-8 text-[11px] text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Nexus · Plataforma SaaS</p>
          <div className="flex gap-3">
            <Link href="/contato" className="hover:text-zinc-300">Contato</Link>
            <Link href="/demonstracao" className="hover:text-zinc-300">Solicitar demonstração</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
