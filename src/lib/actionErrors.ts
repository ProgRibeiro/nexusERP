import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";

import { logger } from "@/lib/logger";

export type ActionErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DATA_ACCESS_ERROR";

export type MutationErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "NOT_FOUND"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type MutationFailure = {
  success: false;
  error: string;
  code: MutationErrorCode;
  reference?: string;
  client?: never;
  existingClient?: never;
  contact?: never;
  address?: never;
  equipment?: never;
  service?: never;
  quote?: never;
  os?: never;
  serviceOrder?: never;
  receivable?: never;
  payable?: never;
  report?: never;
  photo?: never;
  item?: never;
};

export class ActionError extends Error {
  readonly code: ActionErrorCode;
  readonly reference: string;

  constructor(code: ActionErrorCode, message: string, reference = randomUUID().slice(0, 8)) {
    super(message);
    this.name = "ActionError";
    this.code = code;
    this.reference = reference;
  }
}

/**
 * Falhas inesperadas de consulta nunca devem ser convertidas em lista vazia
 * ou registro inexistente. O detalhe técnico fica somente no log do servidor;
 * a interface recebe uma mensagem segura e uma referência para suporte.
 */
export function failDataAccess(operation: string, error: unknown): never {
  // Preserva exceções de controle do próprio Next.js (cookies, redirects,
  // notFound e renderização dinâmica). Convertê-las quebraria o build.
  unstable_rethrow(error);

  const reference = randomUUID().slice(0, 8);
  logger.error("Falha inesperada de acesso a dados", {
    operation,
    reference,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { value: String(error) },
  });

  throw new ActionError(
    "DATA_ACCESS_ERROR",
    `Não foi possível carregar os dados. Tente novamente. Referência: ${reference}.`,
    reference,
  );
}

export function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function validationMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("issues" in error) || !Array.isArray(error.issues)) return undefined;
  const messages = error.issues
    .map((issue) => issue && typeof issue === "object" && "message" in issue ? String(issue.message) : "")
    .filter(Boolean);
  return messages.length ? messages.join(" ") : undefined;
}

/** Converte erros esperados de mutação em um contrato serializável e seguro. */
export function mutationFailure(operation: string, error: unknown, fallback: string): MutationFailure {
  unstable_rethrow(error);

  const code = errorCode(error);
  if (code === "NAO_AUTENTICADO") {
    return { success: false, code: "AUTH_REQUIRED", error: "Sua sessão expirou. Faça login novamente." };
  }
  if (code === "SEM_PERMISSAO") {
    return { success: false, code: "PERMISSION_DENIED", error: "Você não tem permissão para executar esta ação." };
  }

  const invalid = validationMessage(error);
  if (invalid) return { success: false, code: "VALIDATION_ERROR", error: invalid };

  if (code === "P2002" || code === "P2003") {
    return { success: false, code: "CONFLICT", error: "Este registro já existe ou está vinculado a outros dados." };
  }
  if (code === "P2025") {
    return { success: false, code: "NOT_FOUND", error: "O registro solicitado não foi encontrado." };
  }
  if (code?.startsWith("P1")) {
    const reference = randomUUID().slice(0, 8);
    logger.error("Banco indisponível durante mutação", { operation, reference, code });
    return { success: false, code: "DATABASE_UNAVAILABLE", error: `Banco de dados temporariamente indisponível. Referência: ${reference}.`, reference };
  }
  if (code?.startsWith("P2")) {
    const reference = randomUUID().slice(0, 8);
    logger.error("Falha de persistência durante mutação", { operation, reference, code });
    return { success: false, code: "INTERNAL_ERROR", error: `${fallback} Referência: ${reference}.`, reference };
  }

  // Erros de regra de negócio são criados deliberadamente pelas actions.
  if (error instanceof Error && error.constructor === Error && error.message) {
    return { success: false, code: "VALIDATION_ERROR", error: error.message };
  }

  const reference = randomUUID().slice(0, 8);
  logger.error("Falha inesperada durante mutação", {
    operation,
    reference,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  });
  return { success: false, code: "INTERNAL_ERROR", error: `${fallback} Referência: ${reference}.`, reference };
}
