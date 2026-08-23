import "dotenv/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};
let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({ get: (name: string) => name === "nx_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined, set: () => {}, delete: () => {} });
nextHeaders.headers = async () => new Headers({ host: "localhost:3000" });

import { disconnectDatabase, prisma } from "../lib/db";
import { encryptSession, SessionPayload } from "../lib/session";
import { createUserAction } from "../app/actions/userActions";
import { createService } from "../app/actions/serviceActions";
import { importClientsAction, previewImportAction } from "../app/actions/importActions";

async function main() {
  const suffix = Date.now().toString();
  const admin = await prisma.user.findUnique({ where: { email: "admin@erp.com" }, include: { role: true, tenantAccesses: { where: { active: true }, take: 1 } } });
  if (!admin) throw new Error("Administrador de teste não encontrado.");
  const tenantId = admin.tenantAccesses[0]?.tenantId || process.env.TENANT_ID || "00000000-0000-4000-8000-000000000001";
  const permissions = JSON.parse(admin.permissions) as string[];
  const payload: SessionPayload = { userId: admin.id, name: admin.name, email: admin.email, roleName: admin.role?.name || "Administrador", platformRole: "CUSTOMER_ADMIN", tenantId, permissions, exp: Date.now() + 3600000 };
  mockSessionToken = await encryptSession(payload);

  const created: { userId?: string; serviceId?: string; batchId?: string; clientIds: string[] } = { clientIds: [] };
  try {
    const role = await prisma.role.findFirst({ where: { name: { in: ["Operacional", "Técnico", "Administrador"] } } });
    if (!role) throw new Error("Nenhum perfil disponível para o teste de usuário.");
    const userResult = await createUserAction({ name: `Usuário QA ${suffix}`, email: `qa.${suffix}@oprestador.test`, roleName: role.name, password: "Teste@2026Seguro" });
    if (!userResult.success || !userResult.user) throw new Error(`Cadastro de usuário: ${userResult.error}`);
    created.userId = userResult.user.id;
    console.log("PASS usuário novo", userResult.user.email);

    const serviceResult = await createService({ name: `Serviço QA ${suffix}`, description: "Serviço criado por teste automatizado", defaultPrice: 250, materialCost: 50, laborCost: 100, profitPercentage: 25 });
    if (!serviceResult.success || !serviceResult.service) throw new Error(`Cadastro de serviço: ${serviceResult.error}`);
    created.serviceId = serviceResult.service.id;
    console.log("PASS serviço novo", serviceResult.service.name);

    const rows = [1, 2, 3].map((index) => ({ name: `Cliente Lote QA ${suffix}-${index}`, cpfCnpj: `${suffix}${index}`.padStart(14, "0").slice(-14), email: `lote.${suffix}.${index}@oprestador.test`, phone: "11999999999", notes: "Teste automatizado de importação" }));
    const preview = await previewImportAction("clientes", rows);
    if (!preview.success || preview.preview.valid !== 3 || preview.preview.errors !== 0) throw new Error("Pré-validação do lote falhou.");
    const importResult = await importClientsAction(rows);
    if (!importResult.success) throw new Error(`Importação em lote: ${importResult.error}`);
    if (importResult.summary.created !== 3 || importResult.summary.errors !== 0) throw new Error("Importação em lote: resumo divergente");
    created.batchId = importResult.batchId;
    const imported = await prisma.client.findMany({ where: { email: { in: rows.map((row) => row.email) } }, select: { id: true } });
    if (imported.length !== 3) throw new Error("Clientes do lote não foram persistidos.");
    created.clientIds = imported.map((item) => item.id);
    console.log("PASS clientes em lote", importResult.summary);
    console.log("RESULTADO 3/3 testes complementares aprovados");
  } finally {
    if (created.batchId) { await prisma.importRow.deleteMany({ where: { batchId: created.batchId } }); await prisma.importBatch.deleteMany({ where: { id: created.batchId } }); }
    if (created.clientIds.length) await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
    if (created.serviceId) await prisma.service.deleteMany({ where: { id: created.serviceId } });
    if (created.userId) { await prisma.auditLog.deleteMany({ where: { entity: "Usuario", entityId: created.userId } }); await prisma.userTenantAccess.deleteMany({ where: { userId: created.userId } }); await prisma.user.deleteMany({ where: { id: created.userId } }); }
    await disconnectDatabase();
  }
}

main().catch((error) => { console.error("FALHA", error); process.exitCode = 1; });
