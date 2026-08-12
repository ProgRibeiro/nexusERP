"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decryptSession, encryptSession, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const COOKIE = "nx_provider_session";
const cleanDocument = (value: string) => value.replace(/\D/g, "");
const salt = () => crypto.randomBytes(16).toString("hex");
const hash = (password: string, value: string) => crypto.pbkdf2Sync(password, value, 100_000, 64, "sha512").toString("hex");
const matches = (password: string, value: string, expected: string) => {
  const actualBuffer = Buffer.from(hash(password, value), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

async function setProviderSession(provider: { id: string; name: string; portalEmail: string | null }) {
  const token = await encryptSession({
    userId: provider.id,
    name: provider.name,
    email: provider.portalEmail || "",
    roleName: "Prestador",
    permissions: ["provider.portal"],
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/portal/prestador", maxAge: SESSION_MAX_AGE_SECONDS });
}

async function providerSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const session = token ? await decryptSession(token) : null;
  if (!session || session.roleName !== "Prestador") return null;
  return session;
}

export async function registerProviderPortal(data: { name: string; document: string; phone: string; email: string; password: string }) {
  try {
    const document = cleanDocument(data.document);
    const email = data.email.trim().toLowerCase();
    if (document.length < 11) return { success: false, error: "Informe um CPF ou CNPJ válido." };
    if (!email.includes("@")) return { success: false, error: "Informe um e-mail válido." };
    if (data.password.length < 8) return { success: false, error: "A senha precisa ter pelo menos 8 caracteres." };
    const emailOwner = await prisma.supplier.findUnique({ where: { portalEmail: email } });
    if (emailOwner) return { success: false, error: "Este e-mail já possui acesso ao portal." };
    const originalDocument = data.document.trim();
    const existing = await prisma.supplier.findFirst({
      where: { OR: [{ cnpj: document }, { cnpj: originalDocument }] },
    });
    if (existing?.portalActive) return { success: false, error: "Este CPF/CNPJ já possui acesso. Use a página de login." };
    if (existing && existing.email.trim().toLowerCase() !== email) {
      return { success: false, error: "O e-mail não corresponde ao cadastro feito pela Nexus. Entre em contato com a administração." };
    }
    const passwordSalt = salt();
    const provider = existing
      ? await prisma.supplier.update({ where: { id: existing.id }, data: { portalEmail: email, portalPassword: hash(data.password, passwordSalt), portalSalt: passwordSalt, portalActive: true, phone: data.phone || existing.phone } })
      : await prisma.supplier.create({ data: { name: data.name.trim(), cnpj: document, phone: data.phone.trim(), email, portalEmail: email, portalPassword: hash(data.password, passwordSalt), portalSalt: passwordSalt, portalActive: true, notes: "Cadastro realizado pelo Portal do Prestador" } });
    await setProviderSession(provider);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível concluir o cadastro." };
  }
}

export async function loginProviderPortal(email: string, password: string) {
  const provider = await prisma.supplier.findUnique({ where: { portalEmail: email.trim().toLowerCase() } });
  if (!provider || !provider.portalActive || !provider.portalPassword || !provider.portalSalt || !matches(password, provider.portalSalt, provider.portalPassword)) {
    return { success: false, error: "E-mail ou senha inválidos." };
  }
  await setProviderSession(provider);
  return { success: true };
}

export async function logoutProviderPortal() {
  const store = await cookies();
  store.delete(COOKIE);
  return { success: true };
}

export async function getProviderPortalDashboard() {
  const session = await providerSession();
  if (!session) return null;
  const provider = await prisma.supplier.findUnique({
    where: { id: session.userId },
    include: {
      providerJobs: {
        include: { quote: { select: { client: { select: { name: true } } } }, serviceOrder: { select: { code: true, status: true, scheduledDate: true } }, accountsPayable: { select: { status: true, dueDate: true, paymentDate: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!provider?.portalActive) return null;
  return {
    provider: { name: provider.name, email: provider.portalEmail, phone: provider.phone },
    jobs: provider.providerJobs.map((job) => ({
      id: job.id, description: job.description, clientName: job.quote.client.name, osCode: job.serviceOrder.code,
      osStatus: job.serviceOrder.status, executionStatus: job.executionStatus, paymentStatus: job.accountsPayable?.status === "PAGO" ? "PAGO" : job.paymentStatus,
      costValue: Number(job.costValue), scheduledDate: job.scheduledDate || job.serviceOrder.scheduledDate,
      paymentDueDate: job.accountsPayable?.dueDate || job.paymentDueDate, paymentDate: job.accountsPayable?.paymentDate || null,
    })),
  };
}

export async function updateOwnProviderJob(jobId: string, status: "EXECUCAO" | "CONCLUIDO") {
  const session = await providerSession();
  if (!session) return { success: false, error: "Sessão expirada." };
  const job = await prisma.providerJob.findFirst({ where: { id: jobId, supplierId: session.userId } });
  if (!job) return { success: false, error: "Serviço não encontrado." };
  if (status === "EXECUCAO" && !["PENDENTE", "AGENDADO"].includes(job.executionStatus)) return { success: false, error: "Este serviço não pode ser iniciado agora." };
  if (status === "CONCLUIDO" && job.executionStatus !== "EXECUCAO") return { success: false, error: "Inicie o serviço antes de concluí-lo." };
  await prisma.providerJob.update({ where: { id: job.id }, data: { executionStatus: status, completedAt: status === "CONCLUIDO" ? new Date() : undefined, paymentStatus: status === "CONCLUIDO" ? "LIBERADO" : undefined } });
  return { success: true };
}
