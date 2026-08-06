"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { getQuotes, getQuoteDetails, createQuote, updateQuote, approveAndConvertQuote, updateQuoteStatus, getQuoteCatalog, registerCatalogItem, getClientItemHistory, ClientItemHistoryDTO, QuoteItemInput } from "@/app/actions/quoteActions";
import { addClientAddress, consultarCNPJAction, createClient, getClientDetails, getClients, syncClientFromCNPJ, ClientDetailsDTO, ClientDTO } from "@/app/actions/clientActions";
import { isStaleServerActionError, preserveFormDraft, takePreservedFormDraft } from "@/lib/actionRecovery";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { CatalogSearchOption, CatalogSearchPicker } from "../ui/CatalogSearchPicker";
import { Search, Loader2, FileText, Plus, CheckCircle, XCircle, Printer, PlusCircle, Trash2, Award, ArrowLeft, Save, Sparkles, Edit, UserPlus, Building2, MapPin, ContactRound, Wrench, Package, BookOpen, BadgeDollarSign, Clock3, TrendingUp, Send, Mail, CircleDollarSign, ChevronRight, CalendarDays, SlidersHorizontal, BriefcaseBusiness } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import { getCompanyTaxProfile } from "@/app/actions/settingsActions";
import { calculateProposalTax, TaxProfile } from "@/lib/tax";
import { SendQuoteEmailModal } from "@/components/quotes/SendQuoteEmailModal";

interface OrcamentosTabProps {
  newRecord?: boolean;
  requestId?: string;
  clientId?: string;
  quoteId?: string;
}

const preferredAddress = (details: ClientDetailsDTO) => {
  const priorities = ["principal", "execução", "execucao", "sede", "cadastral"];
  return details.addresses.find((address) => {
    const label = (address.label || "").toLowerCase();
    return priorities.some((priority) => label.includes(priority));
  }) || details.addresses[0] || null;
};

const preferredContact = (details: ClientDetailsDTO) =>
  details.contacts.find((contact) => contact.isApproval)
  || details.contacts.find((contact) => contact.isTechnical)
  || details.contacts[0]
  || null;

const QUOTE_REFERENCE_TIME = Date.now();
const QUICK_CLIENT_DRAFT_KEY = "nx_quote_quick_client_draft";

export default function OrcamentosTab({ newRecord = false, requestId, clientId, quoteId }: OrcamentosTabProps) {
  const pathname = usePathname();
  const { hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [sortMode, setSortMode] = useState("RECENTES");
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Toggle view state: "list" vs "create" vs "edit"
  const [view, setView] = useState<"list" | "create" | "edit">(newRecord ? "create" : "list");

  // Selected Quote for detailed print preview
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteId || null);
  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);
  const [quotePendingApproval, setQuotePendingApproval] = useState<any | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  useEffect(() => {
    setView(newRecord ? "create" : "list");
  }, [newRecord, requestId]);

  // Loaded Catalog of items (Products & Services)
  const [catalog, setCatalog] = useState<{ products: any[]; services: any[] }>({ products: [], services: [] });
  const [clientItemHistory, setClientItemHistory] = useState<ClientItemHistoryDTO[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientDetailsDTO | null>(null);

  const emptyQuickClient = {
    name: "",
    socialName: "",
    fancyName: "",
    cpfCnpj: "",
    email: "",
    phone: "",
    whatsapp: "",
    segment: "",
    origin: "Orçamento",
    notes: "",
    address: {
      label: "Endereço de execução",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
      reference: "",
    },
  };
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState(emptyQuickClient);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjSyncLoading, setCnpjSyncLoading] = useState(false);
  const [taxProfile, setTaxProfile] = useState<TaxProfile>({ regime: "SIMPLES_NACIONAL", rate: 6, label: "Simples Nacional", configured: false });

  useEffect(() => {
    const draft = takePreservedFormDraft<typeof quickClientForm>(QUICK_CLIENT_DRAFT_KEY);
    if (!draft) return;
    setQuickClientForm(draft);
    setIsQuickClientOpen(true);
    toast("O cadastro do cliente foi recuperado após a atualização do ERP. Confira e salve novamente.", "info");
  }, [toast]);

  useEffect(() => {
    getCompanyTaxProfile().then(setTaxProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (clientId && clients.some((client) => client.id === clientId)) {
      setNewQuoteForm((current) => ({ ...current, clientId, addressId: "", contactId: "" }));
      setClientSearch("");
    }
  }, [clientId, clients]);

  // Adhoc Item Creator Modal States
  const [isAdhocOpen, setIsAdhocOpen] = useState(false);
  const [adhocForm, setAdhocForm] = useState({
    type: "SERVICO",
    name: "",
    description: "",
    category: "MANUTENCAO",
    maintenanceType: "CORRETIVA",
    price: "",
    cost: "",
    unit: "SERVIÇO",
    estimatedHours: "",
    productType: "MATERIAL",
    stockQuantity: "0",
    minStock: "0",
  });
  const [adhocActiveRowIdx, setAdhocActiveRowIdx] = useState<number | null>(null);

  // Loaded Company Profile
  const [companyParams] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("company_params");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            differentials: "Profissionais qualificados\nPeças e materiais de qualidade\nAtendimento ágil e personalizado\nGarantia nos serviços realizados",
            merchanTitle: "AQUI É O SEU ESPAÇO!",
            merchanDesc: "Mais destaque, mais resultados para o seu negócio.",
            ...parsed,
          };
        } catch (e) {
          console.error(e);
        }
      }
    }
    return {
      corporateName: "NEXUS CLIMATIZACAO LTDA",
      tradeName: "Nexus Ar Condicionado",
      cnpj: "12.345.678/0001-99",
      municipalRegistration: "1.234.567-8",
      stateRegistration: "111.222.333.444",
      email: "diretoria@nexusclimatizacao.com.br",
      phone: "(11) 4002-8922",
      address: "Avenida Paulista, 1000 - Bela Vista - São Paulo / SP",
      logoUrl: "", // Base64 uploader
      differentials: "Profissionais qualificados\nPeças e materiais de qualidade\nAtendimento ágil e personalizado\nGarantia nos serviços realizados",
      merchanTitle: "AQUI É O SEU ESPAÇO!",
      merchanDesc: "Mais destaque, mais resultados para o seu negócio.",
    };
  });

  // Creation State
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [newQuoteForm, setNewQuoteForm] = useState({
    clientId: "",
    addressId: "",
    contactId: "",
    validityDays: 15,
    warrantyDays: 90,
    executionTerm: "A combinar",
    paymentTerms: "Boleto / Pix / Transferência (30 dias)",
    notes: "Estaremos sempre à disposição para melhor atendê-los!",
    discount: 0,
    tax: 0,
  });

  const [quoteItems, setQuoteItems] = useState<QuoteItemInput[]>([
    { type: "SERVICO", description: "", quantity: 1, unit: "SERVIÇO", unitPrice: 0, costPrice: 0, discount: 0 },
  ]);

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await getQuotes();
      setQuotes(data);
      if (data.length > 0 && !selectedQuoteId) {
        setSelectedQuoteId(data[0].id);
      }

      const cls = await getClients();
      setClients(cls);
      // Fetch pre-saved products and services
      const cat = await getQuoteCatalog();
      setCatalog(cat);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar propostas", "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetails(id: string) {
    setLoadingDetails(true);
    try {
      const details = await getQuoteDetails(id);
      setQuoteDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    if (pathname !== "/orcamentos") return;
    const timer = window.setTimeout(() => void loadQuotes(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/orcamentos") return;
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get("gmail");
    if (!gmailResult) return;
    if (gmailResult === "connected") toast("Gmail conectado ao ERP com sucesso.", "success");
    else if (gmailResult === "not_configured") toast("Informe as credenciais OAuth do Google no servidor.", "warning");
    else toast(params.get("reason") || "Não foi possível conectar o Gmail.", "error");
    params.delete("gmail");
    params.delete("reason");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [pathname, toast]);

  useEffect(() => {
    if (selectedQuoteId) {
      fetchDetails(selectedQuoteId);
    } else {
      setQuoteDetails(null);
    }
  }, [selectedQuoteId]);

  // Ao selecionar o cliente, endereço e contato principal são resolvidos sem
  // uma segunda etapa manual. Cadastros com CNPJ e sem endereço são
  // enriquecidos automaticamente antes de continuar.
  useEffect(() => {
    if (!newQuoteForm.clientId || (view !== "create" && view !== "edit")) {
      setClientItemHistory([]);
      setSelectedClientDetails(null);
      return;
    }
    let cancelled = false;
    const resolveClient = async () => {
      try {
        const [history, initialDetails] = await Promise.all([
          getClientItemHistory(newQuoteForm.clientId),
          getClientDetails(newQuoteForm.clientId),
        ]);
        let details = initialDetails;
        const document = details?.cpfCnpj?.replace(/\D/g, "") || "";

        if (details && !details.addresses.length && document.length === 14) {
          setCnpjSyncLoading(true);
          const synced = await syncClientFromCNPJ(details.id);
          if (synced.success) {
            const [refreshedDetails, refreshedClients] = await Promise.all([
              getClientDetails(details.id),
              getClients(),
            ]);
            details = refreshedDetails;
            if (!cancelled) setClients(refreshedClients);
          }
        }

        if (cancelled) return;
        setClientItemHistory(history);
        setSelectedClientDetails(details);
        if (details) {
          const address = preferredAddress(details);
          const contact = preferredContact(details);
          setClientSearch(details.name);
          setNewQuoteForm((prev) => ({
            ...prev,
            addressId: details!.addresses.some((item) => item.id === prev.addressId)
              ? prev.addressId
              : address?.id || "",
            contactId: details!.contacts.some((item) => item.id === prev.contactId)
              ? prev.contactId
              : contact?.id || "",
          }));
        }
      } catch {
        if (!cancelled) {
          setClientItemHistory([]);
          setSelectedClientDetails(null);
        }
      } finally {
        if (!cancelled) setCnpjSyncLoading(false);
      }
    };
    void resolveClient();
    return () => { cancelled = true; };
  }, [newQuoteForm.clientId, view]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase().replace(/\D/g, "");
    const textTerm = clientSearch.trim().toLowerCase();
    if (!textTerm) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().includes(textTerm) ||
      (client.fancyName || "").toLowerCase().includes(textTerm) ||
      (client.socialName || "").toLowerCase().includes(textTerm) ||
      (!!term && Boolean(client.cpfCnpj?.replace(/\D/g, "").includes(term)))
    );
  }, [clients, clientSearch]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    setNewQuoteForm((prev) => ({ ...prev, clientId, addressId: "", contactId: "" }));
    setClientSearch(client?.name || "");
    setClientPickerOpen(false);
  };

  const handleCnpjLookup = async () => {
    const document = quickClientForm.cpfCnpj.replace(/\D/g, "");
    if (document.length !== 14) {
      toast(document.length === 11 ? "Para CPF, preencha os dados manualmente." : "Informe um CNPJ com 14 dígitos.", "warning");
      return;
    }
    setCnpjLoading(true);
    try {
      const result = await consultarCNPJAction(document);
      if (!result.success || !result.data) {
        toast(result.error || "CNPJ não encontrado", "warning");
        return;
      }
      setQuickClientForm((prev) => ({
        ...prev,
        cpfCnpj: result.data!.cnpj,
        name: result.data!.tradeName || result.data!.corporateName,
        socialName: result.data!.corporateName,
        fancyName: result.data!.tradeName,
        email: result.data!.email,
        phone: result.data!.phone,
        notes: result.data!.address ? `Endereço Receita Federal: ${result.data!.address}` : prev.notes,
        address: result.data!.addressDetails ? {
          ...prev.address,
          ...result.data!.addressDetails,
        } : prev.address,
      }));
      toast("Dados do CNPJ preenchidos. Confira antes de salvar.", "success");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleQuickClientSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const document = quickClientForm.cpfCnpj.replace(/\D/g, "");
    if (quickClientForm.phone.replace(/\D/g, "").length < 8) {
      toast("Informe pelo menos 8 números no telefone. O cliente ainda não foi salvo.", "warning");
      return;
    }
    const hasAddress = Boolean(quickClientForm.address.street.trim());
    if (hasAddress && (!quickClientForm.address.number.trim() || !quickClientForm.address.neighborhood.trim() || !quickClientForm.address.city.trim() || quickClientForm.address.state.trim().length !== 2 || !quickClientForm.address.cep.trim())) {
      toast("Complete número, bairro, cidade, UF e CEP do endereço de execução.", "warning");
      return;
    }
    setActionLoading(true);
    try {
      const result = await createClient({
        name: quickClientForm.name.trim(),
        socialName: quickClientForm.socialName.trim() || undefined,
        fancyName: quickClientForm.fancyName.trim() || undefined,
        cpfCnpj: document,
        email: quickClientForm.email.trim(),
        phone: quickClientForm.phone.trim(),
        whatsapp: quickClientForm.whatsapp.trim() || undefined,
        segment: quickClientForm.segment.trim() || undefined,
        origin: quickClientForm.origin,
        notes: quickClientForm.notes.trim() || undefined,
      });
      if (!result.success || !result.client) {
        if (result.existingClient) {
          const [refreshedClients, details] = await Promise.all([
            getClients(),
            getClientDetails(result.existingClient.id),
          ]);
          const address = details ? preferredAddress(details) : null;
          const contact = details ? preferredContact(details) : null;
          setClients(refreshedClients);
          setNewQuoteForm((prev) => ({
            ...prev,
            clientId: result.existingClient!.id,
            addressId: address?.id || "",
            contactId: contact?.id || "",
          }));
          setSelectedClientDetails(details);
          setClientSearch(result.existingClient.name);
          setQuickClientForm(emptyQuickClient);
          setIsQuickClientOpen(false);
          toast(`${result.existingClient.name} já estava cadastrado e foi selecionado no orçamento.`, "info");
          return;
        }
        toast(result.error || "Não foi possível cadastrar o cliente", "error");
        return;
      }

      let addressId = "";
      if (hasAddress) {
        const addressResult = await addClientAddress({
          clientId: result.client.id,
          ...quickClientForm.address,
        });
        if (addressResult.success && addressResult.address) {
          addressId = addressResult.address.id;
        } else {
          toast(`Cliente criado, mas o endereço não foi salvo: ${addressResult.error}`, "warning");
        }
      }

      const refreshedClients = await getClients();
      setClients(refreshedClients);
      setNewQuoteForm((prev) => ({ ...prev, clientId: result.client!.id, addressId, contactId: "" }));
      const details = await getClientDetails(result.client.id);
      setSelectedClientDetails(details);
      setClientSearch(result.client.name);
      setQuickClientForm(emptyQuickClient);
      setIsQuickClientOpen(false);
      toast("Cliente cadastrado e selecionado no orçamento.", "success");
    } catch (error) {
      console.error(error);
      if (isStaleServerActionError(error)) {
        preserveFormDraft(QUICK_CLIENT_DRAFT_KEY, quickClientForm);
        toast("O ERP recebeu uma atualização. Seus dados foram preservados e a tela será recarregada.", "warning");
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }
      toast(error instanceof Error ? error.message : "Erro de conexão ao cadastrar o cliente.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddItem = (type: "SERVICO" | "PECAS" = "SERVICO") => {
    setQuoteItems((currentItems) => [
      ...currentItems,
      { type, description: "", quantity: 1, unit: type === "SERVICO" ? "SERVIÇO" : "UN", unitPrice: 0, costPrice: 0, discount: 0 },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (quoteItems.length === 1) return;
    setQuoteItems((currentItems) => currentItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof QuoteItemInput, value: any) => {
    setQuoteItems((currentItems) =>
      currentItems.map((item, i) => {
        if (i !== idx) return item;
        return {
          ...item,
          [field]: field === "type" || field === "unit" || field === "description" ? value : parseFloat(value) || 0,
        };
      })
    );
  };

  const handleItemTypeChange = (idx: number, type: "SERVICO" | "PECAS") => {
    setQuoteItems((currentItems) =>
      currentItems.map((item, i) => {
        if (i !== idx || item.type === type) return item;

        return {
          ...item,
          type,
          description: "",
          unit: type === "SERVICO" ? "SERVIÇO" : "UN",
          unitPrice: 0,
          costPrice: 0,
          discount: 0,
        };
      })
    );
  };

  const handleCatalogSelect = (idx: number, itemName: string, type: string) => {
    if (!itemName) {
      setQuoteItems(
        quoteItems.map((item, i) => {
          if (i !== idx) return item;
          return {
            ...item,
            description: "",
            unitPrice: 0,
            costPrice: 0,
            unit: type === "SERVICO" ? "SERVIÇO" : "UN",
          };
        })
      );
      return;
    }

    // Se este cliente já comprou este item antes, o preço e a quantidade
    // realmente praticados com ele são um palpite melhor que o padrão do catálogo.
    const history = clientItemHistory.find((h) => h.description === itemName);

    if (type === "SERVICO") {
      const match = catalog.services.find((s) => s.name === itemName);
      if (match) {
        setQuoteItems(
          quoteItems.map((item, i) => {
            if (i !== idx) return item;
            return {
              ...item,
              description: match.name,
              unitPrice: history?.lastUnitPrice ?? match.defaultPrice,
              quantity: history ? Math.max(1, Math.round(history.avgQuantity)) : item.quantity,
              unit: (match.billingUnit || "SERVIÇO").toUpperCase(),
            };
          })
        );
      }
    } else {
      const match = catalog.products.find((p) => p.name === itemName);
      if (match) {
        setQuoteItems(
          quoteItems.map((item, i) => {
            if (i !== idx) return item;
            return {
              ...item,
              description: match.name,
              unitPrice: history?.lastUnitPrice ?? match.salePrice,
              quantity: history ? Math.max(1, Math.round(history.avgQuantity)) : item.quantity,
              costPrice: match.costPrice || 0,
              unit: match.unit || "UN",
            };
          })
        );
      }
    }
  };

  const openAdhocModal = (idx: number, type: string, suggestedName = "") => {
    setAdhocActiveRowIdx(idx);
    const isMaterial = type === "PECAS";
    setAdhocForm({
      type: isMaterial ? "PECAS" : "SERVICO",
      name: suggestedName,
      description: "",
      category: isMaterial ? "INSUMO" : "MANUTENCAO",
      maintenanceType: "CORRETIVA",
      price: "",
      cost: "",
      unit: isMaterial ? "UN" : "SERVIÇO",
      estimatedHours: "",
      productType: "MATERIAL",
      stockQuantity: "0",
      minStock: "0",
    });
    setIsAdhocOpen(true);
  };

  const handleSaveAdhoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adhocForm.name || !adhocForm.price) {
      toast("Nome e preço são obrigatórios", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await registerCatalogItem({
        type: adhocForm.type,
        name: adhocForm.name,
        price: parseFloat(adhocForm.price) || 0,
        cost: adhocForm.cost ? parseFloat(adhocForm.cost) : undefined,
        unit: adhocForm.unit,
        description: adhocForm.description || undefined,
        category: adhocForm.category || undefined,
        maintenanceType: adhocForm.type === "SERVICO" ? adhocForm.maintenanceType : undefined,
        estimatedHours: adhocForm.estimatedHours ? parseFloat(adhocForm.estimatedHours) : undefined,
        productType: adhocForm.type === "PECAS" ? adhocForm.productType : undefined,
        stockQuantity: adhocForm.type === "PECAS" ? parseFloat(adhocForm.stockQuantity) || 0 : undefined,
        minStock: adhocForm.type === "PECAS" ? parseFloat(adhocForm.minStock) || 0 : undefined,
      });

      if (res.success && res.item) {
        toast(`${res.item.type === "SERVICO" ? "Serviço" : "Material"} salvo individualmente no catálogo.`, "success");

        // Reload catalog
        const cat = await getQuoteCatalog();
        setCatalog(cat);

        // Auto fill on active row
        if (adhocActiveRowIdx !== null) {
          setQuoteItems(
            quoteItems.map((item, i) => {
              if (i !== adhocActiveRowIdx) return item;
              return {
                ...item,
                type: res.item.type === "SERVICO" ? "SERVICO" : "PECAS",
                description: res.item.name,
                unitPrice: res.item.price,
                costPrice: res.item.costPrice || 0,
                unit: res.item.unit || "UN",
              };
            })
          );
        }

        setIsAdhocOpen(false);
      } else {
        toast(res.error || "Erro ao registrar no catálogo", "error");
      }
    } catch (err) {
      toast("Erro de rede ao salvar item", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEdit = (quote: any) => {
    const vDays = quote.validUntil && quote.createdAt
      ? Math.max(1, Math.round((new Date(quote.validUntil).getTime() - new Date(quote.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 15;

    setNewQuoteForm({
      clientId: quote.clientId,
      addressId: quote.addressId || "",
      contactId: quote.contactId || "",
      validityDays: vDays,
      warrantyDays: quote.warrantyDays || 90,
      executionTerm: quote.executionTerm || "A combinar",
      paymentTerms: quote.paymentTerms || "Boleto / Pix / Transferência (30 dias)",
      notes: quote.notes || "Estaremos sempre à disposição para melhor atendê-los!",
      discount: quote.discount || 0,
      tax: quote.tax || 0,
    });

    setQuoteItems(
      quote.items && quote.items.length > 0
        ? quote.items.map((item: any) => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || "UN",
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0,
          }))
        : [{ type: "SERVICO", description: "", quantity: 1, unit: "SERVIÇO", unitPrice: 0, costPrice: 0, discount: 0 }]
    );

    setEditingQuoteId(quote.id);
    setView("edit");
  };

  const handleUpdateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuoteId) return;

    if (!newQuoteForm.clientId) {
      toast("Selecione um cliente", "warning");
      return;
    }

    const invalid = quoteItems.some(i => !i.description);
    if (invalid) {
      toast("Preencha ou selecione a descrição de todos os itens do orçamento", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await updateQuote(
        editingQuoteId,
        {
          clientId: newQuoteForm.clientId,
          addressId: newQuoteForm.addressId || undefined,
          contactId: newQuoteForm.contactId || undefined,
          notes: newQuoteForm.notes || undefined,
          validityDays: Number(newQuoteForm.validityDays) || 15,
          warrantyDays: Number(newQuoteForm.warrantyDays) || 90,
          executionTerm: newQuoteForm.executionTerm,
          paymentTerms: newQuoteForm.paymentTerms,
          discount: Number(newQuoteForm.discount) || 0,
          tax: liveTotals.tax,
        },
        quoteItems,
        currentUser?.id || ""
      );

      if (res.success && res.quote) {
        toast("Proposta comercial atualizada com sucesso!", "success");
        setQuoteItems([
          { type: "SERVICO", description: "", quantity: 1, unit: "SERVIÇO", unitPrice: 0, costPrice: 0, discount: 0 }
        ]);
        setNewQuoteForm({
          clientId: clients[0]?.id || "",
          addressId: "",
          contactId: "",
          validityDays: 15,
          warrantyDays: 90,
          executionTerm: "A combinar",
          paymentTerms: "Boleto / Pix / Transferência (30 dias)",
          notes: "Estaremos sempre à disposição para melhor atendê-los!",
          discount: 0,
          tax: 0,
        });
        setSelectedQuoteId(res.quote.id);
        setQuoteDetails(res.quote as any);
        setEditingQuoteId(null);
        setView("list");
        loadQuotes();
      } else {
        toast(res.error || "Erro ao atualizar orçamento", "error");
      }
    } catch (err) {
      toast("Erro ao salvar dados", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteForm.clientId) {
      toast("Selecione um cliente", "warning");
      return;
    }

    // Verify descriptions are filled
    const invalid = quoteItems.some(i => !i.description);
    if (invalid) {
      toast("Preencha ou selecione a descrição de todos os itens do orçamento", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const res = await createQuote(
        {
          clientId: newQuoteForm.clientId,
          addressId: newQuoteForm.addressId || undefined,
          contactId: newQuoteForm.contactId || undefined,
          notes: newQuoteForm.notes || undefined,
          validityDays: Number(newQuoteForm.validityDays) || 15,
          warrantyDays: Number(newQuoteForm.warrantyDays) || 90,
          executionTerm: newQuoteForm.executionTerm,
          paymentTerms: newQuoteForm.paymentTerms,
          discount: Number(newQuoteForm.discount) || 0,
          tax: liveTotals.tax,
        },
        quoteItems,
        currentUser?.id || ""
      );

      if (res.success && res.quote) {
        toast("Proposta comercial criada com sucesso!", "success");
        setQuoteItems([
          { type: "SERVICO", description: "", quantity: 1, unit: "SERVIÇO", unitPrice: 0, costPrice: 0, discount: 0 }
        ]);
        setNewQuoteForm({
          clientId: clients[0]?.id || "",
          addressId: "",
          contactId: "",
          validityDays: 15,
          warrantyDays: 90,
          executionTerm: "A combinar",
          paymentTerms: "Boleto / Pix / Transferência (30 dias)",
          notes: "Estaremos sempre à disposição para melhor atendê-los!",
          discount: 0,
          tax: 0,
        });
        setSelectedQuoteId(res.quote.id);
        setView("list");
        loadQuotes();
      } else {
        toast(res.error || "Erro ao criar orçamento", "error");
      }
    } catch (err) {
      toast("Erro ao salvar dados", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (quoteId: string) => {
    setActionLoading(true);
    try {
      const res = await approveAndConvertQuote(quoteId, currentUser?.id || "");
      if (res.success) {
        setQuotePendingApproval(null);
        toast("Orçamento aprovado! OS de manutenção criada com sucesso.", "success");
        loadQuotes();
        openTab("ordens-servico", "Ordens de Serviço");
      } else {
        toast(res.error || "Erro ao aprovar proposta", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (quoteId: string) => {
    setActionLoading(true);
    try {
      const res = await updateQuoteStatus(quoteId, "REJEITADO", currentUser?.id || "", "Proposta recusada pelo cliente.");
      if (res.success) {
        toast("Orçamento marcado como Rejeitado", "info");
        loadQuotes();
      } else {
        toast(res.error || "Erro ao alterar status", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const printPageSize = "A4 portrait";
  const previewWidth = "210mm";

  const normalizeQuoteStatus = (status?: string) => (status || "RASCUNHO").toUpperCase().replaceAll(" ", "_");
  const isQuoteExpired = (quote: any) => {
    const status = normalizeQuoteStatus(quote.status);
    if (["APROVADO", "CONVERTIDO", "REJEITADO", "REPROVADO", "CANCELADO"].includes(status)) return false;
    return quote.validUntil ? new Date(quote.validUntil).getTime() < QUOTE_REFERENCE_TIME : false;
  };
  const quoteMatchesFilter = (quote: any) => {
    const status = normalizeQuoteStatus(quote.status);
    if (statusFilter === "TODOS") return true;
    if (statusFilter === "RASCUNHOS") return status === "RASCUNHO";
    if (statusFilter === "EM_ANDAMENTO") return ["ENVIADO", "PENDENTE", "NEGOCIACAO", "EM_NEGOCIACAO"].includes(status) && !isQuoteExpired(quote);
    if (statusFilter === "APROVADOS") return ["APROVADO", "CONVERTIDO"].includes(status);
    if (statusFilter === "EXPIRADOS") return isQuoteExpired(quote) || ["EXPIRADO", "REJEITADO", "REPROVADO", "CANCELADO"].includes(status);
    return true;
  };
  const filteredQuotes = quotes
    .filter((q) => (
      (q.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.code || "").toLowerCase().includes(search.toLowerCase())
    ) && quoteMatchesFilter(q))
    .sort((a, b) => {
      if (sortMode === "MAIOR_VALOR") return Number(b.total || 0) - Number(a.total || 0);
      if (sortMode === "MENOR_VALOR") return Number(a.total || 0) - Number(b.total || 0);
      if (sortMode === "VALIDADE") return new Date(a.validUntil || 0).getTime() - new Date(b.validUntil || 0).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const openQuoteStatuses = ["RASCUNHO", "ENVIADO", "PENDENTE", "NEGOCIACAO", "EM_NEGOCIACAO"];
  const openQuotes = quotes.filter((quote) => openQuoteStatuses.includes(normalizeQuoteStatus(quote.status)) && !isQuoteExpired(quote));
  const approvedQuotes = quotes.filter((quote) => ["APROVADO", "CONVERTIDO"].includes(normalizeQuoteStatus(quote.status)));
  const draftQuotes = quotes.filter((quote) => normalizeQuoteStatus(quote.status) === "RASCUNHO");
  const expiredQuotes = quotes.filter((quote) => isQuoteExpired(quote) || ["EXPIRADO", "REJEITADO", "REPROVADO"].includes(normalizeQuoteStatus(quote.status)));
  const openPipelineValue = openQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
  const approvedValue = approvedQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
  const conversionRate = quotes.length ? Math.round((approvedQuotes.length / quotes.length) * 100) : 0;

  const canApproveQuote = (status?: string) => ["RASCUNHO", "ENVIADO", "PENDENTE", "NEGOCIACAO", "EM_NEGOCIACAO", "EM NEGOCIAÇÃO"].includes((status || "").toUpperCase());

  const requestQuoteApproval = async (quote: any) => {
    if (quote.items && quote.client) {
      setQuotePendingApproval(quote);
      return;
    }
    setActionLoading(true);
    try {
      const details = await getQuoteDetails(quote.id);
      if (details) setQuotePendingApproval(details);
      else toast("Não foi possível carregar os dados do orçamento.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Live Totals Calculation during quote creation
  const getCreationTotals = () => {
    let subtotal = 0;
    quoteItems.forEach((item) => {
      subtotal += item.quantity * item.unitPrice;
    });

    const discount = Number(newQuoteForm.discount) || 0;
    const calculation = calculateProposalTax(subtotal, discount, taxProfile.rate);
    return { subtotal, tax: calculation.tax, total: calculation.total, calculatedTax: calculation.tax };
  };

  const liveTotals = getCreationTotals();

  // Dynamic computed fields for printed proposal sheet
  const validityDays = quoteDetails?.validUntil && quoteDetails?.createdAt
    ? Math.max(1, Math.round((new Date(quoteDetails.validUntil).getTime() - new Date(quoteDetails.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 15;

  let clientAddressStr = "Não informado";
  if (quoteDetails?.client?.addresses?.[0]) {
    const addr = quoteDetails.client.addresses[0];
    clientAddressStr = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""} - ${addr.neighborhood} - ${addr.city}/${addr.state}`;
  } else if (quoteDetails?.client?.notes) {
    const match = quoteDetails.client.notes.match(/Endereço Receita Federal:\s*(.+)/i);
    if (match && match[1]) {
      clientAddressStr = match[1].split("\n")[0].trim();
    }
  }

  const itemLineWidth = 54;
  const estimatedItemLines = (quoteDetails?.items || []).reduce((lines: number, item: any) => (
    lines + Math.max(1, Math.ceil(String(item.description || "").length / itemLineWidth))
  ), 0);
  const estimatedTextLines = Math.ceil(String(quoteDetails?.notes || "").length / itemLineWidth)
    + Math.ceil(clientAddressStr.length / itemLineWidth)
    + Math.ceil(String(companyParams.merchanDesc || "").length / itemLineWidth);
  const estimatedDocumentHeightPx = 700 + (estimatedItemLines * 31) + (estimatedTextLines * 14);
  const availableDocumentHeightPx = 277 * 3.7795;
  const onePageScale = Math.max(0.3, Math.min(1, (availableDocumentHeightPx / estimatedDocumentHeightPx) * 0.94));
  const onePageWidth = 100 / onePageScale;

  const handlePrint = async () => {
    const source = document.querySelector<HTMLElement>(".print-a4-sheet");
    if (!source) {
      toast("Não foi possível preparar o orçamento para impressão.", "error");
      return;
    }

    const frame = document.createElement("iframe");
    frame.setAttribute("title", "Impressão do orçamento em folha A4");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "210mm";
    frame.style.height = "297mm";
    frame.style.border = "0";
    document.body.appendChild(frame);

    try {
      const printDocument = frame.contentDocument;
      if (!printDocument) throw new Error("Documento de impressão indisponível.");
      const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
        .map((element) => element.outerHTML)
        .join("\n");
      printDocument.open();
      printDocument.write(`<!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>Orçamento ${quoteDetails?.code || ""}</title>
            ${styles}
            <style>
              @page { size: A4 portrait; margin: 0; }
              html, body {
                width: 210mm !important;
                height: 296mm !important;
                min-width: 210mm !important;
                min-height: 296mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                background: white !important;
              }
              .a4-page {
                width: 210mm;
                height: 296mm;
                padding: 7mm 8mm;
                box-sizing: border-box;
                overflow: hidden;
                background: white;
                break-after: avoid;
                page-break-after: avoid;
              }
              .proposal-content {
                width: 100%;
                max-width: none;
                margin: 0;
                transform: scale(var(--proposal-scale, 1));
                transform-origin: top left;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .proposal-content .print-a4-sheet {
                position: static !important;
                inset: auto !important;
                width: 100% !important;
                max-width: none !important;
                min-width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                box-shadow: none !important;
                transform: none !important;
                zoom: 1 !important;
                overflow: visible !important;
              }
              .proposal-content .print-a4-sheet > * + * { margin-top: 2.6mm !important; }
              .proposal-content table { table-layout: fixed !important; width: 100% !important; }
              .proposal-content th, .proposal-content td {
                padding: 1.15mm 1.3mm !important;
                line-height: 1.15 !important;
                overflow-wrap: anywhere;
              }
              @media print {
                html, body, .a4-page { width: 210mm !important; height: 296mm !important; overflow: hidden !important; }
              }
            </style>
          </head>
          <body>
            <main class="a4-page">
              <div class="proposal-content">${source.outerHTML}</div>
            </main>
          </body>
        </html>`);
      printDocument.close();

      if (printDocument.readyState !== "complete") {
        await new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
      }
      if (printDocument.fonts?.ready) await printDocument.fonts.ready;
      const images = Array.from(printDocument.images);
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }
        try { if (image.decode && image.naturalWidth) await image.decode(); } catch {}
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const page = printDocument.querySelector<HTMLElement>(".a4-page");
      const content = printDocument.querySelector<HTMLElement>(".proposal-content");
      if (!page || !content) throw new Error("Estrutura A4 não foi criada.");
      const pageStyle = frame.contentWindow?.getComputedStyle(page);
      const horizontalPadding = parseFloat(pageStyle?.paddingLeft || "0") + parseFloat(pageStyle?.paddingRight || "0");
      const verticalPadding = parseFloat(pageStyle?.paddingTop || "0") + parseFloat(pageStyle?.paddingBottom || "0");
      const availableWidth = page.clientWidth - horizontalPadding - 2;
      const availableHeight = page.clientHeight - verticalPadding - 2;
      const contentWidth = Math.max(content.scrollWidth, content.getBoundingClientRect().width);
      const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
      const exactScale = Math.max(0.2, Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight) * 0.985);
      content.style.setProperty("--proposal-scale", exactScale.toFixed(5));

      const cleanup = () => frame.remove();
      frame.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
      window.setTimeout(cleanup, 120_000);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch (error) {
      frame.remove();
      toast(error instanceof Error ? error.message : "Erro ao gerar orçamento em A4.", "error");
    }
  };

  const automaticAddress = selectedClientDetails ? preferredAddress(selectedClientDetails) : null;
  const automaticContact = selectedClientDetails ? preferredContact(selectedClientDetails) : null;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200 print:p-0 print:m-0 print:bg-white">

      {/* Print layout follows the paper selected in the browser/printer. */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: ${printPageSize};
            margin: 10mm;
          }
          html,
          body {
            width: auto !important;
            min-width: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: #18181b !important;
          }
          main,
          main > div,
          .quote-print-layout,
          .quote-print-column {
            position: static !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .quote-print-layout {
            display: block !important;
          }
          .quote-print-column {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            grid-column: 1 / -1 !important;
          }
          .print-a4-sheet {
            width: ${onePageWidth.toFixed(3)}% !important;
            max-width: ${onePageWidth.toFixed(3)}% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            transform: scale(${onePageScale.toFixed(4)}) !important;
            transform-origin: top left !important;
            zoom: 1 !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            line-height: 1.2 !important;
          }
          .print-a4-sheet * {
            box-sizing: border-box;
          }
          .print-a4-sheet * {
            font-size: max(7pt, 1em) !important;
          }
          .print-a4-sheet > * + * {
            margin-top: 3mm !important;
          }
          .print-a4-sheet h1,
          .print-a4-sheet h2,
          .print-a4-sheet h3,
          .print-keep-together,
          .print-a4-sheet tr {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .print-items-table {
            overflow: visible !important;
            break-inside: auto !important;
          }
          .print-items-table table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          .print-items-table thead {
            display: table-header-group;
          }
          .print-items-table tbody {
            display: table-row-group;
          }
          .print-items-table th,
          .print-items-table td {
            overflow-wrap: anywhere;
            word-break: normal;
          }
          .print-items-table th:nth-child(1) { width: 7% !important; }
          .print-items-table th:nth-child(2) { width: 39% !important; }
          .print-items-table th:nth-child(3) { width: 8% !important; }
          .print-items-table th:nth-child(4) { width: 8% !important; }
          .print-items-table th:nth-child(5),
          .print-items-table th:nth-child(6) { width: 19% !important; }
          .print-items-table th,
          .print-items-table td {
            padding: 1.35mm 1.4mm !important;
            line-height: 1.18 !important;
          }
        }
        @media print and (max-width: 170mm) {
          @page {
            margin: 6mm;
          }
          .print-items-table table {
            font-size: 6.5pt !important;
          }
          .print-a4-sheet * {
            font-size: max(6.25pt, 1em) !important;
          }
          .print-items-table th,
          .print-items-table td {
            padding: 1.4mm 1mm !important;
          }
        }
      `}} />

      {/* 1. DEDICATED FULL-PAGE CREATION VIEW (Non-floating page) */}
      {(view === "create" || view === "edit") && (
        <div className="mx-auto w-full max-w-7xl space-y-6 animate-in slide-in-from-bottom duration-200">
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setView("list")}>
                <ArrowLeft size={16} /> Voltar para Lista
              </Button>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-150 uppercase tracking-wider">
                {view === "edit" ? "Editar Proposta Comercial" : "Nova Proposta Comercial Completa"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setView("list")}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={view === "edit" ? handleUpdateQuote : handleCreateQuote} loading={actionLoading}>
                <Save size={16} /> {view === "edit" ? "Atualizar Orçamento" : "Salvar Orçamento"}
              </Button>
            </div>
          </div>

          {/* Form Layout */}
          <form onSubmit={view === "edit" ? handleUpdateQuote : handleCreateQuote} className="space-y-6">

            {/* Etapa 1: cliente e local de execução */}
            <Card className="space-y-5 shadow-premium border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">1</span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Cliente e atendimento</h3>
                    <p className="text-xs text-zinc-500">Localize um cadastro existente ou crie o cliente sem sair do orçamento.</p>
                  </div>
                </div>
                {hasPermission("clients.write") && (
                  <Button type="button" variant="secondary" onClick={() => setIsQuickClientOpen(true)}>
                    <UserPlus size={15} /> Novo cliente
                  </Button>
                )}
              </div>

              <div className="relative">
                <Input
                  label="Buscar e selecionar cliente *"
                  placeholder="Digite nome, empresa, CPF ou CNPJ"
                  autoComplete="off"
                  value={clientSearch}
                  onFocus={() => setClientPickerOpen(true)}
                  onBlur={() => window.setTimeout(() => setClientPickerOpen(false), 120)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientSearch(value);
                    setClientPickerOpen(true);
                    const selected = clients.find((client) => client.id === newQuoteForm.clientId);
                    if (selected && value !== selected.name) {
                      setNewQuoteForm((prev) => ({ ...prev, clientId: "", addressId: "", contactId: "" }));
                      setSelectedClientDetails(null);
                    }
                  }}
                  icon={<Search size={15} />}
                  aria-expanded={clientPickerOpen}
                  aria-controls="quote-client-results"
                  role="combobox"
                />

                {clientPickerOpen && (
                  <div id="quote-client-results" role="listbox" className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-1.5">
                    {filteredClients.length ? filteredClients.map((client) => {
                      const selected = client.id === newQuoteForm.clientId;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleClientChange(client.id)}
                          className={`w-full flex items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors ${selected ? "bg-primary/10" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{client.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{client.fancyName && client.fancyName !== client.name ? `${client.fancyName} · ` : ""}{client.cpfCnpj || "Documento não informado"} · {client.phone}</p>
                          </div>
                          {selected && <CheckCircle size={17} className="shrink-0 text-success" />}
                        </button>
                      );
                    }) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Nenhum cliente encontrado</p>
                        <p className="text-xs text-zinc-500 mt-1">Revise a busca ou cadastre um novo cliente.</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-zinc-500">{clientSearch ? `${filteredClients.length} cliente(s) encontrado(s)` : `${clients.length} cliente(s) disponíveis`}</p>
              </div>

              {selectedClientDetails ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-white dark:bg-zinc-800 p-2 text-primary shadow-sm"><Building2 size={18} /></div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedClientDetails.name}</p>
                        <p className="text-xs text-zinc-500">{selectedClientDetails.cpfCnpj || "Documento não informado"} · {selectedClientDetails.email} · {selectedClientDetails.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cnpjSyncLoading && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                          <Loader2 size={12} className="animate-spin" /> Completando cadastro
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2.5 py-1 rounded-full">Cliente selecionado</span>
                    </div>
                  </div>

                  {automaticAddress ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-2 rounded-lg border border-primary/10 bg-white/80 p-3 dark:bg-zinc-900/50">
                        <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-success">Endereço aplicado automaticamente</p>
                          <p className="mt-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-250">
                            {automaticAddress.street}, {automaticAddress.number} · {automaticAddress.city}/{automaticAddress.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg border border-primary/10 bg-white/80 p-3 dark:bg-zinc-900/50">
                        <ContactRound size={15} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Contato aplicado automaticamente</p>
                          <p className="mt-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-250">
                            {automaticContact ? `${automaticContact.name}${automaticContact.role ? ` · ${automaticContact.role}` : ""}` : "Dados principais do cliente (sem contato adicional)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : !cnpjSyncLoading ? (
                    <p className="flex items-center gap-2 text-xs text-warning"><MapPin size={14} /> O cliente não possui endereço cadastrado e não foi possível obtê-lo automaticamente.</p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-250 dark:border-zinc-700 p-5 text-center text-xs text-zinc-500">
                  Selecione um cliente para ver seus endereços, contatos e histórico de itens.
                </div>
              )}
            </Card>

            {/* Etapa 2: condições comerciais */}
            <Card className="space-y-5 shadow-premium border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-6">
              <div className="flex items-center gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Prazos e condições comerciais</h3>
                  <p className="text-xs text-zinc-500">Defina validade, garantia, execução e pagamento.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input label="Validade (dias) *" type="number" min={1} required value={newQuoteForm.validityDays} onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, validityDays: Number(e.target.value) || 0 }))} />
                <Input label="Garantia técnica (dias) *" type="number" min={1} required value={newQuoteForm.warrantyDays} onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, warrantyDays: Number(e.target.value) || 0 }))} />
                <Input label="Prazo de execução *" required value={newQuoteForm.executionTerm} onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, executionTerm: e.target.value }))} />
                <Input label="Forma de pagamento *" required value={newQuoteForm.paymentTerms} onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, paymentTerms: e.target.value }))} />
              </div>
              <Input label="Observações da proposta (impressas no rodapé)" value={newQuoteForm.notes} onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </Card>

            {/* Bottom Section: Items management & Pricing (Full Width) */}
            <Card className="overflow-hidden shadow-premium border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-0">
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-5 py-5 text-slate-900 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/30 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-blue-300">
                        <BookOpen size={19} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Etapa 3</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Editor comercial</span>
                        </div>
                        <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">Serviços, materiais e composição de preço</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Monte cada linha separadamente e salve novos serviços ou materiais no catálogo individual.</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" size="sm" variant="primary" onClick={() => handleAddItem("SERVICO")} className="shadow-sm">
                        <Wrench size={14} /> Adicionar serviço
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => handleAddItem("PECAS")} className="border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/20">
                        <Package size={14} /> Adicionar material
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-4">
                  <div className="border-b border-r border-slate-200 px-5 py-3 dark:border-zinc-800 sm:border-b-0"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Linhas</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{quoteItems.length}</p></div>
                  <div className="border-b border-slate-200 bg-blue-50/40 px-5 py-3 dark:border-zinc-800 dark:bg-blue-950/10 sm:border-b-0 sm:border-r"><p className="text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Serviços</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{quoteItems.filter((item) => item.type === "SERVICO").length}</p></div>
                  <div className="border-r border-slate-200 bg-orange-50/40 px-5 py-3 dark:border-zinc-800 dark:bg-orange-950/10"><p className="text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-300">Materiais</p><p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{quoteItems.filter((item) => item.type !== "SERVICO").length}</p></div>
                  <div className="bg-emerald-50/40 px-5 py-3 dark:bg-emerald-950/10"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Subtotal</p><p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(liveTotals.subtotal)}</p></div>
                </div>

                {/* Items container */}
                <div className="space-y-4 p-4 sm:p-6">
                  {quoteItems.map((item, idx) => {
                    const isService = item.type === "SERVICO";
                    const uniqueNames = new Set<string>();
                    const frequentOptions: CatalogSearchOption[] = [];
                    const otherOptions: CatalogSearchOption[] = [];

                    if (isService) {
                      catalog.services.forEach((s) => {
                        if (s.name && !uniqueNames.has(s.name)) {
                          uniqueNames.add(s.name);
                          const usedBefore = clientItemHistory.find((h) => h.description === s.name);
                          (usedBefore ? frequentOptions : otherOptions).push({
                            value: s.name,
                            label: s.name,
                            detail: [s.category, s.maintenanceType, s.description].filter(Boolean).join(" · "),
                            price: Number(s.defaultPrice || 0),
                            frequent: Boolean(usedBefore),
                          });
                        }
                      });
                    } else {
                      catalog.products.forEach((p) => {
                        if (p.name && !uniqueNames.has(p.name)) {
                          uniqueNames.add(p.name);
                          const usedBefore = clientItemHistory.find((h) => h.description === p.name);
                          (usedBefore ? frequentOptions : otherOptions).push({
                            value: p.name,
                            label: p.name,
                            detail: [p.code, p.type, p.description].filter(Boolean).join(" · "),
                            price: Number(p.salePrice || 0),
                            frequent: Boolean(usedBefore),
                          });
                        }
                      });
                    }
                    // Itens já comprados por este cliente aparecem primeiro no seletor.
                    const optionsList = [...frequentOptions, ...otherOptions];
                    const isCatalogued = isService
                      ? catalog.services.some((service) => service.name === item.description)
                      : catalog.products.some((product) => product.name === item.description);
                    const gross = Number(item.quantity) * Number(item.unitPrice);
                    const lineDiscount = Number(item.quantity) * Number(item.discount || 0);
                    const lineTotal = Math.max(0, gross - lineDiscount);
                    const lineCost = Number(item.quantity) * Number(item.costPrice || 0);
                    const lineMargin = lineTotal - lineCost;

                    return (
                      <div key={idx} className="relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className={`absolute inset-y-0 left-0 w-0.5 rounded-l-2xl ${isService ? "bg-blue-500" : "bg-orange-400"}`} />
                        <div className={`flex flex-col gap-3 rounded-t-2xl border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 ${isService ? "bg-blue-50/25 dark:bg-blue-950/10" : "bg-orange-50/25 dark:bg-orange-950/10"}`}>
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isService ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-orange-100/70 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"}`}>
                              {isService ? <Wrench size={17} /> : <Package size={17} />}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-zinc-900 dark:text-white">{isService ? "Serviço técnico" : "Material / peça"} #{idx + 1}</span>
                                {isCatalogued && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Salvo no catálogo</span>}
                              </div>
                              <p className="mt-0.5 text-[10px] text-zinc-450">Esta linha é calculada e armazenada individualmente.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
                              <button type="button" aria-pressed={isService} onClick={() => handleItemTypeChange(idx, "SERVICO")} className={`rounded-md px-2.5 py-1 text-[9px] font-bold transition-colors ${isService ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>Serviço</button>
                              <button type="button" aria-pressed={!isService} onClick={() => handleItemTypeChange(idx, "PECAS")} className={`rounded-md px-2.5 py-1 text-[9px] font-bold transition-colors ${!isService ? "bg-white text-orange-700 shadow-sm dark:bg-zinc-700 dark:text-orange-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>Material</button>
                            </div>
                            <Button type="button" size="sm" variant="secondary" onClick={() => openAdhocModal(idx, item.type)}>
                              <PlusCircle size={13} /> Cadastrar {isService ? "serviço" : "material"}
                            </Button>
                            <button type="button" onClick={() => handleRemoveItem(idx)} disabled={quoteItems.length === 1} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-950/20" title="Remover esta linha"><Trash2 size={15} /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-12 md:items-end">
                          <div className="md:col-span-5">
                            <CatalogSearchPicker
                              type={isService ? "SERVICO" : "PECAS"}
                              value={item.description}
                              options={optionsList}
                              onSelect={(value) => handleCatalogSelect(idx, value, item.type)}
                              onCreate={(suggestedName) => openAdhocModal(idx, item.type, suggestedName)}
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Input label="Qtd." type="number" min="0.01" step="0.01" required value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Select label="Unidade" value={item.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} options={[{ value: "SERVIÇO", label: "Serviço" }, { value: "UN", label: "Unidade" }, { value: "H", label: "Hora" }, { value: "DIA", label: "Diária" }, { value: "M", label: "Metro" }, { value: "M2", label: "Metro²" }, { value: "KG", label: "Quilo" }, { value: "CJ", label: "Conjunto" }]} />
                          </div>
                          <div className="md:col-span-2">
                            <Input label="Custo unitário" type="number" min="0" step="0.01" value={item.costPrice} onChange={(e) => handleItemChange(idx, "costPrice", e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Input label="Preço de venda *" type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/30 sm:grid-cols-[180px_1fr_auto] sm:items-center">
                          <Input label="Desconto unitário (R$)" type="number" min="0" step="0.01" value={item.discount} onChange={(e) => handleItemChange(idx, "discount", e.target.value)} />
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-semibold text-zinc-500">
                            <span>Custo da linha: <strong className="text-zinc-700 dark:text-zinc-250">{formatCurrency(lineCost)}</strong></span>
                            <span>Margem estimada: <strong className={lineMargin >= 0 ? "text-emerald-600" : "text-red-500"}>{formatCurrency(lineMargin)}</strong></span>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-right shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total da linha</p>
                            <p className="mt-0.5 text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(lineTotal)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotals card */}
                <div className="mx-4 mb-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30 sm:mx-6 sm:mb-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <Input
                      label="Desconto na Proposta (R$)"
                      type="number"
                      value={newQuoteForm.discount}
                      onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, discount: Number(e.target.value) || 0 }))}
                    />
                    <Input
                      label={`Impostos automáticos · ${taxProfile.label} (${taxProfile.rate.toFixed(2)}%)`}
                      type="number"
                      readOnly
                      value={liveTotals.tax.toFixed(2)}
                      className="bg-zinc-100 font-semibold text-zinc-600 dark:bg-zinc-900"
                    />
                  </div>

                  <div className="flex flex-col justify-center space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span>Subtotal dos Itens:</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-200">{formatCurrency(liveTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span>Desconto total:</span>
                      <span className="font-bold text-red-500">-{formatCurrency(Number(newQuoteForm.discount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span>Acréscimos/Impostos:</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-200">+{formatCurrency(liveTotals.tax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-100 pt-2 text-sm font-bold text-slate-900 dark:border-emerald-950 dark:text-zinc-100">
                      <span>Total Geral:</span>
                      <span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(liveTotals.total)}</span>
                    </div>
                  </div>
                </div>
              </Card>

          </form>
        </div>
      )}

      {/* 2. MAIN SPLIT-SCREEN VIEW (List + PDF preview side-by-side) */}
      {view === "list" && (
        <>
          <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#071331] via-[#10275b] to-[#1d4d9b] p-6 text-white shadow-xl shadow-blue-950/10 print:hidden sm:p-8">
            <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-48 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-blue-200"><BriefcaseBusiness size={14} /> Central comercial</div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Propostas e Orçamentos</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Acompanhe oportunidades, negociações, aprovações e a conversão de cada proposta em ordem de serviço.</p>
              </div>
              {hasPermission("quotes.write") && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => openTab("orcamentos", "Proposta Preventiva", { tab: "preventiva" })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15"><Sparkles size={16} /> Proposta preventiva</button>
                  <button onClick={() => setView("create")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-blue-950 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"><Plus size={17} /> Novo orçamento</button>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-3 print:hidden sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setStatusFilter("EM_ANDAMENTO")} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900 ${statusFilter === "EM_ANDAMENTO" ? "border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950" : "border-zinc-200 dark:border-zinc-800"}`}>
              <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30"><TrendingUp size={19} /></span><span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">Pipeline aberto</span></div>
              <p className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{formatCurrency(openPipelineValue)}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">{openQuotes.length} proposta(s) em andamento</p>
            </button>
            <button type="button" onClick={() => setStatusFilter("RASCUNHOS")} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900 ${statusFilter === "RASCUNHOS" ? "border-amber-500 ring-2 ring-amber-100 dark:ring-amber-950" : "border-zinc-200 dark:border-zinc-800"}`}>
              <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/30"><FileText size={19} /></span><span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">Para revisar</span></div>
              <p className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{draftQuotes.length}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">orçamento(s) em rascunho</p>
            </button>
            <button type="button" onClick={() => setStatusFilter("APROVADOS")} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900 ${statusFilter === "APROVADOS" ? "border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950" : "border-zinc-200 dark:border-zinc-800"}`}>
              <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"><CircleDollarSign size={19} /></span><span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">Aprovado</span></div>
              <p className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{formatCurrency(approvedValue)}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">{approvedQuotes.length} aprovada(s) · {conversionRate}% conversão</p>
            </button>
            <button type="button" onClick={() => setStatusFilter("EXPIRADOS")} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900 ${statusFilter === "EXPIRADOS" ? "border-rose-500 ring-2 ring-rose-100 dark:ring-rose-950" : "border-zinc-200 dark:border-zinc-800"}`}>
              <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30"><Clock3 size={19} /></span><span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">Atenção</span></div>
              <p className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{expiredQuotes.length}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">expirada(s) ou recusada(s)</p>
            </button>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-lg">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente ou número da proposta" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {[
                  { id: "TODOS", label: `Todos ${quotes.length}` },
                  { id: "RASCUNHOS", label: `Rascunhos ${draftQuotes.length}` },
                  { id: "EM_ANDAMENTO", label: `Em andamento ${openQuotes.length}` },
                  { id: "APROVADOS", label: `Aprovados ${approvedQuotes.length}` },
                  { id: "EXPIRADOS", label: `Encerrados ${expiredQuotes.length}` },
                ].map((item) => <button key={item.id} type="button" onClick={() => setStatusFilter(item.id)} className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-black transition ${statusFilter === item.id ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{item.label}</button>)}
              </div>
              <label className="relative flex shrink-0 items-center gap-2"><SlidersHorizontal size={15} className="absolute left-3 text-zinc-400" /><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="h-10 appearance-none rounded-xl border border-zinc-200 bg-white pl-9 pr-8 text-xs font-bold text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><option value="RECENTES">Mais recentes</option><option value="MAIOR_VALOR">Maior valor</option><option value="MENOR_VALOR">Menor valor</option><option value="VALIDADE">Validade próxima</option></select></label>
            </div>
          </section>

          <div className="quote-print-layout grid grid-cols-1 gap-5 items-start xl:grid-cols-12">

            {/* Left Side Quote List (Hidden during print) */}
            <div className="space-y-4 print:hidden xl:col-span-4">
              <Card className="overflow-hidden rounded-2xl border border-zinc-200 p-0 shadow-sm dark:border-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div><span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Carteira de propostas</span><p className="mt-1 text-xs font-bold text-zinc-700 dark:text-zinc-200">{filteredQuotes.length} resultado(s)</p></div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-400 shadow-sm dark:bg-zinc-800"><FileText size={15} /></span>
                </div>

                <div className="max-h-[calc(100vh-330px)] min-h-[420px] space-y-2 overflow-y-auto bg-zinc-50/40 p-2 dark:bg-zinc-950/20">
                  {loading ? (
                    <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs">Carregando listagem...</p>
                    </div>
                  ) : filteredQuotes.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                      <FileText size={28} className="text-zinc-300" />
                      <p className="text-xs font-bold">Nenhum orçamento encontrado.</p>
                    </div>
                  ) : (
                    filteredQuotes.map((q) => {
                      const isActive = q.id === selectedQuoteId;
                      const expired = isQuoteExpired(q);
                      return (
                        <div
                          key={q.id}
                          onClick={() => setSelectedQuoteId(q.id)}
                          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                            isActive
                              ? "border-blue-400 bg-white shadow-md ring-2 ring-blue-100 dark:border-blue-700 dark:bg-zinc-900 dark:ring-blue-950"
                              : "border-transparent bg-white/80 hover:border-zinc-200 hover:bg-white hover:shadow-sm dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] font-black text-blue-600">{q.code || q.id.slice(-4)}</span>
                                <span className="text-[9px] font-bold text-zinc-400">V{q.version || 1}</span>
                              </div>
                              <p className="mt-2 truncate text-sm font-black text-zinc-950 dark:text-white">{q.clientName}</p>
                              <p className="mt-1 text-[10px] font-semibold text-zinc-400">Criada em {formatDate(q.createdAt)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="block text-sm font-black text-zinc-950 dark:text-white">{formatCurrency(q.total || 0)}</span>
                              <div className="mt-1 flex justify-end">
                              <StatusBadge status={q.status} />
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                            <span className={`flex min-w-0 items-center gap-1.5 truncate text-[10px] font-bold ${expired ? "text-rose-600" : "text-zinc-500"}`}><CalendarDays size={12} /> {expired ? "Validade encerrada" : `Válida até ${formatDate(q.validUntil)}`}{q.serviceOrders?.[0]?.code ? ` · ${q.serviceOrders[0].code}` : ""}</span>
                            <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {hasPermission("quotes.write") && canApproveQuote(q.status) && (
                                <button
                                  onClick={async () => {
                                    const details = await getQuoteDetails(q.id);
                                    if (details) handleStartEdit(details);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-800"
                                  title="Editar Orçamento"
                                >
                                  <Edit size={15} />
                                </button>
                              )}
                              {hasPermission("quotes.write") && canApproveQuote(q.status) && (
                                <>
                                  <button
                                    onClick={() => void requestQuoteApproval(q)}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-black text-white transition hover:bg-emerald-700"
                                    title="Aprovar e Gerar OS"
                                  >
                                    <CheckCircle size={13} /> Aprovar
                                  </button>
                                  <button
                                    onClick={() => handleReject(q.id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50"
                                    title="Rejeitar Orçamento"
                                  >
                                    <XCircle size={15} />
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => setSelectedQuoteId(q.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"><ChevronRight size={16} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* Right Side PDF Print Sheet Preview */}
            <div className="quote-print-column min-w-0 space-y-4 xl:col-span-8">

              {/* Action Row for the PDF view */}
              {quoteDetails && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
                  <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30"><Send size={18} /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-black text-blue-600">{quoteDetails.code}</span><StatusBadge status={quoteDetails.status} /><span className="text-[9px] font-bold text-zinc-400">VERSÃO {quoteDetails.version || 1}</span></div>
                        <p className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-white">{quoteDetails.client?.name || quoteDetails.clientName}</p>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-zinc-500"><span>{formatCurrency(quoteDetails.total || 0)}</span><span>·</span><span>Válida até {formatDate(quoteDetails.validUntil)}</span><span>·</span><span>PDF executivo em uma folha A4</span></p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={handlePrint}>
                        <Printer size={14} /> PDF
                      </Button>
                      {hasPermission("quotes.write") && (
                        <Button variant="primary" onClick={() => setIsEmailModalOpen(true)}>
                          <Mail size={14} /> Enviar por Gmail
                        </Button>
                      )}
                      {hasPermission("quotes.write") && canApproveQuote(quoteDetails.status) && (
                        <Button variant="secondary" onClick={() => handleStartEdit(quoteDetails)}>
                          <Edit size={14} /> Editar
                        </Button>
                      )}
                      {hasPermission("quotes.write") && canApproveQuote(quoteDetails.status) && (
                        <Button variant="success" onClick={() => void requestQuoteApproval(quoteDetails)}>
                          <CheckCircle size={14} /> Aprovar e gerar OS
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {loadingDetails ? (
                <div className="py-32 text-center text-zinc-400 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs font-bold">Processando layout PDF...</p>
                </div>
              ) : quoteDetails ? (

                /* High-fidelity Blueprint PDF template matching the uploaded blueprint image */
                <article
                  className="print-a4-sheet w-full min-w-0 bg-white text-zinc-850 p-4 sm:p-6 md:p-8 rounded-xl border border-zinc-200/80 shadow-premium font-sans mx-auto space-y-5 sm:space-y-6 print:border-0 print:shadow-none print:p-0 print:mx-0"
                  style={{ maxWidth: previewWidth }}
                  aria-label={`Orçamento ${quoteDetails.code}`}
                >

                  {/* HEADER ROW */}
                  <header className="quote-print-responsive-grid print-keep-together grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 pb-4 border-b-2 border-blue-950 items-center">

                    {/* Logo and company profile details */}
                    <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
                      {companyParams.logoUrl ? (
                        <img src={companyParams.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-blue-950 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Award size={24} />
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0 break-words">
                        <h1 className="text-sm font-bold text-blue-955 uppercase tracking-tight leading-none">
                          {companyParams.tradeName || "SUA EMPRESA"}
                        </h1>
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block">
                          Soluções em Climatização
                        </span>
                        <p className="text-[7.5px] text-zinc-555 leading-relaxed font-semibold">
                          CNPJ: {companyParams.cnpj} • I.E: {companyParams.stateRegistration || "ISENTO"} • I.M: {companyParams.municipalRegistration || "ISENTO"}
                          <br />
                          Tel: {companyParams.phone} • E-mail: {companyParams.email}
                          <br />
                          End: {companyParams.address}
                        </p>
                      </div>
                    </div>

                    {/* commercial proposal block */}
                    <div className="sm:col-span-4 bg-blue-950 text-white p-2.5 text-center rounded-lg space-y-0.5 shadow">
                      <span className="text-[8px] font-bold uppercase tracking-wider block">Proposta Comercial</span>
                      <span className="text-xs font-bold block">Nº {quoteDetails.code}</span>
                      <div className="text-[7.5px] font-bold text-zinc-300 pt-0.5 border-t border-white/10">
                        DATA DA PROPOSTA: {formatDate(quoteDetails.createdAt)}
                      </div>
                    </div>

                    {/* Merchan Header placement */}
                    <div className="sm:col-span-3 border border-zinc-200/80 p-2 bg-zinc-50/50 rounded-lg text-center shadow-sm">
                      <span className="text-[8px] font-bold text-blue-950 uppercase block">ESPAÇO PARA MERCHAN</span>
                      <p className="text-[7px] text-zinc-400 mt-0.5 leading-normal font-semibold">
                        {companyParams.tradeName || "NEXUS CLIMATIZACAO E ELETRICA"}: Ar limpo e manutenção preventiva garantida!
                      </p>
                    </div>
                  </header>

                  {/* DADOS DO CLIENTE & PROPOSTA BOXES */}
                  <div className="quote-print-responsive-grid print-keep-together grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

                    {/* Client Box */}
                    <div className="border border-zinc-200/85 p-3 rounded-xl bg-zinc-50/30 space-y-2">
                      <div className="border-b border-zinc-150 pb-1.5 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-950" />
                        <span className="text-[9px] font-bold text-blue-950 uppercase tracking-wider">Dados do Cliente</span>
                      </div>
                      <div className="grid grid-cols-3 gap-y-1.5 gap-x-1 text-[8.5px] font-medium text-zinc-650">
                        <span className="font-semibold text-zinc-800">Cliente:</span>
                        <span className="col-span-2 font-bold text-zinc-900">{quoteDetails.client?.name || quoteDetails.clientName}</span>

                        <span className="font-semibold text-zinc-800">CNPJ/CPF:</span>
                        <span className="col-span-2 font-semibold">{quoteDetails.client?.cpfCnpj}</span>

                        <span className="font-semibold text-zinc-800">Endereço:</span>
                        <span className="col-span-2 font-semibold leading-normal">
                          {clientAddressStr}
                        </span>

                        <span className="font-semibold text-zinc-850">Contato:</span>
                        <span className="col-span-2 font-semibold">{quoteDetails.client?.contacts?.[0]?.name || "N/A"}</span>
                      </div>
                    </div>

                    {/* Proposal Metadata Box */}
                    <div className="border border-zinc-200/85 p-3 rounded-xl bg-zinc-50/30 space-y-2">
                      <div className="border-b border-zinc-150 pb-1.5 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-950" />
                        <span className="text-[9px] font-bold text-blue-950 uppercase tracking-wider">Dados da Proposta</span>
                      </div>
                      <div className="grid grid-cols-3 gap-y-1.5 gap-x-1 text-[8.5px] font-medium text-zinc-650">
                        <span className="font-semibold text-zinc-800">Validade:</span>
                        <span className="col-span-2 font-bold text-zinc-900">{validityDays} dias</span>

                        <span className="font-semibold text-zinc-800">Condições:</span>
                        <span className="col-span-2 font-semibold">{quoteDetails.paymentTerms || "30 dias"}</span>

                        <span className="font-semibold text-zinc-800">Vendedor:</span>
                        <span className="col-span-2 font-semibold">{currentUser?.name || "Lucas Souza"} (Comercial)</span>

                        <span className="font-semibold text-zinc-800">Execução:</span>
                        <span className="col-span-2 font-semibold">{quoteDetails.executionTerm || "A combinar"}</span>
                      </div>
                    </div>
                  </div>

                  {/* OBJETO DA PROPOSTA */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-blue-950 uppercase tracking-wider block">Objeto da Proposta</span>
                    <p className="text-[8.5px] text-zinc-500 font-semibold leading-relaxed">
                      Apresentamos nossa proposta comercial conforme descrição dos serviços/produtos abaixo. Estamos à disposição para quaisquer esclarecimentos que se façam necessários.
                    </p>
                  </div>

                  {/* ITEMS GRID TABLE */}
                  <div className="print-items-table overflow-x-auto sm:overflow-hidden border border-zinc-200 rounded-xl shadow-sm">
                    <table className="w-full text-left text-[9px] border-collapse font-sans">
                      <thead>
                        <tr className="bg-blue-950 text-white font-bold uppercase text-[7.5px] tracking-wider">
                          <th className="py-2.5 px-3 text-center w-10">Item</th>
                          <th className="py-2.5 px-3">Descrição de Serviços/Peças</th>
                          <th className="py-2.5 px-3 text-center w-12">Qtde</th>
                          <th className="py-2.5 px-3 text-center w-12">Unid</th>
                          <th className="py-2.5 px-3 text-right w-24">Valor Unit.</th>
                          <th className="py-2.5 px-3 text-right w-24">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/80 font-medium text-zinc-700">
                        {quoteDetails.items?.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-zinc-50/50">
                            <td className="py-2.5 px-3 text-center text-zinc-450 font-bold">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-zinc-800 font-semibold font-sans break-words">
                              {item.description}
                              {item.type === "PECAS" && <span className="ml-1.5 text-[7px] bg-zinc-100 text-zinc-500 py-0.5 px-1 rounded uppercase font-bold">Peça/Material</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-center font-bold">{item.unit || "UN"}</td>
                            <td className="py-2.5 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-2.5 px-3 text-right font-bold">{formatCurrency(item.quantity * item.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FOOTER INFO: DIFERENCIAIS, MERCHAN & TOTALS */}
                  <div className="quote-print-responsive-grid print-keep-together grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-stretch">
                    {/* Diferenciais */}
                    <div className="border border-zinc-200/85 p-3 rounded-xl space-y-2 bg-zinc-50/30">
                      <span className="text-[9px] font-bold text-blue-955 uppercase tracking-wider block">★ Diferenciais</span>
                      <ul className="text-[8px] text-zinc-550 font-bold space-y-1.5">
                        {companyParams.differentials
                          ?.split("\n")
                          .filter(Boolean)
                          .map((diff: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-1">
                              ✓ {diff.trim()}
                            </li>
                          ))}
                      </ul>
                    </div>

                    {/* Merchan central block */}
                    <div className="border border-zinc-200/85 p-3 rounded-xl bg-blue-950/5 flex flex-col justify-between text-center space-y-2">
                      <span className="text-[8.5px] font-bold text-blue-955 uppercase tracking-wider block">📣 MERCHAN / DESTAQUE</span>
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-blue-900 uppercase">
                          {companyParams.merchanTitle}
                        </span>
                      </div>
                      <span className="text-[7.5px] text-zinc-450 font-semibold leading-normal block">
                        {companyParams.merchanDesc}
                      </span>
                    </div>

                    {/* Financial Summary Box */}
                    <div className="border border-zinc-200/85 p-3 rounded-xl bg-zinc-50/50 flex flex-col justify-center space-y-1.5">
                      <div className="flex justify-between text-[8.5px] text-zinc-500 font-semibold">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(quoteDetails.subtotal)}</span>
                      </div>
                      {quoteDetails.discount > 0 && (
                        <div className="flex justify-between text-[8.5px] text-red-500 font-bold">
                          <span>Desconto:</span>
                          <span>-{formatCurrency(quoteDetails.discount)}</span>
                        </div>
                      )}
                      {quoteDetails.tax > 0 && (
                        <div className="flex justify-between text-[8.5px] text-zinc-500 font-semibold">
                          <span>Impostos:</span>
                          <span>+{formatCurrency(quoteDetails.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px] font-bold text-blue-955 pt-1.5 border-t border-zinc-200">
                        <span>Total:</span>
                        <span>{formatCurrency(quoteDetails.total)}</span>
                      </div>
                    </div>

                  </div>

                  {/* TRIBUTOS, PRAZO & FORMA PAGAMENTO ROW */}
                  <div className="quote-print-responsive-grid print-keep-together grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-zinc-200/80 text-[8px] text-zinc-500 leading-relaxed font-semibold">
                    <div className="space-y-0.5">
                      <span className="font-bold text-zinc-800 uppercase tracking-wide block text-[8.5px]">Condições Gerais</span>
                      <p>• A proposta tem validade conforme data informada.</p>
                      <p>• O prazo de execução inicia-se após aprovação.</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-zinc-800 uppercase tracking-wide block text-[8.5px]">Forma de Pagamento</span>
                      <p>{quoteDetails.paymentTerms || "Boleto / Pix / Transferência"}</p>
                      <p>Condição: 30 dias.</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-zinc-800 uppercase tracking-wide block text-[8.5px]">Prazo de Execução</span>
                      <p>{quoteDetails.executionTerm || "A combinar de acordo com disponibilidade."}</p>
                    </div>
                  </div>

                  {/* OBSERVATIONS & SIGNATURE LINE */}
                  <div className="quote-print-responsive-grid print-keep-together grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-4 border-t border-zinc-200/80">
                    <div className="sm:col-span-8 bg-zinc-50 p-2.5 rounded-lg border border-zinc-150 text-[7.5px] text-zinc-500 italic break-words">
                      <span className="font-bold text-zinc-700 not-italic block mb-0.5 uppercase tracking-wide text-[8px]">Observações:</span>
                      {quoteDetails.notes || "Estaremos sempre à disposição para melhor atendê-los!"}
                    </div>

                    <div className="sm:col-span-4 text-center text-[8.5px] text-zinc-450 border-t border-zinc-300 pt-1.5 mt-4">
                      <span className="font-bold text-zinc-750 block">{currentUser?.name || "Lucas Souza"}</span>
                      Departamento Comercial
                    </div>
                  </div>

                  <footer className="print-keep-together bg-blue-950 text-white py-2 px-3 rounded-lg text-center flex flex-col sm:flex-row gap-1 sm:justify-between sm:items-center text-[7.5px] font-semibold">
                    <span>Obrigado pela confiança! Soluções que geram resultados.</span>
                    <span className="font-bold uppercase tracking-wider">{companyParams.tradeName || "NEXUS AR"}</span>
                  </footer>

                </article>
              ) : (
                <div className="py-24 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                  Nenhum orçamento selecionado para pré-visualização.
                </div>
              )}

            </div>
          </div>
        </>
      )}

      <Modal isOpen={Boolean(quotePendingApproval)} onClose={() => setQuotePendingApproval(null)} title="Aprovar orçamento e gerar OS" size="lg">
        {quotePendingApproval && (() => {
          const selectedAddress = quotePendingApproval.client?.addresses?.find((address: { id: string; street: string; number: string; city: string; state: string }) => address.id === quotePendingApproval.addressId);
          const hasAddress = Boolean(quotePendingApproval.addressId);
          return (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-950 dark:bg-blue-950/25">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{quotePendingApproval.code}</p>
                    <h3 className="mt-1 text-base font-black text-zinc-900 dark:text-zinc-100">{quotePendingApproval.client?.name || quotePendingApproval.clientName}</h3>
                  </div>
                  <strong className="text-lg text-blue-700 dark:text-blue-300">{formatCurrency(quotePendingApproval.total || 0)}</strong>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${hasAddress ? "border-emerald-100 bg-emerald-50 dark:border-emerald-950 dark:bg-emerald-950/20" : "border-orange-200 bg-orange-50 dark:border-orange-950 dark:bg-orange-950/20"}`}>
                <div className="flex items-start gap-3">
                  {hasAddress ? <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <MapPin size={18} className="mt-0.5 shrink-0 text-orange-600" />}
                  <div>
                    <p className={`text-sm font-bold ${hasAddress ? "text-emerald-800 dark:text-emerald-300" : "text-orange-800 dark:text-orange-300"}`}>{hasAddress ? "Endereço de execução confirmado" : "Falta o endereço de execução"}</p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{selectedAddress ? `${selectedAddress.street}, ${selectedAddress.number} · ${selectedAddress.city}/${selectedAddress.state}` : "A OS precisa de um endereço para ser criada. Edite o orçamento e selecione ou cadastre o endereço do cliente."}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Ao confirmar, o orçamento será marcado como convertido e uma nova Ordem de Serviço será aberta com os itens, cliente e condições desta proposta.
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
                <Button variant="secondary" onClick={() => setQuotePendingApproval(null)}>Cancelar</Button>
                {!hasAddress ? (
                  <Button variant="primary" onClick={() => { const quote = quotePendingApproval; setQuotePendingApproval(null); handleStartEdit(quote); }}><Edit size={14} /> Editar e informar endereço</Button>
                ) : (
                  <Button variant="success" loading={actionLoading} onClick={() => void handleApprove(quotePendingApproval.id)}><CheckCircle size={14} /> Confirmar aprovação e gerar OS</Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <SendQuoteEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        quoteId={quoteDetails?.id || null}
        quoteCode={quoteDetails?.code}
        company={companyParams}
        onSent={async () => {
          await loadQuotes();
          if (selectedQuoteId) await fetchDetails(selectedQuoteId);
        }}
      />

      {/* Cadastro rápido de cliente dentro do orçamento */}
      <Modal isOpen={isQuickClientOpen} onClose={() => setIsQuickClientOpen(false)} title="Novo cliente para o orçamento" size="xl">
        <form onSubmit={handleQuickClientSave} className="space-y-6">
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 flex items-start gap-3">
            <UserPlus className="text-primary mt-0.5" size={19} />
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Cadastro rápido e completo</p>
              <p className="text-xs text-zinc-500">Ao salvar, o cliente e o endereço serão vinculados automaticamente a este orçamento.</p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <Building2 size={16} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Dados principais</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-8">
                <Input label="CPF ou CNPJ (opcional)" placeholder="Pode ser preenchido depois" value={quickClientForm.cpfCnpj} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, cpfCnpj: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <Button type="button" variant="secondary" className="w-full" loading={cnpjLoading} onClick={handleCnpjLookup}>
                  <Search size={15} /> Consultar CNPJ
                </Button>
              </div>
              <div className="md:col-span-6">
                <Input label="Nome do cliente *" required placeholder="Nome usado no sistema" value={quickClientForm.name} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <Input label="Razão social" value={quickClientForm.socialName} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, socialName: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <Input label="Nome fantasia" value={quickClientForm.fancyName} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, fancyName: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <Input label="Segmento" placeholder="Ex: Comércio, Condomínio, Indústria" value={quickClientForm.segment} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, segment: e.target.value }))} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <ContactRound size={16} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Contato</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="E-mail *" type="email" required value={quickClientForm.email} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, email: e.target.value }))} />
              <Input label="Telefone *" required value={quickClientForm.phone} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, phone: e.target.value }))} />
              <Input label="WhatsApp" value={quickClientForm.whatsapp} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-2">
              <MapPin size={16} className="text-primary" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Endereço de execução</h4>
                <p className="text-[11px] text-zinc-500">Recomendado para permitir a geração da OS após a aprovação.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3"><Input label="CEP" value={quickClientForm.address.cep} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, cep: e.target.value } }))} /></div>
              <div className="md:col-span-7"><Input label="Logradouro" placeholder="Rua, avenida..." value={quickClientForm.address.street} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, street: e.target.value } }))} /></div>
              <div className="md:col-span-2"><Input label="Número" value={quickClientForm.address.number} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, number: e.target.value } }))} /></div>
              <div className="md:col-span-4"><Input label="Bairro" value={quickClientForm.address.neighborhood} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, neighborhood: e.target.value } }))} /></div>
              <div className="md:col-span-4"><Input label="Cidade" value={quickClientForm.address.city} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, city: e.target.value } }))} /></div>
              <div className="md:col-span-2"><Input label="UF" maxLength={2} value={quickClientForm.address.state} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, state: e.target.value.toUpperCase() } }))} /></div>
              <div className="md:col-span-2"><Input label="Complemento" value={quickClientForm.address.complement} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, address: { ...prev.address, complement: e.target.value } }))} /></div>
            </div>
          </section>

          <Input label="Observações internas" value={quickClientForm.notes} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, notes: e.target.value }))} />

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsQuickClientOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={actionLoading}><Save size={15} /> Salvar e selecionar cliente</Button>
          </div>
        </form>
      </Modal>

      {/* Cadastro individual de serviço ou material */}
      <Modal
        isOpen={isAdhocOpen}
        onClose={() => setIsAdhocOpen(false)}
        title={adhocForm.type === "SERVICO" ? "Cadastrar Serviço Profissional" : "Cadastrar Material / Peça"}
        size="xl"
      >
        <form onSubmit={handleSaveAdhoc} className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${adhocForm.type === "SERVICO" ? "bg-blue-600 text-white" : "bg-orange-500 text-white"}`}>
                {adhocForm.type === "SERVICO" ? <Wrench size={18} /> : <Package size={18} />}
              </span>
              <div>
                <p className="text-sm font-black text-zinc-900 dark:text-white">{adhocForm.type === "SERVICO" ? "Ficha técnica do serviço" : "Ficha comercial e de estoque do material"}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">O cadastro será salvo separadamente no catálogo e aplicado somente à linha selecionada da proposta.</p>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-150 pb-2 dark:border-zinc-800">
              <BookOpen size={15} className="text-primary" />
              <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Identificação</h4>
            </div>
            <Input
              label={adhocForm.type === "SERVICO" ? "Nome oficial do serviço *" : "Nome oficial do material *"}
              required
              placeholder={adhocForm.type === "SERVICO" ? "Ex: Manutenção preventiva em Split Hi-Wall" : "Ex: Filtro de ar 600 x 600 mm"}
              value={adhocForm.name}
              onChange={(e) => setAdhocForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Descrição técnica"
              placeholder={adhocForm.type === "SERVICO" ? "Escopo resumido, atividades incluídas e aplicação" : "Marca, modelo, especificação ou aplicação"}
              value={adhocForm.description}
              onChange={(e) => setAdhocForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </section>

          {adhocForm.type === "SERVICO" ? (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select label="Categoria" value={adhocForm.category} onChange={(e) => setAdhocForm((prev) => ({ ...prev, category: e.target.value }))} options={[{ value: "MANUTENCAO", label: "Manutenção" }, { value: "INSTALACAO", label: "Instalação" }, { value: "HIGIENIZACAO", label: "Higienização" }, { value: "INSPECAO", label: "Inspeção / Laudo" }, { value: "PROJETO", label: "Projeto técnico" }, { value: "OUTROS", label: "Outros" }]} />
                <Select label="Modalidade" value={adhocForm.maintenanceType} onChange={(e) => setAdhocForm((prev) => ({ ...prev, maintenanceType: e.target.value }))} options={[{ value: "PREVENTIVA", label: "Preventiva" }, { value: "CORRETIVA", label: "Corretiva" }, { value: "PREDITIVA", label: "Preditiva" }, { value: "INSTALACAO", label: "Instalação" }, { value: "AVULSO", label: "Atendimento avulso" }]} />
                <Select label="Unidade de cobrança" value={adhocForm.unit} onChange={(e) => setAdhocForm((prev) => ({ ...prev, unit: e.target.value }))} options={[{ value: "SERVIÇO", label: "Por serviço" }, { value: "H", label: "Por hora" }, { value: "DIA", label: "Por diária" }, { value: "UN", label: "Por unidade" }, { value: "M2", label: "Por metro²" }]} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Tempo estimado (horas)" type="number" min="0" step="0.5" value={adhocForm.estimatedHours} onChange={(e) => setAdhocForm((prev) => ({ ...prev, estimatedHours: e.target.value }))} />
                <Input label="Preço padrão de venda (R$) *" type="number" min="0.01" step="0.01" required value={adhocForm.price} onChange={(e) => setAdhocForm((prev) => ({ ...prev, price: e.target.value }))} />
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select label="Classificação" value={adhocForm.productType} onChange={(e) => setAdhocForm((prev) => ({ ...prev, productType: e.target.value }))} options={[{ value: "MATERIAL", label: "Material / insumo" }, { value: "PECA", label: "Peça de reposição" }, { value: "EQUIPAMENTO", label: "Equipamento" }, { value: "FERRAMENTA", label: "Ferramenta" }]} />
                <Select label="Unidade" value={adhocForm.unit} onChange={(e) => setAdhocForm((prev) => ({ ...prev, unit: e.target.value }))} options={[{ value: "UN", label: "Unidade" }, { value: "PC", label: "Peça" }, { value: "M", label: "Metro" }, { value: "M2", label: "Metro²" }, { value: "KG", label: "Quilo" }, { value: "L", label: "Litro" }, { value: "CJ", label: "Conjunto" }]} />
                <Input label="Estoque mínimo" type="number" min="0" step="0.01" value={adhocForm.minStock} onChange={(e) => setAdhocForm((prev) => ({ ...prev, minStock: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label="Estoque inicial" type="number" min="0" step="0.01" value={adhocForm.stockQuantity} onChange={(e) => setAdhocForm((prev) => ({ ...prev, stockQuantity: e.target.value }))} />
                <Input label="Custo unitário (R$)" type="number" min="0" step="0.01" value={adhocForm.cost} onChange={(e) => setAdhocForm((prev) => ({ ...prev, cost: e.target.value }))} />
                <Input label="Preço de venda (R$) *" type="number" min="0.01" step="0.01" required value={adhocForm.price} onChange={(e) => setAdhocForm((prev) => ({ ...prev, price: e.target.value }))} />
              </div>
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-zinc-150 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-450"><BadgeDollarSign size={13} /> Depois de salvo, o item continuará disponível para outras propostas.</p>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsAdhocOpen(false)}>Cancelar</Button>
              <Button variant="primary" type="submit" loading={actionLoading}><Save size={14} /> Salvar {adhocForm.type === "SERVICO" ? "serviço" : "material"}</Button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}
