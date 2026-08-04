import { notFound } from "next/navigation";
import { getStoreTechnicalDossier } from "@/app/actions/technicalReportActions";
import StoreTechnicalReport from "@/components/reports/StoreTechnicalReport";

export default async function StoreTechnicalReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ disciplina?: string }>;
}) {
  const [{ contractId }, query] = await Promise.all([params, searchParams]);
  const dossier = await getStoreTechnicalDossier(contractId);
  if (!dossier) notFound();

  return <StoreTechnicalReport dossier={dossier} discipline={query.disciplina || ""} />;
}
