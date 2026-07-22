"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { createManualServiceOrder, getServiceOrders } from "@/app/actions/osActions";
import { getClientDetails, getClients } from "@/app/actions/clientActions";
import { getInsightsForModule } from "@/app/actions/insightsActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAppLink } from "@/lib/searchNavigation";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { ListPageShell } from "../ui/ListPageShell";
import { InsightBar, Insight } from "../ui/InsightBar";
import { Wrench } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";

interface OrdensServicoTabProps {
  newRecord?: boolean;
  requestId?: string;
  clientId?: string;
  statusFilter?: string;
}

export default function OrdensServicoTab({ newRecord = false, requestId, clientId, statusFilter }: OrdensServicoTabProps) {
  const { hasPermission } = useAuth();
  const { openDrawer, openTab } = useWorkspace();
  const { toast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(statusFilter || "");
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(newRecord);
  const [actionLoading, setActionLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [form, setForm] = useState({
    clientId: clientId || "",
    addressId: "",
    contactId: "",
    type: "CORRETIVA",
    priority: "MEDIA",
    problemReported: "",
    notes: "",
  });

  useEffect(() => {
    if (newRecord) setIsCreateOpen(true);
  }, [newRecord, requestId]);

  useEffect(() => {
    if (!isCreateOpen) return;
    getClients().then((list) => {
      setClients(list);
      setForm((current) => ({ ...current, clientId: current.clientId || list[0]?.id || "" }));
    });
  }, [isCreateOpen]);

  useEffect(() => {
    if (!form.clientId || !isCreateOpen) { setAddresses([]); setContacts([]); return; }
    getClientDetails(form.clientId).then((details) => {
      const nextAddresses = details?.addresses || [];
      const nextContacts = details?.contacts || [];
      setAddresses(nextAddresses);
      setContacts(nextContacts);
      setForm((current) => ({
        ...current,
        addressId: nextAddresses.some((item) => item.id === current.addressId) ? current.addressId : nextAddresses[0]?.id || "",
        contactId: nextContacts.some((item) => item.id === current.contactId) ? current.contactId : "",
      }));
    });
  }, [form.clientId, isCreateOpen]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const result = await createManualServiceOrder(form);
      if (!result.success || !result.os) {
        toast(result.error || "Não foi possível criar a OS.", "error");
        return;
      }
      toast(`OS ${result.os.code} criada e pronta para agendamento.`, "success");
      setIsCreateOpen(false);
      await loadOrders();
      openTab("ordens-servico", result.os.code, { id: result.os.id });
    } finally {
      setActionLoading(false);
    }
  };

  async function loadOrders() {
    setLoading(true);
    try {
      let data = await getServiceOrders({
        search,
        status: status || undefined,
      });
      if (clientId) {
        data = data.filter((o: any) => o.clientId === clientId);
      }
      setOrders(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar Ordens de Serviço", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, [search, status, clientId]);

  useEffect(() => {
    getInsightsForModule("ordens-servico")
      .then((data) =>
        setInsights(
          data.map((i) => ({
            id: i.id,
            severity: i.severity,
            message: i.message,
            onClick: i.link ? () => {
              const { params } = parseAppLink(i.link!);
              setStatus(params.status || "");
            } : undefined,
          }))
        )
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código, cliente, técnico..."
        insight={<InsightBar insights={insights} />}
        filters={
          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: "", label: "Todos os Status" },
                { value: "ATRASADA", label: "Atrasadas" },
                { value: "CRIADA", label: "Criada" },
                { value: "AGUARDANDO_AGENDAMENTO", label: "Aguardando agendamento" },
                { value: "AGENDADA", label: "Agendada" },
                { value: "DESLOCAMENTO", label: "Em deslocamento" },
                { value: "EXECUCAO", label: "Em execução" },
                { value: "PAUSADA", label: "Pausada" },
                { value: "AGUARDANDO_PECA", label: "Aguardando peça" },
                { value: "AGUARDANDO_CLIENTE", label: "Aguardando cliente" },
                { value: "RETORNO", label: "Retorno necessário" },
                { value: "CONCLUIDA", label: "Concluída" },
                { value: "REVISAO", label: "Em revisão" },
                { value: "RELATORIO_ENVIADO", label: "Relatório aprovado" },
                { value: "FATURAMENTO", label: "Aguardando NF" },
                { value: "FATURADA", label: "Faturada" },
                { value: "CANCELADA", label: "Cancelada" },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        }
        primaryActionLabel={hasPermission("os.write") ? "Nova OS" : undefined}
        onPrimaryAction={hasPermission("os.write") ? () => setIsCreateOpen(true) : undefined}
        loading={loading}
        isEmpty={orders.length === 0}
        emptyIcon={<Wrench size={28} className="text-zinc-300" />}
        emptyMessage="Nenhuma Ordem de Serviço encontrada"
      >
        <Table headers={["Código", "Cliente", "Prioridade", "Técnico", "Agendada para", "Valor Total", "Status"]}>
          {orders.map((os) => (
            <TableRow
              key={os.id}
              onClick={() => openDrawer("os", `OS #${os.id.slice(-4)}`, os)}
              onDoubleClick={() => openTab("ordens-servico", `OS #${os.id.slice(-4)}`, { id: os.id })}
              title="Dois cliques para abrir ficha de OS completa"
            >
              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-150">
                #{os.code || os.id.slice(-4)}
              </TableCell>
              <TableCell className="font-semibold text-zinc-850 dark:text-zinc-200">
                {os.client?.name || os.clientName}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                <span className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[9px] ${
                  os.priority === "ALTA" ? "bg-danger/10 text-danger" :
                  os.priority === "MEDIA" ? "bg-warning/10 text-warning" :
                  "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {os.priority}
                </span>
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {os.technicians?.map((t: any) => t.name || t.technician?.name).filter(Boolean).join(", ") || os.technicianName || "Não atribuído"}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {formatDate(os.scheduledDate || os.createdAt)}
              </TableCell>
              <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">
                {formatCurrency(os.totalValue)}
              </TableCell>
              <TableCell>
                <StatusBadge status={os.status} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </ListPageShell>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nova Ordem de Serviço" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-300">
            A OS manual será criada como <strong>aguardando agendamento</strong>. Depois você define data, horário e equipe técnica.
          </div>
          <Select label="Cliente *" required value={form.clientId} onChange={(e) => setForm((current) => ({ ...current, clientId: e.target.value }))} options={clients.map((client) => ({ value: client.id, label: `${client.name} · ${client.cpfCnpj}` }))} />
          <Select label="Endereço de execução *" required value={form.addressId} onChange={(e) => setForm((current) => ({ ...current, addressId: e.target.value }))} options={addresses.length ? addresses.map((address) => ({ value: address.id, label: `${address.label} · ${address.street}, ${address.number} · ${address.city}/${address.state}` })) : [{ value: "", label: "Cadastre um endereço no cliente antes de criar a OS" }]} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Tipo de serviço *" value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} options={[
              { value: "CORRETIVA", label: "Manutenção corretiva" }, { value: "PREVENTIVA", label: "Manutenção preventiva" }, { value: "INSTALACAO", label: "Instalação" }, { value: "VISITA_TECNICA", label: "Visita técnica" }, { value: "EMERGENCIA", label: "Emergência" }, { value: "GARANTIA", label: "Garantia" }, { value: "RETORNO", label: "Retorno" }, { value: "LAUDO_TECNICO", label: "Laudo técnico" },
            ]} />
            <Select label="Prioridade *" value={form.priority} onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))} options={[{ value: "BAIXA", label: "Baixa" }, { value: "MEDIA", label: "Média" }, { value: "ALTA", label: "Alta" }, { value: "URGENTE", label: "Urgente" }]} />
          </div>
          <Select label="Contato responsável (opcional)" value={form.contactId} onChange={(e) => setForm((current) => ({ ...current, contactId: e.target.value }))} options={[{ value: "", label: "Contato principal do cliente" }, ...contacts.map((contact) => ({ value: contact.id, label: `${contact.name} · ${contact.phone}` }))]} />
          <Textarea label="Serviço solicitado / problema relatado *" required rows={4} value={form.problemReported} onChange={(e) => setForm((current) => ({ ...current, problemReported: e.target.value }))} placeholder="Descreva com clareza o que deve ser executado..." />
          <Input label="Observações internas" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancelar</Button><Button type="submit" variant="primary" loading={actionLoading} disabled={!form.addressId}>Criar OS e agendar depois</Button></div>
        </form>
      </Modal>
    </div>
  );
}
