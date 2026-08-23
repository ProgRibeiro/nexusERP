import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { PrestadorBrand } from "@/components/brand/PrestadorBrand";

export const metadata: Metadata = { title: "O Prestador · ERP para empresas de serviços", description: "Organize clientes, vendas, ordens de serviço, equipe e financeiro em uma única plataforma." };

const menu = [{ href: "/#recursos", label: "Recursos" }, { href: "/solucoes", label: "Soluções" }, { href: "/planos", label: "Planos" }, { href: "/historia", label: "Nossa história" }, { href: "/treinamentos", label: "Treinamentos" }, { href: "/contato", label: "Contato" }];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f8fafc] font-sans text-[#0b1f33]">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5">
      <Link href="/" aria-label="Página inicial"><PrestadorBrand /></Link>
      <nav className="hidden items-center gap-7 text-[12px] font-bold text-slate-600 lg:flex">{menu.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-[#155eef]">{item.label}</Link>)}</nav>
      <div className="relative flex items-center gap-2"><Link href="/login" className="rounded-xl px-4 py-2.5 text-[12px] font-black transition hover:bg-slate-100">Entrar</Link><Link href="/demonstracao" className="hidden items-center gap-2 rounded-xl bg-[#155eef] px-4 py-2.5 text-[12px] font-black text-white shadow-[0_10px_25px_rgba(37,99,235,.22)] hover:bg-[#1d4ed8] sm:inline-flex">Ver demonstração <ArrowRight size={14} /></Link><details className="group lg:hidden"><summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-slate-200" aria-label="Abrir menu"><Menu size={18} /></summary><nav className="absolute right-0 top-12 grid min-w-52 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">{menu.map((item) => <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600">{item.label}</Link>)}</nav></details></div>
    </div></header>
    {children}
    <footer className="bg-[#0b1f33] text-white"><div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><PrestadorBrand light /><p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">Gestão que conecta vendas, operação e resultados para empresas prestadoras de serviços.</p></div><div><p className="text-xs font-black uppercase tracking-wider text-blue-300">Plataforma</p><div className="mt-4 grid gap-3 text-sm text-slate-400"><Link href="/recursos">Recursos</Link><Link href="/solucoes">Soluções</Link><Link href="/planos">Planos</Link></div></div><div><p className="text-xs font-black uppercase tracking-wider text-blue-300">Conteúdo</p><div className="mt-4 grid gap-3 text-sm text-slate-400"><Link href="/historia">Nossa história</Link><Link href="/treinamentos">Treinamentos</Link><Link href="/contato">Contato</Link></div></div><div><p className="text-xs font-black uppercase tracking-wider text-blue-300">Comece agora</p><div className="mt-4 grid gap-3 text-sm text-slate-400"><Link href="/login">Entrar no ERP</Link><Link href="/demonstracao">Solicitar demonstração</Link><Link href="/cadastro">Criar conta</Link></div></div></div><div className="border-t border-white/10 px-5 py-5 text-center text-[11px] text-slate-500">© 2026 O Prestador · oprestador.tech</div></footer>
  </div>;
}
