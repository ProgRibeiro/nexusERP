import Link from "next/link";

export default function CadastroPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#155eef]">Cadastro SaaS</p>
        <h1 className="mt-3 text-3xl font-black">Criar conta da empresa</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Este formulário inicia seu onboarding. A ativação final da empresa segue o fluxo de validação da equipe O Prestador.
        </p>
        <form className="mt-6 space-y-3">
          <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Razão social" />
          <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="CNPJ" />
          <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Nome do responsável" />
          <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="E-mail corporativo" />
          <button type="button" className="mt-2 rounded-xl bg-[#155eef] px-5 py-3 text-xs font-black text-black hover:bg-[#60a5fa]">
            Solicitar ativação
          </button>
        </form>
        <p className="mt-6 text-xs text-zinc-500">
          Já possui conta?{" "}
          <Link href="/login" className="font-bold text-[#155eef] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
