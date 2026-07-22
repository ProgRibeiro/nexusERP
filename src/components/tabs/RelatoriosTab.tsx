"use client";

import React, { useState, useEffect } from "react";
import { getAuditLogs, AuditLogDTO } from "@/app/actions/auditActions";
import { formatDateTime } from "@/lib/utils";
import { Card } from "../ui/Card";
import { Table, TableRow, TableCell } from "../ui/Table";
import { ListPageShell } from "../ui/ListPageShell";
import { BarChart3, ShieldAlert } from "lucide-react";

export default function RelatoriosTab() {
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">

      {/* Title */}
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-150 font-semibold text-sm">
        <BarChart3 size={18} className="text-amber-500" />
        <span>Painel de Auditoria e Relatórios de Segurança</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <ShieldAlert className="text-primary shrink-0" size={24} />
          <div>
            <span className="text-[9px] font-medium text-zinc-400 block uppercase">Registros de Auditoria</span>
            <span className="text-base font-bold text-zinc-850 dark:text-zinc-150 mt-0.5 block">{logs.length} ações salvas</span>
          </div>
        </Card>
      </div>

      {/* Logs Table */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 mb-3">Histórico de Alterações (PMOC / Banco)</h3>
        <ListPageShell
          loading={loading}
          isEmpty={logs.length === 0}
          emptyIcon={<ShieldAlert size={28} className="text-zinc-300" />}
          emptyMessage="Nenhum log de auditoria encontrado"
        >
          <div className="max-h-[460px] overflow-y-auto">
            <Table headers={["Usuário", "Perfil", "Ação", "Entidade", "Timestamp"]}>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-semibold text-zinc-850 dark:text-zinc-150">
                    {log.userName}
                    <span className="text-[10px] text-zinc-400 font-medium block mt-0.5">{log.userEmail}</span>
                  </TableCell>
                  <TableCell className="font-medium text-zinc-650 dark:text-zinc-450">{log.roleName}</TableCell>
                  <TableCell className="font-mono text-[11px] text-primary font-semibold">{log.action}</TableCell>
                  <TableCell className="font-medium text-zinc-650 dark:text-zinc-450">{log.entity} (#{log.entityId.slice(-4)})</TableCell>
                  <TableCell className="font-medium text-zinc-650 dark:text-zinc-500">{formatDateTime(log.timestamp)}</TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        </ListPageShell>
      </div>
    </div>
  );
}
