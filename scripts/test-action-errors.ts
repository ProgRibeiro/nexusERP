import assert from "node:assert/strict";

import { ActionError, failDataAccess, mutationFailure } from "../src/lib/actionErrors";

let captured: unknown;

try {
  failDataAccess("test.intentional-failure", new Error("database secret must stay on the server"));
} catch (error) {
  captured = error;
}

assert(captured instanceof ActionError, "A falha deve produzir um ActionError tipado.");
assert.equal(captured.code, "DATA_ACCESS_ERROR");
assert.match(captured.reference, /^[0-9a-f]{8}$/i);
assert.match(captured.message, new RegExp(captured.reference));
assert.equal(captured.message.includes("database secret"), false, "O detalhe técnico não pode chegar ao cliente.");

console.log("ACTION_ERROR_CONTRACT_OK", {
  code: captured.code,
  referenceIncluded: true,
  technicalDetailRedacted: true,
});

assert.equal(mutationFailure("test.auth", { code: "NAO_AUTENTICADO" }, "Falha").code, "AUTH_REQUIRED");
assert.equal(mutationFailure("test.permission", { code: "SEM_PERMISSAO" }, "Falha").code, "PERMISSION_DENIED");
assert.equal(mutationFailure("test.validation", { issues: [{ message: "Campo obrigatório." }] }, "Falha").code, "VALIDATION_ERROR");
assert.equal(mutationFailure("test.unique", { code: "P2002" }, "Falha").code, "CONFLICT");
assert.equal(mutationFailure("test.foreign-key", { code: "P2003" }, "Falha").code, "CONFLICT");
assert.equal(mutationFailure("test.not-found", { code: "P2025" }, "Falha").code, "NOT_FOUND");

const unavailable = mutationFailure("test.unavailable", { code: "P1001", message: "host=db.internal" }, "Falha");
assert.equal(unavailable.code, "DATABASE_UNAVAILABLE");
assert.equal(unavailable.error.includes("db.internal"), false);
assert.match(unavailable.reference || "", /^[0-9a-f]{8}$/i);

const persistence = mutationFailure("test.persistence", { code: "P2028", message: "transaction secret" }, "Não foi possível salvar.");
assert.equal(persistence.code, "INTERNAL_ERROR");
assert.equal(persistence.error.includes("transaction secret"), false);

console.log("MUTATION_ERROR_CONTRACT_OK", {
  auth: true,
  permission: true,
  validation: true,
  conflict: true,
  notFound: true,
  databaseUnavailable: true,
  persistenceRedacted: true,
});
