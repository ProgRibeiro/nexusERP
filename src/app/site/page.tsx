import Link from "next/link";

const features = [
  "Dashboard operacional em tempo real",
  "Orçamentos, OS e execução em campo",
  "Financeiro, faturamento e NFS-e",
  "Estoque, contratos e relatórios",
];

const segments = ["Climatização", "Facilities", "Elétrica", "Refrigeração", "Manutenção predial", "Serviços técnicos"];

export default function MarketingHomePage() {
  return (
    <main>
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,.15),transparent_32rem)]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Plataforma Nexus ERP</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-5xl">
              Transforme sua operação em uma <span className="text-[#d4af37]">empresa SaaS eficiente</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300">
              Site público, aquisição de clientes, ERP por tenant, CRM comercial interno e administração técnica em um único ecossistema.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/recursos" className="rounded-xl bg-[#d4af37] px-5 py-3 text-xs font-black text-black hover:bg-[#e6c653]">
                Conhecer o sistema
              </Link>
              <Link href="/login" className="rounded-xl border border-white/20 px-5 py-3 text-xs font-bold text-zinc-100 hover:bg-white/10">
                Entrar
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37]">Demonstração visual</p>
            <div className="mt-4 grid gap-3">
              {features.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs font-semibold text-zinc-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-16">
        <h2 className="text-2xl font-black">Segmentos atendidos</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <div key={segment} className="rounded-2xl border border-white/10 bg-white/[.03] px-4 py-4 text-sm font-semibold text-zinc-200">
              {segment}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Próximo passo</p>
            <h3 className="mt-2 text-2xl font-black">Agende uma demonstração guiada do Nexus</h3>
          </div>
          <Link href="/demonstracao" className="rounded-xl bg-[#d4af37] px-5 py-3 text-xs font-black text-black hover:bg-[#e6c653]">
            Solicitar demonstração
          </Link>
        </div>
      </section>
    </main>
  );
}
