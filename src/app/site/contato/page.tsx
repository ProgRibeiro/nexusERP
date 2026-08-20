export default function ContatoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-black">Fale com o comercial</h1>
      <p className="mt-4 text-sm leading-7 text-zinc-300">
        Nosso time pode te ajudar com dúvidas sobre planos, implantação e migração para o Nexus.
      </p>
      <form className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="Nome" />
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="Telefone / WhatsApp" />
        <input className="h-11 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 text-sm outline-none focus:border-[#d4af37]" placeholder="E-mail" />
        <textarea className="min-h-28 w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm outline-none focus:border-[#d4af37]" placeholder="Mensagem" />
        <button type="button" className="rounded-xl bg-[#d4af37] px-5 py-3 text-xs font-black text-black hover:bg-[#e6c653]">
          Enviar contato
        </button>
      </form>
    </main>
  );
}
