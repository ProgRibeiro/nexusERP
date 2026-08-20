"use server";

import { prisma } from "@/lib/db";
import { AuthError, requirePortalAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SYSTEM_MODULE_CATALOG } from "@/lib/featureFlags";

type JsonValue = Record<string, unknown> | Array<unknown>;

async function readSetting<T extends JsonValue>(key: string, fallback: T): Promise<T> {
  const record = await prisma.setting.findUnique({ where: { key } });
  if (!record?.value) return fallback;
  try {
    return JSON.parse(record.value) as T;
  } catch {
    return fallback;
  }
}

async function saveSetting<T extends JsonValue>(key: string, value: T) {
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export interface CommercialGoal {
  id: string;
  name: string;
  monthlyTarget: number;
  achieved: number;
  owner: string;
  active: boolean;
}

export interface CommercialCommission {
  id: string;
  rep: string;
  percentage: number;
  baseGoal: number;
  active: boolean;
}

export interface DevSubscription {
  id: string;
  tenantName: string;
  plan: string;
  startsAt: string;
  endsAt: string;
  status: string;
  seats: number;
}

export interface DevFeatureFlagState {
  code: string;
  name: string;
  enabled: boolean;
  category: string;
}

const COMMERCIAL_GOALS_KEY = "commercial.goals";
const COMMERCIAL_COMMISSIONS_KEY = "commercial.commissions";
const DEV_SUBSCRIPTIONS_KEY = "dev.subscriptions";
const DEV_FEATURE_FLAGS_KEY = "dev.featureFlags";

export async function getCommercialGoalsAction() {
  await requirePortalAccess("commercial");
  return readSetting<CommercialGoal[]>(COMMERCIAL_GOALS_KEY, [
    { id: "goal-1", name: "Novos leads/mês", monthlyTarget: 120, achieved: 84, owner: "Equipe Comercial", active: true },
    { id: "goal-2", name: "Demos agendadas", monthlyTarget: 40, achieved: 19, owner: "Equipe Comercial", active: true },
  ]);
}

export async function saveCommercialGoalsAction(goals: CommercialGoal[]) {
  const session = await requirePortalAccess("commercial");
  if (session.platformRole !== "SUPER_ADMIN" && session.platformRole !== "SALES_MANAGER") {
    throw new AuthError("SEM_PERMISSAO", "Apenas gestor comercial pode alterar metas.");
  }
  await saveSetting(COMMERCIAL_GOALS_KEY, goals);
  revalidatePath("/comercial/metas");
}

export async function getCommercialCommissionsAction() {
  await requirePortalAccess("commercial");
  return readSetting<CommercialCommission[]>(COMMERCIAL_COMMISSIONS_KEY, [
    { id: "comm-1", rep: "Equipe Comercial", percentage: 3, baseGoal: 100000, active: true },
  ]);
}

export async function saveCommercialCommissionsAction(commissions: CommercialCommission[]) {
  const session = await requirePortalAccess("commercial");
  if (session.platformRole !== "SUPER_ADMIN" && session.platformRole !== "SALES_MANAGER") {
    throw new AuthError("SEM_PERMISSAO", "Apenas gestor comercial pode alterar comissões.");
  }
  await saveSetting(COMMERCIAL_COMMISSIONS_KEY, commissions);
  revalidatePath("/comercial/comissoes");
}

export async function getDevFeatureFlagsAction() {
  await requirePortalAccess("developer");
  const defaults = SYSTEM_MODULE_CATALOG.map((feature) => ({
    code: feature.code,
    name: feature.name,
    category: feature.category,
    enabled: feature.defaultEnabled,
  }));
  const persisted = await readSetting<DevFeatureFlagState[]>(DEV_FEATURE_FLAGS_KEY, []);
  const map = new Map(persisted.map((item) => [item.code, item]));
  return defaults.map((feature) => ({
    ...feature,
    enabled: map.get(feature.code)?.enabled ?? feature.enabled,
  }));
}

export async function saveDevFeatureFlagsAction(flags: DevFeatureFlagState[]) {
  const session = await requirePortalAccess("developer");
  if (session.platformRole !== "SUPER_ADMIN" && session.platformRole !== "DEVELOPER") {
    throw new AuthError("SEM_PERMISSAO", "Apenas desenvolvedor pode alterar feature flags.");
  }
  await saveSetting(DEV_FEATURE_FLAGS_KEY, flags);
  revalidatePath("/dev/feature-flags");
}

export async function getDevSubscriptionsAction() {
  await requirePortalAccess("developer");
  return readSetting<DevSubscription[]>(DEV_SUBSCRIPTIONS_KEY, [
    {
      id: "sub-1",
      tenantName: "Empresa principal",
      plan: "ENTERPRISE",
      startsAt: "2026-01-01",
      endsAt: "2030-12-31",
      status: "ATIVA",
      seats: 50,
    },
  ]);
}

export async function saveDevSubscriptionsAction(subscriptions: DevSubscription[]) {
  const session = await requirePortalAccess("developer");
  if (session.platformRole !== "SUPER_ADMIN" && session.platformRole !== "DEVELOPER") {
    throw new AuthError("SEM_PERMISSAO", "Apenas desenvolvedor pode alterar assinaturas.");
  }
  await saveSetting(DEV_SUBSCRIPTIONS_KEY, subscriptions);
  revalidatePath("/dev/assinaturas");
}
