import "dotenv/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextCache = require("next/cache");
nextCache.revalidatePath = () => {};
nextCache.revalidateTag = () => {};

let mockSessionToken: string | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextHeaders = require("next/headers");
nextHeaders.cookies = async () => ({
  get: (name: string) => name === "nx_session" && mockSessionToken ? { name, value: mockSessionToken } : undefined,
  set: () => {},
  delete: () => {},
});

async function main() {
  const { prisma } = await import("../lib/db");
  const { encryptSession } = await import("../lib/session");
  const { createManualServiceOrder } = await import("../app/actions/osActions");
  const { getServiceOrderAssetWorkspace, saveServiceOrderAssets } = await import("../app/actions/serviceOrderAssetActions");

  const admin = await prisma.user.findUnique({ where: { email: "admin@erp.com" }, include: { role: true } });
  const clients = await prisma.client.findMany({ include: { addresses: true, equipments: true } });
  const client = clients.find((item) => item.addresses.length > 0);
  if (!admin || !client) throw new Error("O teste precisa de administrador e cliente com endereço.");
  const temporaryEquipmentIds: string[] = [];
  while (client.equipments.length < 2) {
    const equipment = await prisma.clientEquipment.create({ data: { clientId: client.id, type: `Equipamento QA ${Date.now()}-${client.equipments.length + 1}`, brand: "Teste", model: "Automatizado", serialNumber: `QA-${Date.now()}-${client.equipments.length + 1}` } });
    client.equipments.push(equipment);
    temporaryEquipmentIds.push(equipment.id);
  }

  mockSessionToken = await encryptSession({
    userId: admin.id,
    name: admin.name,
    email: admin.email,
    roleName: admin.role?.name || "Administrador",
    permissions: JSON.parse(admin.permissions),
    exp: Date.now() + 60 * 60 * 1000,
  });

  const created = await createManualServiceOrder({
    clientId: client.id,
    addressId: client.addresses[0].id,
    type: "CORRETIVA",
    priority: "ALTA",
    problemReported: "Teste de atendimento envolvendo vários equipamentos.",
  });
  if (!created.success || !created.os) throw new Error(created.error || "Falha ao criar OS de teste.");
  const osId = created.os.id;

  try {
    const workspace = await getServiceOrderAssetWorkspace(osId);
    if (!workspace.success) throw new Error(workspace.error);
    const candidates = workspace.candidates.filter((item) => item.kind === "CLIENT_EQUIPMENT").slice(0, 2);
    if (candidates.length !== 2) throw new Error("Os dois equipamentos do cliente não apareceram no seletor.");

    const saved = await saveServiceOrderAssets(osId, candidates.map((candidate, index) => ({
      kind: candidate.kind,
      assetId: candidate.assetId,
      isPrimary: index === 1,
      problem: index === 0 ? "Ruído anormal" : "Baixo rendimento",
    })));
    if (!saved.success) throw new Error(saved.error);

    const links = await prisma.serviceOrderAsset.findMany({ where: { serviceOrderId: osId }, orderBy: { isPrimary: "asc" } });
    if (links.length !== 2 || links.filter((link) => link.isPrimary).length !== 1) {
      throw new Error("O vínculo múltiplo ou a definição do ativo principal falhou.");
    }
    if (!links.every((link) => link.problem?.trim())) throw new Error("O problema individual dos ativos não foi salvo.");
    console.log("MULTI_ASSET_WORKFLOW_OK", { assets: links.length, primary: links.find((link) => link.isPrimary)?.clientEquipmentId });
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity: "OrdemServico", entityId: osId } });
    await prisma.serviceOrder.delete({ where: { id: osId } });
    if (temporaryEquipmentIds.length) await prisma.clientEquipment.deleteMany({ where: { id: { in: temporaryEquipmentIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
