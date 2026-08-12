import { redirect } from "next/navigation";
import { getProviderPortalDashboard } from "@/app/actions/providerPortalActions";
import { ProviderDashboard } from "@/components/provider-portal/ProviderDashboard";

export default async function ProviderDashboardPage(){const data=await getProviderPortalDashboard();if(!data)redirect("/portal/prestador/login");return <ProviderDashboard data={data}/>}
