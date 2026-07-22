"use client";

import React from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";

export type InsightSeverity = "info" | "warning" | "danger";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  message: string;
  count?: number;
  onClick?: () => void;
}

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  info: "bg-primary/5 border-primary/20 text-primary",
  warning: "bg-warning/5 border-warning/20 text-warning",
  danger: "bg-danger/5 border-danger/20 text-danger",
};

const SEVERITY_ICONS: Record<InsightSeverity, React.ComponentType<{ size?: number }>> = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * Horizontal strip of proactive alert chips, fed by insightsActions.ts. Used on the
 * Dashboard (all insights) and inline at the top of individual modules (filtered to
 * that module) so users see what needs attention without hunting for it.
 */
export function InsightBar({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {insights.map((insight) => {
        const Icon = SEVERITY_ICONS[insight.severity];
        return (
          <button
            key={insight.id}
            type="button"
            onClick={insight.onClick}
            disabled={!insight.onClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${SEVERITY_STYLES[insight.severity]} ${
              insight.onClick ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : "cursor-default"
            }`}
          >
            <Icon size={13} />
            <span>{insight.message}</span>
            {insight.count !== undefined && <span className="font-semibold">{insight.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
