import assert from "node:assert/strict";
import { prisma } from "../lib/db";

async function main() {
  const before = await prisma.supplier.count();
  const suffix = `${Date.now()}`.slice(-10);
  const document = `99${suffix}00`.slice(0, 14);
  let id = "";

  try {
    const created = await prisma.supplier.create({
      data: { name: "Teste de persistência", cnpj: document, phone: "11999990000", email: `provider-${suffix}@test.local`, notes: "Registro temporário do teste automatizado" },
    });
    id = created.id;
    const persisted = await prisma.supplier.findUnique({ where: { id } });
    assert.ok(persisted, "O registro não foi encontrado após a criação");
    assert.equal(persisted.cnpj, document);

    await prisma.supplier.update({ where: { id }, data: { notes: "Atualização confirmada" } });
    const updated = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    assert.equal(updated.notes, "Atualização confirmada");

    console.log("OK: criação, leitura e atualização de prestador confirmadas no PostgreSQL.");
  } finally {
    if (id) await prisma.supplier.delete({ where: { id } }).catch(() => undefined);
    const after = await prisma.supplier.count();
    assert.equal(after, before, "O teste não restaurou a quantidade original de registros");
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
