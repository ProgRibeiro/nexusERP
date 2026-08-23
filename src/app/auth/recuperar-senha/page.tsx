import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";

export default async function RecuperarSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <PasswordRecoveryForm token={params.token || ""} />;
}
