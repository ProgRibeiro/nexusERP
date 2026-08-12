import Image from "next/image";
import Link from "next/link";

export function ProviderHeader({ compact = false }: { compact?: boolean }) {
  return <header className="border-b border-white/10 bg-[#08090b]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Link href="/portal/prestador" className="flex items-center gap-3"><Image src="/icons/icon-192.png" alt="Nexus" width={42} height={42} className="rounded-xl"/><div><p className="text-sm font-black tracking-[.18em]">NEXUS</p><p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#d4af37]">Portal do prestador</p></div></Link>
      {!compact && <nav className="flex items-center gap-2"><Link href="/portal/prestador/login" className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white">Entrar</Link><Link href="/portal/prestador/cadastro" className="rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-black text-black transition hover:bg-[#ebc94a]">Criar acesso</Link></nav>}
    </div>
  </header>;
}
