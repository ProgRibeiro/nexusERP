import { getPublicStorePortal } from "@/app/actions/storePortalActions";
import PublicStorePortal from "@/components/portal/PublicStorePortal";

export default async function StorePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicStorePortal(token);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-white">NX</div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">Portal indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Este link não existe, foi substituído ou está temporariamente desativado. Solicite o acesso atualizado ao responsável pelo contrato.</p>
        </section>
      </main>
    );
  }

  return <PublicStorePortal initialData={data} />;
}
