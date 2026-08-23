import "dotenv/config";

let sessionCookie = "";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.headers = async () => new Headers({ host: "localhost:3000", "x-real-ip": "127.0.0.1", "user-agent": "NexusIdentityTest/1.0" });
nextHeaders.cookies = async () => ({
  get: (name: string) => name === "nx_session" && sessionCookie ? { name, value: sessionCookie } : undefined,
  set: (_name: string, value: string) => { sessionCookie = value; },
});

import { currentTenantContext, disconnectDatabase, enterTenantContext, prisma } from "../lib/db";
import { generateSalt, hashPassword } from "../lib/crypto";
import { loginAction } from "../app/actions/userActions";
import { confirmPasswordResetAction, requestPasswordResetAction } from "../app/actions/userActions";
import { requireAuth, requirePermission } from "../lib/auth";

async function main() {
  const suffix = Date.now();
  const email = `identity.${suffix}@oprestador.test`;
  const password = "Identidade@2026Segura";
  const defaultTenantId = process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
  const tenantId = "20000000-0000-4000-8000-000000000003";
  const permissionCode = `foundation.identity.${suffix}`;
  const role = await prisma.role.create({ data: { name: `Perfil Fundação ${suffix}`, description: "Perfil temporário de teste" } });
  const permission = await prisma.permission.create({ data: { code: permissionCode, name: "Permissão temporária" } });
  await prisma.tenant.upsert({ where: { id: tenantId }, update: { active: true }, create: { id: tenantId, name: "Tenant de identidade" } });
  enterTenantContext(tenantId);
  const salt = generateSalt();
  const user = await prisma.user.create({ data: { name: "Teste de Identidade", email, password: hashPassword(password, salt), salt, roleId: role.id, permissions: "[]" } });

  try {
    await prisma.userTenantAccess.create({ data: { userId: user.id, tenantId, isDefault: true, active: true } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id, tenantId } });

    const success = await loginAction(email, password);
    if (!success.success || !sessionCookie) throw new Error(`Login válido reprovado: ${success.error || "cookie ausente"}`);
    if (success.user?.tenantId !== tenantId || currentTenantContext() !== tenantId) throw new Error("Login não fixou o pool no tenant secundário.");
    await requirePermission(permissionCode);
    await prisma.rolePermission.delete({ where: { roleId_permissionId_tenantId: { roleId: role.id, permissionId: permission.id, tenantId } } });
    let permissionRevoked = false;
    try { await requirePermission(permissionCode); } catch { permissionRevoked = true; }
    if (!permissionRevoked) throw new Error("Revogação relacional de permissão não teve efeito imediato.");
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id, tenantId } });
    const oldSession = sessionCookie;

    const request = await requestPasswordResetAction(email);
    if (!request.developmentToken) throw new Error("Token de recuperação de teste não foi disponibilizado.");
    const newPassword = "Identidade@2026Nova";
    const reset = await confirmPasswordResetAction(request.developmentToken, newPassword);
    if (!reset.success) throw new Error(`Redefinição reprovada: ${reset.error}`);
    const reuse = await confirmPasswordResetAction(request.developmentToken, newPassword);
    if (reuse.success) throw new Error("Token de recuperação foi reutilizado.");
    sessionCookie = oldSession;
    let revoked = false;
    try { await requireAuth(); } catch { revoked = true; }
    if (!revoked) throw new Error("Sessão anterior não foi revogada após troca de senha.");
    sessionCookie = "";
    const relogin = await loginAction(email, newPassword);
    if (!relogin.success) throw new Error(`Login com nova senha reprovado: ${relogin.error}`);

    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    sessionCookie = "";
    const inactive = await loginAction(email, password);
    if (inactive.success || sessionCookie) throw new Error("Usuário inativo conseguiu autenticar.");

    const history = await prisma.loginHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (history.length !== 3 || !history[0].success || !history[1].success || history[2].success || history[2].reason !== "USUARIO_INATIVO") {
      throw new Error(`Histórico de login divergente: ${JSON.stringify(history)}`);
    }

    console.log("IDENTITY_FOUNDATION_OK", { secondaryTenantLogin: true, relationalRbac: true, immediatePermissionRevocation: true, passwordReset: true, tokenSingleUse: true, oldSessionRevoked: true, inactiveBlocked: true, historyEntries: history.length });
  } finally {
    await prisma.loginHistory.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, tenantId } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userTenantAccess.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.securityThrottle.deleteMany({});
    enterTenantContext(defaultTenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.permission.delete({ where: { id: permission.id } });
    await disconnectDatabase();
  }
}

main().catch((error) => { console.error("IDENTITY_FOUNDATION_FAILED", error); process.exitCode = 1; });
