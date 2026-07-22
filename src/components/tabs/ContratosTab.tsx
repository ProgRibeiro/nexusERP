"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { ContractDTO, createContract, getContracts, triggerAllActiveRecurrences, triggerRecurrencyBilling, updateContract } from "@/app/actions/contractActions";
import { consultarCNPJAction, createClientWithAddress, getClients, ClientDTO } from "@/app/actions/clientActions";
import { getInsightsForModule } from "@/app/actions/insightsActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseAppLink } from "@/lib/searchNavigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Modal } from "../ui/Modal";
import { ListPageShell } from "../ui/ListPageShell";
import { InsightBar, Insight } from "../ui/InsightBar";
import { ArrowLeft, Building2, Check, ChevronDown, FileSignature, MapPin, Pencil, Play, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";

const emptyClientForm = {
  cpfCnpj: "",
  name: "",
  socialName: "",
  fancyName: "",
  email: "",
  phone: "",
  whatsapp: "",
  segment: "",
  notes: "",
  address: {
    label: "Principal",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
  },
};

export default function ContratosTab({ newRecord = false, requestId }: { newRecord?: boolean; requestId?: string }) {
  const { hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [contracts, setContracts] = useState<ContractDTO[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(newRecord);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalStep, setModalStep] = useState<"contract" | "client">("contract");
  const [clientQuery, setClientQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [contractItems, setContractItems] = useState([
    { description: "Inspeção preventiva mensal PMOC", quantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    if (newRecord) setIsAddOpen(true);
  }, [newRecord, requestId]);

  // Form State
  const [contractForm, setContractForm] = useState({
    clientId: "",
    value: "",
    billingPeriod: "MENSAL",
    startDate: "",
    endDate: "",
    notes: "",
  });

  async function loadContracts() {
    setLoading(true);
    try {
      const list = await getContracts();
      setContracts(list);
      const clientList = await getClients();
      setClients(clientList);
    } catch (err) {
      toast("Erro ao carregar contratos", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContracts();
    getInsightsForModule("contratos")
      .then((data) =>
        setInsights(
          data.map((i) => ({
            id: i.id,
            severity: i.severity,
            message: i.message,
            onClick: i.link ? () => {
              const { tabType, params } = parseAppLink(i.link!);
              openTab(tabType, "Contratos", params);
            } : undefined,
          }))
        )
      )
      .catch(() => {});
  }, []);

  const filteredClients = useMemo(() => {
    const text = clientQuery.trim().toLocaleLowerCase("pt-BR");
    const document = clientQuery.replace(/\D/g, "");
    if (!text) return clients.slice(0, 8);
    return clients.filter((client) =>
      client.name.toLocaleLowerCase("pt-BR").includes(text) ||
      (client.fancyName || "").toLocaleLowerCase("pt-BR").includes(text) ||
      (client.socialName || "").toLocaleLowerCase("pt-BR").includes(text) ||
      Boolean(document && client.cpfCnpj.replace(/\D/g, "").includes(document))
    ).slice(0, 8);
  }, [clientQuery, clients]);

  const selectedClient = clients.find((client) => client.id === contractForm.clientId);

  const selectClient = (client: ClientDTO) => {
    setContractForm((prev) => ({ ...prev, clientId: client.id }));
    setClientQuery(client.name);
    setClientPickerOpen(false);
  };

  const closeContractModal = () => {
    setIsAddOpen(false);
    setModalStep("contract");
    setClientPickerOpen(false);
  };

  const resetContractForm = () => {
    setEditingContractId(null);
    setContractForm({ clientId: "", value: "", billingPeriod: "MENSAL", startDate: "", endDate: "", notes: "" });
    setContractItems([{ description: "Inspeção preventiva mensal PMOC", quantity: 1, unitPrice: 0 }]);
    setClientQuery("");
    setModalStep("contract");
  };

  const openNewContract = () => {
    resetContractForm();
    setIsAddOpen(true);
  };

  const toDateInput = (value: Date | string) => {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
  };

  const openEditContract = (contract: ContractDTO) => {
    setEditingContractId(contract.id);
    setContractForm({
      clientId: contract.clientId,
      value: String(contract.value),
      billingPeriod: contract.billingPeriod,
      startDate: toDateInput(contract.startDate),
      endDate: toDateInput(contract.endDate),
      notes: contract.notes || "",
    });
    setContractItems(contract.items.length ? contract.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })) : [{ description: "Inspeção preventiva mensal PMOC", quantity: 1, unitPrice: contract.value }]);
    setClientQuery(contract.clientName);
    setClientPickerOpen(false);
    setModalStep("contract");
    setIsAddOpen(true);
  };

  const updateContractItem = (index: number, field: "description" | "quantity" | "unitPrice", value: string) => {
    setContractItems((current) => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      [field]: field === "description" ? value : Number(value),
    } : item));
  };

  const handleCnpjLookup = async () => {
    const document = clientForm.cpfCnpj.replace(/\D/g, "");
    if (document.length !== 14) {
      toast(document.length === 11 ? "Para CPF, preencha os dados manualmente." : "Digite os 14 números do CNPJ.", "warning");
      return;
    }

    setCnpjLoading(true);
    try {
      const result = await consultarCNPJAction(document);
      if (!result.success || !result.data) {
        toast(result.error || "CNPJ não encontrado.", "warning");
        return;
      }
      const data = result.data;
      setClientForm((prev) => ({
        ...prev,
        cpfCnpj: data.cnpj,
        name: data.tradeName || data.corporateName,
        socialName: data.corporateName,
        fancyName: data.tradeName,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        address: data.addressDetails ? {
          ...prev.address,
          ...data.addressDetails,
          label: "Principal",
          reference: "",
        } : prev.address,
      }));
      toast("Dados do CNPJ preenchidos. Confira antes de salvar.", "success");
    } catch {
      toast("Não foi possível consultar o CNPJ agora.", "error");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const document = clientForm.cpfCnpj.replace(/\D/g, "");
    const address = clientForm.address;
    if (![11, 14].includes(document.length)) {
      toast("Informe um CPF com 11 ou CNPJ com 14 dígitos.", "warning");
      return;
    }
    if (!address.cep.trim() || !address.street.trim() || !address.number.trim() || !address.neighborhood.trim() || !address.city.trim() || address.state.trim().length !== 2) {
      toast("Complete CEP, logradouro, número, bairro, cidade e UF.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const result = await createClientWithAddress({
        client: {
          name: clientForm.name.trim(),
          socialName: clientForm.socialName.trim() || undefined,
          fancyName: clientForm.fancyName.trim() || undefined,
          cpfCnpj: document,
          email: clientForm.email.trim(),
          phone: clientForm.phone.trim(),
          whatsapp: clientForm.whatsapp.trim() || undefined,
          segment: clientForm.segment.trim() || undefined,
          origin: "Contrato recorrente",
          notes: clientForm.notes.trim() || undefined,
        },
        address: {
          label: address.label,
          cep: address.cep,
          street: address.street,
          number: address.number,
          complement: address.complement || undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          reference: address.reference || undefined,
        },
      });
      if (!result.success || !result.client) {
        toast(result.error || "Não foi possível cadastrar o cliente.", "error");
        return;
      }

      const refreshedClients = await getClients();
      setClients(refreshedClients);
      const createdClient = refreshedClients.find((client) => client.id === result.client!.id) || result.client;
      setContractForm((prev) => ({ ...prev, clientId: result.client!.id }));
      setClientQuery(createdClient.name);
      setClientForm(emptyClientForm);
      setModalStep("contract");
      toast("Cliente cadastrado e selecionado no contrato.", "success");
    } catch {
      toast("Erro de conexão ao cadastrar o cliente.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractForm.clientId) {
      toast("Selecione um cliente válido", "warning");
      return;
    }
    const value = Number(contractForm.value);
    if (!Number.isFinite(value) || value <= 0) {
      toast("Informe um valor recorrente maior que zero.", "warning");
      return;
    }
    if (!contractForm.startDate || !contractForm.endDate) {
      toast("Informe o início e o vencimento do contrato.", "warning");
      return;
    }
    if (new Date(contractForm.endDate) < new Date(contractForm.startDate)) {
      toast("O vencimento não pode ser anterior ao início do contrato.", "warning");
      return;
    }
    if (!contractItems.length || contractItems.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      toast("Revise o escopo: descrição, quantidade e valor devem ser válidos.", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        clientId: contractForm.clientId,
        value,
        billingPeriod: contractForm.billingPeriod,
        startDate: new Date(`${contractForm.startDate}T12:00:00`),
        endDate: new Date(`${contractForm.endDate}T12:00:00`),
        notes: contractForm.notes,
        items: contractItems.map((item) => ({ ...item, description: item.description.trim() })),
      };
      const res = editingContractId
        ? await updateContract(editingContractId, payload)
        : await createContract(payload, currentUser?.id || "");

      if (res.success) {
        toast(editingContractId ? "Proposta de contrato atualizada!" : "Contrato cadastrado com sucesso!", "success");
        closeContractModal();
        resetContractForm();
        loadContracts();
      } else {
        toast(res.error || "Erro ao salvar contrato", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateOS = async (contractId: string) => {
    setActionLoading(true);
    try {
      const res = await triggerRecurrencyBilling(contractId, currentUser?.id || "");
      if (res.success) {
        toast("Faturamento de recorrência gerado no financeiro!", "success");
        loadContracts();
      } else {
        toast(res.error || "Erro ao faturar recorrência", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRecurrency = async () => {
    setActionLoading(true);
    try {
      const res = await triggerAllActiveRecurrences(currentUser?.id || "");
      if (res.success) {
        toast(`Processamento de lote concluído! ${res.count} contrato(s) faturado(s) com sucesso.`, "success");
        loadContracts();
      } else {
        toast(res.error || "Erro ao processar lote de recorrências", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredContracts = contracts.filter((c) =>
    (c.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por cliente..."
        insight={<InsightBar insights={insights} />}
        filters={
          hasPermission("contratos.write") ? (
            <Button
              variant="secondary"
              onClick={handleBatchRecurrency}
              loading={actionLoading}
              title="Processar cobrança e preventiva mensal em lote"
            >
              <Play size={15} /> Processar Lote Preventivo
            </Button>
          ) : undefined
        }
        primaryActionLabel={hasPermission("contratos.write") ? "Novo Contrato Recorrente" : undefined}
        onPrimaryAction={hasPermission("contratos.write") ? openNewContract : undefined}
        loading={loading}
        isEmpty={filteredContracts.length === 0}
        emptyIcon={<FileSignature size={28} className="text-zinc-300" />}
        emptyMessage="Nenhum contrato recorrente encontrado"
      >
        <Table headers={["Código", "Cliente", "Data Início", "Valor Mensal", "Próxima Preventiva", "Status", "Ações"]}>
          {filteredContracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-150">#{c.id.slice(-4)}</TableCell>
              <TableCell className="font-semibold text-zinc-850 dark:text-zinc-200">{c.clientName}</TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">{formatDate(c.startDate)}</TableCell>
              <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">{formatCurrency(c.value)}</TableCell>
              <TableCell className="font-medium text-zinc-650 dark:text-zinc-400">
                {c.nextMaintenanceDate ? formatDate(c.nextMaintenanceDate) : "A definir"}
              </TableCell>
              <TableCell><StatusBadge status={c.status} /></TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {hasPermission("contratos.write") && (
                    <Button variant="secondary" size="sm" onClick={() => openEditContract(c)} title="Editar proposta do contrato">
                      <Pencil size={12} /> Editar
                    </Button>
                  )}
                  {c.status === "ATIVO" ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGenerateOS(c.id)}
                      loading={actionLoading}
                      title="Gerar OS Preventiva PMOC"
                    >
                      <Play size={12} fill="currentColor" /> Gerar OS
                    </Button>
                  ) : (
                    <span className="text-[10px] text-zinc-450 font-medium uppercase">Encerrado</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </ListPageShell>

      {/* Contrato e cadastro rápido de cliente no mesmo fluxo */}
      <Modal
        isOpen={isAddOpen}
        onClose={closeContractModal}
        title={modalStep === "client" ? "Cadastrar cliente para o contrato" : editingContractId ? "Editar proposta de contrato" : "Novo contrato recorrente"}
        size="xl"
      >
        {modalStep === "contract" ? (
          <form onSubmit={handleSaveContract} className="space-y-6">
            {editingContractId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                As alterações serão usadas nas próximas recorrências. OS e cobranças já geradas permanecem com os dados históricos.
              </div>
            )}
            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">1. Cliente contratante</h4>
                  <p className="mt-0.5 text-xs text-zinc-500">Busque e selecione aqui mesmo, ou cadastre um cliente novo.</p>
                </div>
                {hasPermission("clients.write") && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => { setClientPickerOpen(false); setModalStep("client"); }}>
                    <UserPlus size={14} /> Novo cliente
                  </Button>
                )}
              </div>

              <div className="relative">
                <Input
                  label="Buscar por nome, razão social, CPF ou CNPJ *"
                  icon={<Search size={15} />}
                  autoComplete="off"
                  placeholder="Digite para localizar o cliente"
                  value={clientQuery}
                  onFocus={() => setClientPickerOpen(true)}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setContractForm((prev) => ({ ...prev, clientId: "" }));
                    setClientPickerOpen(true);
                  }}
                />
                <ChevronDown className="pointer-events-none absolute bottom-2.5 right-3 text-zinc-400" size={16} />

                {clientPickerOpen && (
                  <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                    {filteredClients.length ? filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => selectClient(client)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{client.name}</span>
                          <span className="block truncate text-[11px] text-zinc-500">
                            {client.cpfCnpj} {client.fancyName ? `· ${client.fancyName}` : ""}
                          </span>
                        </span>
                        {contractForm.clientId === client.id && <Check size={16} className="shrink-0 text-primary" />}
                      </button>
                    )) : (
                      <div className="p-4 text-center">
                        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Nenhum cliente encontrado</p>
                        {hasPermission("clients.write") && (
                          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { setClientPickerOpen(false); setModalStep("client"); }}>
                            <UserPlus size={14} /> Cadastrar este cliente
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedClient && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-zinc-900">
                    <Building2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedClient.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">{selectedClient.cpfCnpj} · {selectedClient.email}</p>
                  </div>
                  <span className="hidden rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 sm:block">Selecionado</span>
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-zinc-150 pt-5 dark:border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">2. Condições do contrato</h4>
                <p className="mt-0.5 text-xs text-zinc-500">Defina valor, periodicidade e vigência.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Valor recorrente (R$) *"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={contractForm.value}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, value: e.target.value }))}
                />
                <Select
                  label="Periodicidade *"
                  options={[
                    { value: "MENSAL", label: "Mensal" },
                    { value: "TRIMESTRAL", label: "Trimestral" },
                    { value: "ANUAL", label: "Anual" },
                  ]}
                  value={contractForm.billingPeriod}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, billingPeriod: e.target.value }))}
                />
                <Input
                  label="Início do contrato *"
                  type="date"
                  required
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
                <Input
                  label="Vencimento do contrato *"
                  type="date"
                  min={contractForm.startDate || undefined}
                  required
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <Input
                label="Observações do contrato"
                placeholder="Cobertura, reajuste, limites e condições do PMOC"
                value={contractForm.notes}
                onChange={(e) => setContractForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </section>

            <section className="space-y-4 border-t border-zinc-150 pt-5 dark:border-zinc-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">3. Escopo da proposta</h4>
                  <p className="mt-0.5 text-xs text-zinc-500">Serviços que serão copiados para as próximas OS preventivas.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setContractItems((current) => [...current, { description: "", quantity: 1, unitPrice: 0 }])}
                >
                  <Plus size={14} /> Adicionar serviço
                </Button>
              </div>

              <div className="space-y-3">
                {contractItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 md:grid-cols-12 dark:border-zinc-700 dark:bg-zinc-800/40">
                    <div className="md:col-span-7">
                      <Input
                        label={index === 0 ? "Descrição do serviço *" : undefined}
                        required
                        placeholder="Ex: Limpeza e inspeção preventiva dos equipamentos"
                        value={item.description}
                        onChange={(event) => updateContractItem(index, "description", event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={index === 0 ? "Quantidade *" : undefined}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={item.quantity}
                        onChange={(event) => updateContractItem(index, "quantity", event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={index === 0 ? "Valor ref. (R$)" : undefined}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateContractItem(index, "unitPrice", event.target.value)}
                      />
                    </div>
                    <div className={`flex items-center justify-end md:col-span-1 ${index === 0 ? "md:pt-5" : ""}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={contractItems.length === 1}
                        onClick={() => setContractItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        title="Remover serviço"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-zinc-150 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-900/95">
              <Button variant="secondary" type="button" onClick={closeContractModal}>Cancelar</Button>
              <Button variant="primary" type="submit" loading={actionLoading} disabled={!contractForm.clientId}>
                {editingContractId ? "Salvar alterações" : "Cadastrar contrato"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateClient} className="space-y-6">
            <button
              type="button"
              onClick={() => setModalStep("contract")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-primary"
            >
              <ArrowLeft size={14} /> Voltar ao contrato
            </button>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
              Ao salvar, o cliente será selecionado automaticamente e você continuará preenchendo o contrato.
            </div>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-150 pb-2 dark:border-zinc-800">
                <Building2 size={16} className="text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Dados do cliente</h4>
              </div>
              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                <div className="md:col-span-8">
                  <Input label="CPF ou CNPJ *" required placeholder="Somente números ou formatado" value={clientForm.cpfCnpj} onChange={(e) => setClientForm((prev) => ({ ...prev, cpfCnpj: e.target.value }))} />
                </div>
                <div className="md:col-span-4">
                  <Button type="button" variant="secondary" className="w-full" loading={cnpjLoading} onClick={handleCnpjLookup}>
                    <Search size={14} /> Consultar CNPJ
                  </Button>
                </div>
                <div className="md:col-span-6"><Input label="Nome usado no sistema *" required value={clientForm.name} onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
                <div className="md:col-span-6"><Input label="Razão social" value={clientForm.socialName} onChange={(e) => setClientForm((prev) => ({ ...prev, socialName: e.target.value }))} /></div>
                <div className="md:col-span-6"><Input label="Nome fantasia" value={clientForm.fancyName} onChange={(e) => setClientForm((prev) => ({ ...prev, fancyName: e.target.value }))} /></div>
                <div className="md:col-span-6"><Input label="Segmento" placeholder="Ex: Condomínio, comércio, indústria" value={clientForm.segment} onChange={(e) => setClientForm((prev) => ({ ...prev, segment: e.target.value }))} /></div>
                <div className="md:col-span-4"><Input label="E-mail *" type="email" required value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
                <div className="md:col-span-4"><Input label="Telefone *" required value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
                <div className="md:col-span-4"><Input label="WhatsApp" value={clientForm.whatsapp} onChange={(e) => setClientForm((prev) => ({ ...prev, whatsapp: e.target.value }))} /></div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-150 pb-2 dark:border-zinc-800">
                <MapPin size={16} className="text-primary" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Endereço de execução</h4>
                  <p className="text-[11px] text-zinc-500">Necessário para gerar as OS preventivas do contrato.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-3"><Input label="CEP *" required value={clientForm.address.cep} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, cep: e.target.value } }))} /></div>
                <div className="md:col-span-7"><Input label="Logradouro *" required value={clientForm.address.street} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, street: e.target.value } }))} /></div>
                <div className="md:col-span-2"><Input label="Número *" required value={clientForm.address.number} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, number: e.target.value } }))} /></div>
                <div className="md:col-span-4"><Input label="Bairro *" required value={clientForm.address.neighborhood} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, neighborhood: e.target.value } }))} /></div>
                <div className="md:col-span-4"><Input label="Cidade *" required value={clientForm.address.city} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, city: e.target.value } }))} /></div>
                <div className="md:col-span-2"><Input label="UF *" required maxLength={2} value={clientForm.address.state} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, state: e.target.value.toUpperCase() } }))} /></div>
                <div className="md:col-span-2"><Input label="Complemento" value={clientForm.address.complement} onChange={(e) => setClientForm((prev) => ({ ...prev, address: { ...prev.address, complement: e.target.value } }))} /></div>
              </div>
            </section>

            <Input label="Observações internas" value={clientForm.notes} onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))} />

            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-zinc-150 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-900/95">
              <Button type="button" variant="secondary" onClick={() => setModalStep("contract")}><ArrowLeft size={14} /> Voltar</Button>
              <Button type="submit" variant="primary" loading={actionLoading}><UserPlus size={14} /> Salvar e selecionar</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
