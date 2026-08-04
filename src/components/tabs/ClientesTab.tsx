"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { getClients, createClient, consultarCNPJAction, ClientDTO } from "@/app/actions/clientActions";
import { formatCpfCnpj, formatPhone } from "@/lib/utils";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { ListPageShell } from "../ui/ListPageShell";
import { UserPlus, Users } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";

interface ClientesTabProps {
  newRecord?: boolean;
  requestId?: string;
}

export default function ClientesTab({ newRecord = false, requestId }: ClientesTabProps) {
  const { hasPermission } = useAuth();
  const { openDrawer, openTab } = useWorkspace();
  const { toast } = useToast();

  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(newRecord);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    socialName: "",
    fancyName: "",
    cpfCnpj: "",
    stateRegistration: "",
    municipalRegistration: "",
    email: "",
    phone: "",
    whatsapp: "",
    segment: "Climatização",
    origin: "Google",
    notes: "",
  });

  const [cnpjLoading, setCnpjLoading] = useState(false);

  useEffect(() => {
    setIsAddOpen(newRecord);
  }, [newRecord, requestId]);

  const handleCnpjSearch = async () => {
    const clean = newClientForm.cpfCnpj.replace(/\D/g, "");
    if (clean.length === 11) {
      toast("A busca online automática suporta apenas CNPJ. Para CPF, por favor preencha os dados manualmente.", "warning");
      return;
    }
    if (clean.length !== 14) {
      toast("Para realizar a busca online, digite os 14 números do CNPJ.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const res = await consultarCNPJAction(clean);
      if (res.success && res.data) {
        setNewClientForm((prev) => ({
          ...prev,
          name: res.data.corporateName,
          socialName: res.data.corporateName,
          fancyName: res.data.tradeName || res.data.corporateName,
          email: res.data.email || prev.email,
          phone: res.data.phone || prev.phone,
          notes: `Endereço Receita Federal: ${res.data.address}\n\n${prev.notes}`,
        }));
        toast("Dados do CNPJ preenchidos!", "success");
      } else {
        toast(res.error || "CNPJ não localizado.", "error");
      }
    } catch (err) {
      toast("Erro de conexão ao consultar CNPJ.", "error");
    } finally {
      setCnpjLoading(false);
    }
  };

  async function loadClients(query = "") {
    setLoading(true);
    try {
      const data = await getClients(query);
      setClients(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar lista de clientes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients(search);
  }, [search]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.name || !newClientForm.phone) {
      toast("Nome e telefone são obrigatórios", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await createClient({
        name: newClientForm.name,
        socialName: newClientForm.socialName || undefined,
        fancyName: newClientForm.fancyName || undefined,
        cpfCnpj: newClientForm.cpfCnpj,
        stateRegistration: newClientForm.stateRegistration || undefined,
        municipalRegistration: newClientForm.municipalRegistration || undefined,
        email: newClientForm.email,
        phone: newClientForm.phone,
        whatsapp: newClientForm.whatsapp || undefined,
        segment: newClientForm.segment,
        origin: newClientForm.origin,
        notes: newClientForm.notes || undefined,
      });

      if (res.success) {
        toast("Cliente cadastrado com sucesso!", "success");
        setIsAddOpen(false);
        setNewClientForm({
          name: "",
          socialName: "",
          fancyName: "",
          cpfCnpj: "",
          stateRegistration: "",
          municipalRegistration: "",
          email: "",
          phone: "",
          whatsapp: "",
          segment: "Climatização",
          origin: "Google",
          notes: "",
        });
        loadClients();
      } else {
        toast(res.error || "Erro ao cadastrar cliente", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CPF/CNPJ, e-mail..."
        primaryActionLabel={hasPermission("clients.write") ? "Novo Cliente" : undefined}
        onPrimaryAction={hasPermission("clients.write") ? () => setIsAddOpen(true) : undefined}
        loading={loading}
        isEmpty={clients.length === 0}
        emptyIcon={<Users size={28} className="text-zinc-300" />}
        emptyMessage="Nenhum cliente encontrado"
      >
        <Table headers={["Cliente", "Segmento", "CPF / CNPJ", "Telefone", "E-mail", "Status"]}>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              onClick={() => openDrawer("client", client.name, client)}
              onDoubleClick={() => openTab("clientes", client.name, { id: client.id })}
              title="Dois cliques para abrir prontuário completo"
            >
              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                {client.name}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {client.segment || "N/A"}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {formatCpfCnpj(client.cpfCnpj)}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {formatPhone(client.phone)}
              </TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {client.email}
              </TableCell>
              <TableCell>
                <StatusBadge status={client.status} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </ListPageShell>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Cadastrar Novo Cliente"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input
            label="Nome Completo / Razão Social *"
            required
            value={newClientForm.name}
            onChange={(e) => setNewClientForm((prev) => ({ ...prev, name: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <Input
              label="Nome Fantasia"
              value={newClientForm.fancyName}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, fancyName: e.target.value }))}
            />
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="CPF / CNPJ (opcional)"
                  placeholder="Pode ser preenchido depois"
                  value={newClientForm.cpfCnpj}
                  onChange={(e) => setNewClientForm((prev) => ({ ...prev, cpfCnpj: e.target.value }))}
                />
                {!newClientForm.cpfCnpj.trim() && (
                  <span className="mt-1 block text-[10px] font-medium text-zinc-450">
                    O cliente será salvo como cadastro provisório, sem documento.
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCnpjSearch}
                loading={cnpjLoading}
                className="mb-1 py-2.5 px-3.5"
              >
                Buscar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-mail *"
              type="email"
              required
              value={newClientForm.email}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Telefone *"
              required
              value={newClientForm.phone}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Segmento"
              options={[
                { value: "Climatização", label: "Climatização / Ar Condicionado" },
                { value: "Elétrica", label: "Elétrica" },
                { value: "Mecânica", label: "Mecânica Industrial" },
                { value: "Predial", label: "Manutenção Predial" },
                { value: "Outros", label: "Outros Serviços" }
              ]}
              value={newClientForm.segment}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, segment: e.target.value }))}
            />
            <Select
              label="Origem do Lead"
              options={[
                { value: "Google", label: "Pesquisa Google" },
                { value: "Indicação", label: "Indicação de Cliente" },
                { value: "Instagram", label: "Redes Sociais" },
                { value: "Prospecção", label: "Prospecção Ativa" }
              ]}
              value={newClientForm.origin}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, origin: e.target.value }))}
            />
          </div>

          <Input
            label="Observações Internas"
            value={newClientForm.notes}
            onChange={(e) => setNewClientForm((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsAddOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={actionLoading}
            >
              <UserPlus size={16} /> Cadastrar Cliente
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
