export default function RecursosPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-16">
      <h1 className="text-3xl font-black">Recursos da Plataforma</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
        O Prestador integra CRM, orçamento, execução, financeiro, estoque, relatórios e NFS-e em uma experiência unificada de produtividade.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[
          "Gestão de clientes, contratos e ativos",
          "Orçamentos técnicos com rastreabilidade",
          "Ordens de serviço com execução em campo",
          "Contas a pagar, receber e indicadores",
          "Módulo fiscal e rotinas de conformidade",
          "Backups, auditoria e segurança de dados",
        ].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">
            {item}
          </div>
        ))}
      </div>
    </main>
  );
}
