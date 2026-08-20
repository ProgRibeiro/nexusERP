import "dotenv/config";
import crypto from "crypto";
import { prisma } from "../src/lib/db";
import { bindUserToTenant } from "../src/lib/tenantAccess";

const permissionData = [
  ["dashboard.view", "Visualizar Dashboard"],
  ["crm.read", "Visualizar Leads/Funil"],
  ["crm.write", "Criar/Editar Leads"],
  ["clients.read", "Visualizar Clientes"],
  ["clients.write", "Criar/Editar Clientes"],
  ["quotes.read", "Visualizar Orçamentos"],
  ["quotes.write", "Criar/Editar Orçamentos"],
  ["quotes.approve", "Aprovar Orçamentos"],
  ["os.read", "Visualizar Ordens de Serviço"],
  ["os.write", "Criar/Editar OS"],
  ["os.execute", "Executar OS"],
  ["faturamento.read", "Visualizar Faturamento"],
  ["faturamento.write", "Faturar e registrar NF"],
  ["financeiro.read", "Visualizar Financeiro e DRE"],
  ["financeiro.write", "Movimentar Financeiro"],
  ["estoque.read", "Visualizar Estoque"],
  ["estoque.write", "Movimentar Estoque"],
  ["contratos.read", "Visualizar Contratos"],
  ["contratos.write", "Criar/Editar Contratos"],
  ["admin.all", "Acesso administrativo completo"],
] as const;

function securePassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return { salt, hash };
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@erp.local").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || "Administrador").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const resetPassword = process.env.RESET_ADMIN_PASSWORD === "true";

  if (!email.includes("@")) throw new Error("ADMIN_EMAIL inválido.");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");

  for (const [code, permissionName] of permissionData) {
    await prisma.permission.upsert({
      where: { code },
      update: { name: permissionName },
      create: { code, name: permissionName },
    });
  }

  const role = await prisma.role.upsert({
    where: { name: "Administrador" },
    update: { description: "Acesso total ao sistema" },
    create: { name: "Administrador", description: "Acesso total ao sistema" },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !resetPassword) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { roleId: role.id, permissions: JSON.stringify(["admin.all"]) },
    });
    await bindUserToTenant(existing.id);
    console.log(JSON.stringify({ success: true, created: false, email, passwordChanged: false }));
    return;
  }

  const { salt, hash } = securePassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, password: hash, salt, roleId: role.id, permissions: JSON.stringify(["admin.all"]) },
    create: { name, email, password: hash, salt, roleId: role.id, permissions: JSON.stringify(["admin.all"]) },
  });
  await bindUserToTenant(admin.id);
  console.log(JSON.stringify({ success: true, created: !existing, email, passwordChanged: Boolean(existing) }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
