"use server";

import { getDashboardData } from "./dashboardActions";
import type { InsightSeverity } from "@/components/ui/InsightBar";

export type InsightModule = "estoque" | "financeiro" | "ordens-servico" | "crm" | "faturamento" | "contratos" | "geral";

export interface InsightDTO {
  id: string;
  severity: InsightSeverity;
  module: InsightModule;
  message: string;
  link?: string;
}

const ALERT_TYPE_TO_MODULE: Record<string, InsightModule> = {
  ESTOQUE: "estoque",
  FINANCEIRO: "financeiro",
  OPERACIONAL: "ordens-servico",
  COMERCIAL: "crm",
  FISCAL: "faturamento",
  CONTRATOS: "contratos",
};

const ALERT_TYPE_TO_SEVERITY: Record<string, InsightSeverity> = {
  ESTOQUE: "warning",
  FINANCEIRO: "danger",
  OPERACIONAL: "warning",
  COMERCIAL: "info",
  FISCAL: "danger",
  CONTRATOS: "warning",
};

/**
 * Proactive insights for the whole ERP, derived from the same real aggregate
 * queries already powering the Dashboard (getDashboardData's `alertas`), so the
 * numbers shown here and on the Dashboard never drift apart. Callers can filter
 * by `module` to show a scoped InsightBar inside a specific tab (e.g. Estoque).
 */
export async function getInsights(): Promise<InsightDTO[]> {
  const data = await getDashboardData();

  return data.alertas.map((alerta) => ({
    id: alerta.id,
    severity: ALERT_TYPE_TO_SEVERITY[alerta.type] ?? "info",
    module: ALERT_TYPE_TO_MODULE[alerta.type] ?? "geral",
    message: alerta.title,
    link: alerta.link,
  }));
}

export async function getInsightsForModule(module: InsightModule): Promise<InsightDTO[]> {
  const all = await getInsights();
  return all.filter((i) => i.module === module);
}
