"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  PackageCheck,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { getClients, getClientDetails, syncClientFromCNPJ, ClientDTO, ClientDetailsDTO } from "@/app/actions/clientActions";
import {
  createPreventiveProposal,
  getPreventiveProposals,
  PreventiveProposalInput,
  PreventiveProposalListItem,
} from "@/app/actions/preventiveActions";
import {
  getPreventiveTemplate,
  preventiveTemplates,
  PreventiveScopeItem,
  PreventiveTemplateId,
} from "@/lib/preventiveTemplates";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCompanyTaxProfile } from "@/app/actions/settingsActions";
import { calculateProposalTax, TaxProfile } from "@/lib/tax";

const frequencyOptions = [
  { value: "MENSAL", label: "Mensal — 12 visitas/ano", visits: 12 },
  { value: "BIMESTRAL", label: "Bimestral — 6 visitas/ano", visits: 6 },
  { value: "TRIMESTRAL", label: "Trimestral — 4 visitas/ano", visits: 4 },
  { value: "SEMESTRAL", label: "Semestral — 2 visitas/ano", visits: 2 },
  { value: "ANUAL", label: "Anual — 1 visita/ano", visits: 1 },
] as const;

const nextMonth = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
};

const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const lineText = (value: string[]) => value.join("\n");

function initialForm(): PreventiveProposalInput {
  const template = getPreventiveTemplate("CLIMATIZACAO");
  return {
    clientId: "",
    addressId: "",
    contactId: "",
    templateId: template.id,
    title: template.title,
    frequency: "MENSAL",
    visitsPerYear: 12,
    durationHours: template.durationHours,
    technicians: template.technicians,
    slaHours: 24,
    startDate: nextMonth(),
    equipmentIds: [],
    scope: template.scope,
    deliverables: template.deliverables,
    inclusions: template.inclusions,
    exclusions: template.exclusions,
    pricePerVisit: 0,
    materialsPerVisit: 0,
    travelPerVisit: 0,
    discount: 0,
    tax: 0,
    validityDays: 15,
    warrantyDays: 90,
    paymentTerms: "Mensal, via boleto ou PIX, com vencimento em 15 dias após cada visita.",
    notes: "O calendário definitivo será alinhado com o responsável do cliente após a aprovação.",
  };
}

function SectionTitle({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{number}</span>
      <div>
        <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

export default function PreventiveProposalsTab() {
  const { openTab } = useWorkspace();
  const { toast } = useToast();
  const [view, setView] = useState<"builder" | "history">("builder");
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [clientDetails, setClientDetails] = useState<ClientDetailsDTO | null>(null);
  const [proposals, setProposals] = useState<PreventiveProposalListItem[]>([]);
  const [form, setForm] = useState<PreventiveProposalInput>(initialForm);
  const [clientQuery, setClientQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [customScope, setCustomScope] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastCreated, setLastCreated] = useState<{ id: string; code: string } | null>(null);
  const [taxProfile, setTaxProfile] = useState<TaxProfile>({ regime: "SIMPLES_NACIONAL", rate: 6, label: "Simples Nacional", configured: false });

  const setField = <K extends keyof PreventiveProposalInput>(key: K, value: PreventiveProposalInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadInitialData = async () => {
    setLoading(true);
    const [clientRows, proposalRows] = await Promise.all([getClients(), getPreventiveProposals()]);
    setClients(clientRows);
    setProposals(proposalRows);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInitialData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    getCompanyTaxProfile().then(setTaxProfile).catch(() => {});
  }, []);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    if (!query) return clients.slice(0, 8);
    return clients.filter((client) =>
      client.name.toLowerCase().includes(query) ||
      (client.fancyName || "").toLowerCase().includes(query) ||
      (client.socialName || "").toLowerCase().includes(query) ||
      (digits && Boolean(client.cpfCnpj?.replace(/\D/g, "").includes(digits)))
    ).slice(0, 8);
  }, [clientQuery, clients]);

  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectedAddress = clientDetails?.addresses.find((address) => address.id === form.addressId);
  const selectedContact = clientDetails?.contacts.find((contact) => contact.id === form.contactId);
  const selectedEquipments = clientDetails?.equipments.filter((equipment) => form.equipmentIds.includes(equipment.id)) || [];
  const subtotal = (form.pricePerVisit + form.materialsPerVisit + form.travelPerVisit) * form.visitsPerYear;
  const taxCalculation = calculateProposalTax(subtotal, form.discount, taxProfile.rate);
  const calculatedTax = taxCalculation.tax;
  const total = taxCalculation.total;
  const monthlyEquivalent = total / 12;

  const selectClient = async (client: ClientDTO) => {
    setClientQuery(client.name);
    setClientPickerOpen(false);
    setField("clientId", client.id);
    let details = await getClientDetails(client.id);

    // Cadastros importados podem ainda não ter endereço estruturado. Quando o
    // documento é CNPJ, completa os dados públicos e tenta novamente sem exigir
    // que o usuário saia da proposta.
    if (!details?.addresses.length && (client.cpfCnpj?.replace(/\D/g, "").length || 0) === 14) {
      const synced = await syncClientFromCNPJ(client.id);
      if (synced.success) {
        details = await getClientDetails(client.id);
        setClients(await getClients());
      }
    }

    setClientDetails(details);
    const preferredAddress =
      details?.addresses.find((address) => /execu[cç][aã]o/i.test(address.label)) ||
      details?.addresses.find((address) => /principal/i.test(address.label)) ||
      details?.addresses[0];
    const preferredContact =
      details?.contacts.find((contact) => contact.isApproval) ||
      details?.contacts.find((contact) => contact.isTechnical) ||
      details?.contacts.find((contact) => contact.isFinancial) ||
      details?.contacts[0];
    setForm((current) => ({
      ...current,
      clientId: client.id,
      addressId: preferredAddress?.id || "",
      contactId: preferredContact?.id || "",
      equipmentIds: details?.equipments.map((equipment) => equipment.id) || [],
    }));

    if (!preferredAddress) {
      toast("Não foi possível localizar um endereço para este CNPJ. Complete o cadastro do cliente.", "warning");
    } else {
      toast("Endereço, contato e equipamentos preenchidos automaticamente.", "success");
    }
  };

  const applyTemplate = (templateId: PreventiveTemplateId) => {
    const template = getPreventiveTemplate(templateId);
    setForm((current) => ({
      ...current,
      templateId,
      title: template.title,
      durationHours: template.durationHours,
      technicians: template.technicians,
      scope: template.scope,
      deliverables: template.deliverables,
      inclusions: template.inclusions,
      exclusions: template.exclusions,
    }));
  };

  const toggleScope = (item: PreventiveScopeItem) => {
    setForm((current) => ({
      ...current,
      scope: current.scope.some((scope) => scope.id === item.id)
        ? current.scope.filter((scope) => scope.id !== item.id)
        : [...current.scope, item],
    }));
  };

  const toggleEquipment = (id: string) => {
    setForm((current) => ({
      ...current,
      equipmentIds: current.equipmentIds.includes(id)
        ? current.equipmentIds.filter((equipmentId) => equipmentId !== id)
        : [...current.equipmentIds, id],
    }));
  };

  const addCustomScope = () => {
    const label = customScope.trim();
    if (!label) return;
    setForm((current) => ({
      ...current,
      scope: [...current.scope, { id: `custom-${Date.now()}`, group: "Personalizado", label }],
    }));
    setCustomScope("");
  };

  const validate = () => {
    if (!form.clientId) return "Selecione o cliente da proposta.";
    if (!form.addressId) return "Selecione o endereço onde a preventiva será executada.";
    if (form.scope.length === 0) return "Selecione ao menos uma atividade do escopo.";
    if (form.deliverables.length === 0) return "Informe ao menos uma entrega técnica.";
    if (subtotal <= 0) return "Informe o valor por visita, materiais ou deslocamento.";
    if (total <= 0) return "O valor final da proposta deve ser maior que zero.";
    return null;
  };

  const saveProposal = async () => {
    const error = validate();
    if (error) {
      toast(error, "warning");
      return;
    }
    setSaving(true);
    const result = await createPreventiveProposal({ ...form, tax: calculatedTax });
    setSaving(false);
    if (!result.success) {
      toast(result.error || "Não foi possível criar a proposta.", "error");
      return;
    }
    setLastCreated(result.quote);
    toast(`Proposta ${result.quote.code} criada como rascunho.`, "success");
    setProposals(await getPreventiveProposals());
  };

  const scopeGroups = useMemo(() => {
    const template = getPreventiveTemplate(form.templateId);
    return template.scope.reduce<Record<string, PreventiveScopeItem[]>>((groups, item) => {
      groups[item.group] = [...(groups[item.group] || []), item];
      return groups;
    }, {});
  }, [form.templateId]);

  if (loading) {
    return <Card className="flex min-h-96 items-center justify-center text-sm font-semibold text-zinc-500">Carregando modelos de preventiva...</Card>;
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="print:hidden flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15"><ClipboardCheck size={24} /></div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200"><Sparkles size={12} /> Operação recorrente</div>
            <h1 className="text-xl font-black sm:text-2xl">Central de manutenção preventiva</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-blue-100/80 sm:text-sm">Escolha a loja, acompanhe contratos, organize projetos e mapeie todo o patrimônio técnico em uma planta 2D.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-black/20 p-1 ring-1 ring-white/10">
          <button type="button" onClick={() => setView("builder")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${view === "builder" ? "bg-white text-blue-900 shadow" : "text-blue-100 hover:bg-white/10"}`}>Nova proposta</button>
          <button type="button" onClick={() => setView("history")} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${view === "history" ? "bg-white text-blue-900 shadow" : "text-blue-100 hover:bg-white/10"}`}>Histórico ({proposals.length})</button>
        </div>
      </header>

      {view === "history" ? (
        <Card className="print:hidden overflow-hidden p-0">
          <div className="border-b border-zinc-100 p-5 dark:border-zinc-800">
            <h2 className="font-black text-zinc-900 dark:text-white">Propostas preventivas criadas</h2>
            <p className="mt-1 text-xs text-zinc-500">A aprovação e conversão em OS continuam no módulo de Orçamentos.</p>
          </div>
          {proposals.length === 0 ? (
            <div className="p-12 text-center"><FileText className="mx-auto mb-3 text-zinc-300" size={32} /><p className="text-sm font-bold text-zinc-600">Nenhuma proposta preventiva criada</p></div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {proposals.map((proposal) => (
                <button key={proposal.id} type="button" onClick={() => openTab("orcamentos", proposal.code, { id: proposal.id })} className="grid w-full grid-cols-2 items-center gap-3 p-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 sm:grid-cols-[120px_1fr_140px_120px_130px_24px]">
                  <span className="font-mono text-xs font-black text-blue-600">{proposal.code}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-zinc-850 dark:text-zinc-100">{proposal.clientName}</p><p className="text-[11px] text-zinc-500">Criada em {formatDate(proposal.createdAt)}</p></div>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{proposal.frequency} · {proposal.visitsPerYear} visitas</span>
                  <StatusBadge status={proposal.status} />
                  <span className="text-right text-sm font-black text-zinc-900 dark:text-white">{formatCurrency(proposal.total)}</span>
                  <ChevronRight className="text-zinc-400" size={16} />
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
          <div className="print:hidden space-y-5">
            <Card className="space-y-5">
              <SectionTitle number={1} title="Escolha um modelo técnico" description="O modelo preenche escopo, entregas, inclusões e exclusões. Tudo continua editável." />
              <div className="grid gap-3 sm:grid-cols-2">
                {preventiveTemplates.map((template) => {
                  const active = form.templateId === template.id;
                  return (
                    <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} className={`relative rounded-xl border p-4 text-left transition ${active ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}>
                      {active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={12} /></span>}
                      <p className="pr-7 text-sm font-black text-zinc-900 dark:text-zinc-100">{template.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{template.description}</p>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-blue-600">{template.scope.length} atividades prontas</p>
                    </button>
                  );
                })}
              </div>
              <Input label="Título da proposta" value={form.title} onChange={(event) => setField("title", event.target.value)} />
            </Card>

            <Card className="space-y-5 overflow-visible">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle number={2} title="Cliente, local e ativos" description="Busque e selecione no mesmo campo. Os endereços e equipamentos vêm do cadastro." />
                <Button variant="secondary" size="sm" onClick={() => openTab("clientes", "Novo cliente", { new: "true", requestId: Date.now() })}><Plus size={14} /> Cliente</Button>
              </div>
              <div className="relative">
                <Input label="Buscar cliente por nome, razão social ou CNPJ" icon={<Search size={15} />} value={clientQuery} onFocus={() => setClientPickerOpen(true)} onChange={(event) => { setClientQuery(event.target.value); setClientPickerOpen(true); }} placeholder="Digite para buscar e clique no cliente" />
                {clientPickerOpen && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                    {filteredClients.length ? filteredClients.map((client) => (
                      <button key={client.id} type="button" onClick={() => void selectClient(client)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30">
                        <div><p className="text-sm font-bold text-zinc-850 dark:text-zinc-100">{client.name}</p><p className="text-[11px] text-zinc-500">{client.socialName || client.fancyName || "Cadastro principal"} · {client.cpfCnpj || "Documento não informado"}</p></div>
                        {form.clientId === client.id && <CheckCircle2 className="text-blue-600" size={17} />}
                      </button>
                    )) : <p className="p-3 text-xs text-zinc-500">Nenhum cliente encontrado.</p>}
                  </div>
                )}
              </div>
              {selectedClient && clientDetails && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black text-zinc-900 dark:text-white">{selectedClient.name}</p><p className="text-xs text-zinc-500">{selectedClient.cpfCnpj || "Documento não informado"} · {selectedClient.email}</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">Cliente selecionado</span></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select label="Endereço de execução * · automático" value={form.addressId} onChange={(event) => setField("addressId", event.target.value)} options={[{ value: "", label: clientDetails.addresses.length ? "Selecione o local" : "Endereço não cadastrado" }, ...clientDetails.addresses.map((address) => ({ value: address.id, label: `${address.label} — ${address.street}, ${address.number}` }))]} />
                    <Select label="Contato responsável · automático" value={form.contactId} onChange={(event) => setField("contactId", event.target.value)} options={[{ value: "", label: selectedClient.email ? `Contato cadastral — ${selectedClient.email}` : `Contato cadastral — ${selectedClient.phone}` }, ...clientDetails.contacts.map((contact) => ({ value: contact.id, label: `${contact.name}${contact.role ? ` — ${contact.role}` : ""}` }))]} />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black text-zinc-700 dark:text-zinc-200">Equipamentos incluídos ({form.equipmentIds.length})</p>{clientDetails.equipments.length > 0 && <button type="button" onClick={() => setField("equipmentIds", form.equipmentIds.length === clientDetails.equipments.length ? [] : clientDetails.equipments.map((equipment) => equipment.id))} className="text-[11px] font-bold text-blue-600">{form.equipmentIds.length === clientDetails.equipments.length ? "Desmarcar todos" : "Selecionar todos"}</button>}</div>
                    {clientDetails.equipments.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500">O cliente ainda não possui equipamentos cadastrados. A proposta pode ser criada e os ativos cadastrados depois.</p> : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {clientDetails.equipments.map((equipment) => {
                          const checked = form.equipmentIds.includes(equipment.id);
                          return <button key={equipment.id} type="button" onClick={() => toggleEquipment(equipment.id)} className={`flex items-start gap-3 rounded-lg border p-3 text-left ${checked ? "border-blue-400 bg-white dark:bg-zinc-900" : "border-zinc-200 opacity-70 dark:border-zinc-700"}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300"}`}>{checked && <Check size={10} />}</span><div><p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{equipment.tag || equipment.type} · {equipment.brand} {equipment.model}</p><p className="text-[10px] text-zinc-500">{equipment.location || "Local não informado"}{equipment.capacity ? ` · ${equipment.capacity}` : ""}</p></div></button>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-5">
              <SectionTitle number={3} title="Periodicidade e atendimento" description="Defina o calendário comercial, a equipe prevista e o prazo de resposta." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Select label="Periodicidade" value={form.frequency} onChange={(event) => { const option = frequencyOptions.find((item) => item.value === event.target.value)!; setForm((current) => ({ ...current, frequency: option.value, visitsPerYear: option.visits })); }} options={frequencyOptions.map((option) => ({ value: option.value, label: option.label }))} />
                <Input label="Início previsto" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} />
                <Input label="Visitas por ano" type="number" min={1} max={52} value={form.visitsPerYear} onChange={(event) => setField("visitsPerYear", Number(event.target.value))} />
                <Input label="Duração por visita (horas)" type="number" min={0.5} step={0.5} value={form.durationHours} onChange={(event) => setField("durationHours", Number(event.target.value))} />
                <Input label="Técnicos por visita" type="number" min={1} value={form.technicians} onChange={(event) => setField("technicians", Number(event.target.value))} />
                <Input label="SLA para chamados (horas)" type="number" min={1} value={form.slaHours} onChange={(event) => setField("slaHours", Number(event.target.value))} />
              </div>
            </Card>

            <Card className="space-y-5">
              <SectionTitle number={4} title="Escopo da preventiva" description="Marque exatamente o que será executado. Isso vira o checklist da OS." />
              <div className="space-y-4">
                {Object.entries(scopeGroups).map(([group, items]) => (
                  <div key={group}><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">{group}</p><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => { const checked = form.scope.some((scope) => scope.id === item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition ${checked ? "border-blue-300 bg-blue-50 text-zinc-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-zinc-100" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"}`}><input type="checkbox" checked={checked} onChange={() => toggleScope(item)} className="mt-0.5 accent-blue-600" /><span className="font-semibold leading-relaxed">{item.label}</span></label>; })}</div></div>
                ))}
                {form.scope.filter((item) => item.group === "Personalizado" && !getPreventiveTemplate(form.templateId).scope.some((preset) => preset.id === item.id)).map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 dark:bg-violet-950/30 dark:text-violet-200"><span>{item.label}</span><button type="button" onClick={() => setField("scope", form.scope.filter((scope) => scope.id !== item.id))}><Trash2 size={14} /></button></div>)}
                <div className="flex gap-2"><Input value={customScope} onChange={(event) => setCustomScope(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomScope(); } }} placeholder="Adicionar atividade personalizada ao escopo" /><Button type="button" variant="secondary" onClick={addCustomScope}><Plus size={15} /> Adicionar</Button></div>
              </div>
            </Card>

            <Card className="space-y-5">
              <SectionTitle number={5} title="Entregas e limites do contrato" description="Uma linha por item. Deixe claro o que está incluído e o que será cobrado à parte." />
              <div className="grid gap-4 lg:grid-cols-3">
                {[{ key: "deliverables", label: "Entregas ao cliente", value: form.deliverables }, { key: "inclusions", label: "Incluso na proposta", value: form.inclusions }, { key: "exclusions", label: "Não incluso", value: form.exclusions }].map((field) => (
                  <label key={field.key} className="space-y-1.5"><span className="text-xs font-medium text-zinc-500">{field.label}</span><textarea rows={7} value={lineText(field.value)} onChange={(event) => setField(field.key as "deliverables" | "inclusions" | "exclusions", lines(event.target.value))} className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" /></label>
                ))}
              </div>
            </Card>

            <Card className="space-y-5">
              <SectionTitle number={6} title="Valores e condições comerciais" description="O sistema calcula o contrato anual e apresenta o equivalente mensal." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input label="Serviço por visita (R$)" type="number" min={0} step={0.01} value={form.pricePerVisit} onChange={(event) => setField("pricePerVisit", Number(event.target.value))} />
                <Input label="Materiais por visita (R$)" type="number" min={0} step={0.01} value={form.materialsPerVisit} onChange={(event) => setField("materialsPerVisit", Number(event.target.value))} />
                <Input label="Deslocamento por visita (R$)" type="number" min={0} step={0.01} value={form.travelPerVisit} onChange={(event) => setField("travelPerVisit", Number(event.target.value))} />
                <Input label="Desconto total (R$)" type="number" min={0} step={0.01} value={form.discount} onChange={(event) => setField("discount", Number(event.target.value))} />
                <Input label={`Impostos automáticos · ${taxProfile.label} (${taxProfile.rate.toFixed(2)}%)`} type="number" readOnly value={calculatedTax.toFixed(2)} className="bg-zinc-100 font-semibold text-zinc-600 dark:bg-zinc-900" />
                <Input label="Validade da proposta (dias)" type="number" min={1} value={form.validityDays} onChange={(event) => setField("validityDays", Number(event.target.value))} />
                <Input label="Garantia dos serviços (dias)" type="number" min={0} value={form.warrantyDays} onChange={(event) => setField("warrantyDays", Number(event.target.value))} />
                <div className="sm:col-span-2"><Input label="Condição de pagamento" value={form.paymentTerms} onChange={(event) => setField("paymentTerms", event.target.value)} /></div>
              </div>
              <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-500">Observações comerciais</span><textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" /></label>
            </Card>
          </div>

          <aside className="xl:sticky xl:top-4">
            <Card className="print:rounded-none print:border-0 print:p-8 print:shadow-none overflow-hidden p-0">
              <div className="bg-slate-950 p-5 text-white print:bg-white print:p-0 print:text-zinc-900">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300 print:text-blue-700">Proposta técnica comercial</p><h2 className="mt-2 text-lg font-black leading-tight">{form.title}</h2></div><div className="rounded-xl bg-blue-600 p-2.5 print:text-white"><ShieldCheck size={20} /></div></div>
                <p className="mt-4 text-xs text-slate-300 print:text-zinc-500">Plano {getPreventiveTemplate(form.templateId).shortName} · validade de {form.validityDays} dias</p>
              </div>
              <div className="space-y-5 p-5 text-xs">
                <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60 print:border print:bg-white">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Preparado para</p><p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">{selectedClient?.name || "Selecione o cliente"}</p><p className="mt-1 text-zinc-500">{selectedAddress ? `${selectedAddress.street}, ${selectedAddress.number} — ${selectedAddress.city}/${selectedAddress.state}` : "Endereço de execução pendente"}</p>{selectedContact ? <p className="mt-1 text-zinc-500">A/C {selectedContact.name}</p> : selectedClient && <p className="mt-1 text-zinc-500">Contato: {selectedClient.email || selectedClient.phone}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ icon: CalendarClock, label: "Periodicidade", value: form.frequency }, { icon: Clock3, label: "Carga por visita", value: `${form.durationHours}h · ${form.technicians} técnico(s)` }, { icon: Wrench, label: "Ativos", value: `${selectedEquipments.length} equipamento(s)` }, { icon: PackageCheck, label: "Atividades", value: `${form.scope.length} no checklist` }].map((item) => <div key={item.label} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"><item.icon size={14} className="mb-2 text-blue-600" /><p className="text-[9px] font-bold uppercase text-zinc-400">{item.label}</p><p className="mt-0.5 font-black text-zinc-800 dark:text-zinc-100">{item.value}</p></div>)}
                </div>
                <div><p className="mb-2 font-black text-zinc-900 dark:text-white">Escopo selecionado</p><div className="max-h-48 space-y-1.5 overflow-y-auto print:max-h-none print:overflow-visible">{form.scope.slice(0, 12).map((item) => <div key={item.id} className="flex items-start gap-2 text-zinc-600 dark:text-zinc-300"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" /><span>{item.label}</span></div>)}{form.scope.length > 12 && <p className="font-bold text-blue-600">+ {form.scope.length - 12} atividades adicionais</p>}</div></div>
                <div><p className="mb-2 font-black text-zinc-900 dark:text-white">Entregas</p>{form.deliverables.map((item) => <p key={item} className="mb-1 text-zinc-500">• {item}</p>)}</div>
                <div className="rounded-xl bg-blue-600 p-4 text-white print:border-2 print:border-blue-600 print:bg-white print:text-blue-800">
                  <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-blue-100 print:text-blue-600">Investimento anual</p><p className="mt-1 text-xl font-black">{formatCurrency(Math.max(total, 0))}</p></div><div className="text-right"><p className="text-[9px] text-blue-100 print:text-blue-600">Equivalente mensal</p><p className="font-black">{formatCurrency(Math.max(monthlyEquivalent, 0))}</p></div></div>
                  <div className="mt-3 border-t border-white/20 pt-3 text-[10px] text-blue-100 print:text-blue-700">{form.visitsPerYear} visita(s) · SLA de {form.slaHours}h · início {form.startDate ? formatDate(new Date(`${form.startDate}T12:00:00`)) : "a definir"}</div>
                </div>
                {lastCreated && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 font-bold text-emerald-700"><CheckCircle2 size={16} /> Salva como {lastCreated.code}</div>}
                <div className="print:hidden grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Visualizar impressão</Button>
                  <Button onClick={() => void saveProposal()} loading={saving}><FileText size={15} /> Criar proposta</Button>
                </div>
                {lastCreated && <Button className="print:hidden w-full" variant="success" onClick={() => openTab("orcamentos", lastCreated.code, { id: lastCreated.id })}>Abrir para enviar/aprovar <ChevronRight size={15} /></Button>}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
