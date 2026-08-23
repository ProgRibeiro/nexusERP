export default function DemonstracaoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-black">Solicitar demonstração</h1>
      <p className="mt-4 text-sm leading-7 text-slate-500">
        Preencha os dados abaixo para nossa equipe comercial entrar em contato e montar uma apresentação focada no seu cenário.
      </p>
      <form className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Nome completo" />
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="Empresa" />
        <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-[#155eef]" placeholder="E-mail corporativo" />
        <textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#155eef]" placeholder="Descreva seu contexto operacional" />
        <button type="button" className="rounded-xl bg-[#155eef] px-5 py-3 text-xs font-black text-white hover:bg-[#1d4ed8]">
          Enviar solicitação
        </button>
      </form>
    </main>
  );
}
