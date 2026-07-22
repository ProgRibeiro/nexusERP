"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface SLAAndMTBFMetrics {
  slaRate: number;         // Percentage (e.g. 92.5)
  slaSucceeded: number;    // Count met
  slaTotal: number;        // Total completed
  mtbfDays: number;        // Average days between failures (corrective OSs)
  activeEquipments: number;// Total active equipments
}

/**
 * Calcula métricas gerenciais avançadas (SLA e MTBF) a partir do banco de dados
 */
export async function getDashboardMetrics(): Promise<SLAAndMTBFMetrics> {
  try {
    await requireAuth();

    // 1. Busca todas as ordens de serviço concluídas ou faturadas
    const serviceOrders = await prisma.serviceOrder.findMany({
      where: {
        status: { in: ["CONCLUIDA", "CONCLUIDO", "FATURAMENTO", "FATURADA", "RELATORIO_ENVIADO"] },
      },
      select: {
        id: true,
        type: true,
        priority: true,
        createdAt: true,
        completedAt: true,
        clientId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Cálculo do SLA
    // SLA definido por prioridade (tempo para conclusão a partir da data de criação):
    // - URGENTE: até 24 horas (1 dia)
    // - ALTA: até 48 horas (2 dias)
    // - MEDIA: até 120 horas (5 dias)
    // - BAIXA: até 240 horas (10 dias)
    let slaSucceeded = 0;
    let slaTotal = 0;

    serviceOrders.forEach((os) => {
      if (!os.completedAt) return;

      const creationDate = new Date(os.createdAt);
      const completionDate = new Date(os.completedAt);
      const diffMs = completionDate.getTime() - creationDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let maxHours = 120; // Padrão MEDIA (5 dias)
      if (os.priority === "URGENTE") maxHours = 24;
      else if (os.priority === "ALTA") maxHours = 48;
      else if (os.priority === "BAIXA") maxHours = 240;

      if (diffHours <= maxHours) {
        slaSucceeded++;
      }
      slaTotal++;
    });

    const slaRate = slaTotal > 0 ? parseFloat(((slaSucceeded / slaTotal) * 100).toFixed(1)) : 100.0;

    // 3. Cálculo do MTBF (Mean Time Between Failures)
    // Coleta todas as OSs corretivas e de emergência
    const correctiveOrders = await prisma.serviceOrder.findMany({
      where: {
        type: { in: ["CORRETIVA", "EMERGENCIA"] },
      },
      select: {
        clientId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Agrupa chamados corretivos por cliente para encontrar os intervalos de falha
    const clientFailures: Record<string, Date[]> = {};
    correctiveOrders.forEach((os) => {
      if (!clientFailures[os.clientId]) {
        clientFailures[os.clientId] = [];
      }
      clientFailures[os.clientId].push(new Date(os.createdAt));
    });

    let totalIntervalsMs = 0;
    let intervalsCount = 0;

    Object.values(clientFailures).forEach((dates) => {
      if (dates.length < 2) return; // Precisa de pelo menos 2 falhas para calcular o intervalo

      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i].getTime() - dates[i - 1].getTime();
        totalIntervalsMs += diff;
        intervalsCount++;
      }
    });

    // Converte de milissegundos para dias
    let mtbfDays = 90.0; // Benchmark de fallback (90 dias)
    if (intervalsCount > 0) {
      const avgMs = totalIntervalsMs / intervalsCount;
      mtbfDays = parseFloat((avgMs / (1000 * 60 * 60 * 24)).toFixed(1));
      // Garante uma média mínima realista de 1 dia se houver repetições no mesmo dia
      if (mtbfDays < 1) mtbfDays = 1.0;
    } else {
      // Se não houver intervalos de falhas múltiplos, calcula baseado no tempo total de operação geral
      const clientsCount = await prisma.client.count();
      if (clientsCount > 0 && correctiveOrders.length > 0) {
        // Média de dias por corretiva
        const oldest = correctiveOrders[0].createdAt;
        const totalOperationDays = Math.max(1, (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24));
        mtbfDays = parseFloat(((totalOperationDays * clientsCount) / correctiveOrders.length).toFixed(1));
      }
    }

    const activeEquipments = await prisma.clientEquipment.count();

    return {
      slaRate,
      slaSucceeded,
      slaTotal,
      mtbfDays,
      activeEquipments,
    };
  } catch (error) {
    logger.error("Erro ao calcular indicadores gerenciais:", error);
    return {
      slaRate: 100.0,
      slaSucceeded: 0,
      slaTotal: 0,
      mtbfDays: 90.0,
      activeEquipments: 0,
    };
  }
}
