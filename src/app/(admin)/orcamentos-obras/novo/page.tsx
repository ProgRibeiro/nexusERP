import { createConstructionBudgetAndOpen } from "@/app/actions/constructionBudgetActions";

export default function NewQuotePage() {
  const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900";
  return <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:p-8">
    <div className="mx-auto max-w-6xl">
      <a href="/orcamentos" className="text-sm font-semibold text-blue-600">← Voltar aos orçamentos</a>
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">Orçamento técnico de obra</p>
          <h1 className="mt-2 text-3xl font-black">Novo orçamento</h1>
          <p className="mt-1 text-sm text-zinc-500">Cadastre a obra e depois monte quantitativos, BDI, Curva ABC e cronograma.</p>
        </header>
        <form action={createConstructionBudgetAndOpen} className="space-y-7 p-6">
          <section><h2 className="mb-4 font-black">1. Identificação da obra</h2><div className="grid gap-3 md:grid-cols-2"><input className={field} name="workName" required placeholder="Nome da obra *"/><input className={field} name="clientId" placeholder="Cliente / contratante"/><input className={field} name="contractorName" placeholder="Empresa executora"/><input className={field} name="technicalLead" placeholder="Responsável técnico / CREA / CAU"/><input className={`${field} md:col-span-2`} name="address" placeholder="Endereço completo da obra"/></div></section>
          <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20"><label className="flex items-center gap-3 font-black"><input type="checkbox" name="isPublic" className="size-4"/> Obra pública / cotação de licitação</label><div className="mt-4 grid gap-3 md:grid-cols-3"><input className={field} name="agency" placeholder="Órgão contratante"/><input className={field} name="modality" placeholder="Modalidade"/><input className={field} name="procurementNumber" placeholder="Nº edital / processo"/></div></section>
          <section><h2 className="mb-4 font-black">2. Bases referenciais habilitadas</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{["SINAPI", "SICRO", "SEINFRA", "OUTRA"].map((base) => <label key={base} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-sm font-bold dark:border-zinc-700"><input type="checkbox" defaultChecked readOnly/> {base}</label>)}</div></section>
          <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Após criar, o orçamento abrirá em página inteira com: Dados da obra → Quantitativos → BDI → Resumo → Curva ABC → Cronograma.</div>
          <div className="flex justify-end gap-3"><a href="/orcamentos" className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-bold dark:border-zinc-700">Cancelar</a><button className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20">Criar e montar orçamento</button></div>
        </form>
      </div>
    </div>
  </main>;
}
