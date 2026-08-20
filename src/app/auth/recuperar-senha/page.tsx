import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4af37]">Recuperação de acesso</p>
        <h1 className="mt-3 text-3xl font-black">Recuperar senha</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Informe o e-mail cadastrado para receber instruções de redefinição de senha.
        </p>
        <form className="mt-6 space-y-3">
          <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="E-mail da conta" />
          <button type="button" className="mt-2 rounded-xl bg-[#d4af37] px-5 py-3 text-xs font-black text-black hover:bg-[#e6c653]">
            Enviar instruções
          </button>
        </form>
        <p className="mt-6 text-xs text-zinc-500">
          Lembrou a senha?{" "}
          <Link href="/login" className="font-bold text-[#d4af37] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}
