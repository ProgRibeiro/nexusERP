export default function SolucoesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-16">
      <h1 className="text-3xl font-black">Soluções O Prestador</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
        Estruture a operação por processos com um SaaS preparado para crescimento comercial, técnico e financeiro.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">ERP Operacional</h2>
          <p className="mt-2 text-sm text-slate-500">Foco em produtividade da equipe de campo e gestão de serviço ponta a ponta.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Comercial interno</h2>
          <p className="mt-2 text-sm text-slate-500">Pipeline de prospecção, demonstração e fechamento para aquisição previsível.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Administração SaaS</h2>
          <p className="mt-2 text-sm text-slate-500">Governança de tenants, planos, segurança, auditoria e observabilidade.</p>
        </article>
      </div>
    </main>
  );
}
