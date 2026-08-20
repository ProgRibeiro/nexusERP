export default function DemonstracaoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-black">Solicitar demonstração</h1>
      <p className="mt-4 text-sm leading-7 text-zinc-300">
        Preencha os dados abaixo para nossa equipe comercial entrar em contato e montar uma apresentação focada no seu cenário.
      </p>
      <form className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="Nome completo" />
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="Empresa" />
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="E-mail corporativo" />
        <textarea className="min-h-28 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm outline-none focus:border-[#d4af37]" placeholder="Descreva seu contexto operacional" />
        <button type="button" className="rounded-xl bg-[#d4af37] px-5 py-3 text-xs font-black text-black hover:bg-[#e6c653]">
          Enviar solicitação
        </button>
      </form>
    </main>
  );
}
