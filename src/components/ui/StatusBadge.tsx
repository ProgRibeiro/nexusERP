"use client";

import React from "react";
import { Badge } from "./Badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral" | "info";

// Data-driven status → variant map. Add new ERP status strings here instead of
// branching logic — keys are normalized (uppercase) at lookup time.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  APROVADO: "success",
  PAGO: "success",
  CONCLUIDA: "success",
  CONCLUIDO: "success",
  RELATORIO_ENVIADO: "success",
  FATURADA: "success",
  ATIVO: "success",
  "EMISSÃO CONCLUÍDA": "success",
  EMITIDA: "success",

  EM_EXECUCAO: "primary",
  "EM EXECUÇÃO": "primary",
  AGENDADO: "primary",
  AGENDADA: "primary",
  DESLOCAMENTO: "info",
  EXECUCAO: "primary",
  FATURAMENTO: "primary",
  EM_CONFERENCIA: "primary",
  "EM CONFERÊNCIA": "primary",
  ENVIADA: "primary",

  PENDENTE: "warning",
  AGUARDANDO: "warning",
  AGUARDANDO_FATURAMENTO: "warning",
  "AGUARDANDO FATURAMENTO": "warning",
  "AGUARDANDO NF": "warning",
  AGUARDANDO_PAGAMENTO: "warning",
  "AGUARDANDO PAGAMENTO": "warning",
  ABERTO: "warning",
  CRIADA: "warning",
  AGUARDANDO_AGENDAMENTO: "warning",
  AGUARDANDO_PECA: "warning",
  AGUARDANDO_CLIENTE: "warning",
  PAUSADA: "warning",
  RETORNO: "warning",
  REVISAO: "warning",
  NOVO: "warning",

  VENCIDO: "danger",
  REJEITADO: "danger",
  REJEITADA: "danger",
  INADIMPLENTE: "danger",
  ATRASADA: "danger",
  ERRO: "danger",
  CANCELADA: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  CRIADA: "Criada",
  AGUARDANDO_AGENDAMENTO: "Aguardando agendamento",
  AGENDADA: "Agendada",
  DESLOCAMENTO: "Em deslocamento",
  EXECUCAO: "Em execução",
  PAUSADA: "Pausada",
  AGUARDANDO_PECA: "Aguardando peça",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  RETORNO: "Retorno necessário",
  CONCLUIDA: "Concluída",
  REVISAO: "Em revisão",
  RELATORIO_ENVIADO: "Relatório aprovado",
  FATURAMENTO: "Aguardando NF",
  FATURADA: "Faturada",
  CANCELADA: "Cancelada",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normStatus = status?.toUpperCase() || "";
  const variant = STATUS_VARIANTS[normStatus] ?? "neutral";

  return (
    <Badge variant={variant} className={className}>
      {STATUS_LABELS[normStatus] || status}
    </Badge>
  );
}
