import Link from "next/link";
import { requirePortalAccess, AuthError } from "@/lib/auth";

export default async function ComercialHomePage() {
  let authorized = false;
  let authMessage = "Acesso restrito ao portal comercial.";
  try {
    await requirePortalAccess("commercial");
    authorized = true;
  } catch (error) {
    if (error instanceof AuthError) {
      authMessage = error.message;
    } else {
      throw error;
    }
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-black text-red-200">Acesso restrito</h1>
          <p className="mt-3 text-sm text-red-100">{authMessage}</p>
          <Link href="/login" className="mt-5 inline-block rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-black hover:bg-[#e6c653]">
            Ir para login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4af37]">Portal Comercial Nexus</p>
        <h1 className="mt-4 text-4xl font-black">Central de aquisição de clientes</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
          Estrutura inicial do portal comercial ativa. Na próxima etapa, esta área será evoluída para CRM interno completo com funil, oportunidades, propostas e follow-up.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-sm font-semibold text-zinc-200">
            A área comercial já está separada por hostname e preparada para expansão por módulos.
          </p>
          <Link href="/login" className="mt-4 inline-block rounded-lg border border-[#d4af37]/40 px-4 py-2 text-xs font-black text-[#d4af37] hover:bg-[#d4af37]/10">
            Trocar de conta
          </Link>
        </div>
      </div>
    </main>
  );
}
