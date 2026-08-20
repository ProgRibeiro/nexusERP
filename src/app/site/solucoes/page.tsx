export default function SolucoesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-16">
      <h1 className="text-3xl font-black">Soluções Nexus</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
        Estruture a operação por processos com um SaaS preparado para crescimento comercial, técnico e financeiro.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <h2 className="text-lg font-bold">ERP Operacional</h2>
          <p className="mt-2 text-sm text-zinc-400">Foco em produtividade da equipe de campo e gestão de serviço ponta a ponta.</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <h2 className="text-lg font-bold">Comercial interno</h2>
          <p className="mt-2 text-sm text-zinc-400">Pipeline de prospecção, demonstração e fechamento para aquisição previsível.</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <h2 className="text-lg font-bold">Administração SaaS</h2>
          <p className="mt-2 text-sm text-zinc-400">Governança de tenants, planos, segurança, auditoria e observabilidade.</p>
        </article>
      </div>
    </main>
  );
}
