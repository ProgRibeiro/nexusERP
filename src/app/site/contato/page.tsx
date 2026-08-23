export default function ContatoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-black">Fale com o comercial</h1>
      <p className="mt-4 text-sm leading-7 text-slate-500">
        Nosso time pode ajudar com dúvidas sobre planos, implantação e migração para O Prestador.
      </p>
      <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Nome" />
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Telefone / WhatsApp" />
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="E-mail" />
        <textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#155eef]" placeholder="Mensagem" />
        <button type="button" className="rounded-xl bg-[#155eef] px-5 py-3 text-xs font-black text-white hover:bg-[#1d4ed8]">
          Enviar contato
        </button>
      </form>
    </main>
  );
}
