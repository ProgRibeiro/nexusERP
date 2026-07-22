"use client";

import React, { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { getQuotes, getQuoteDetails, createQuote, updateQuote, approveAndConvertQuote, updateQuoteStatus, getQuoteCatalog, registerCatalogItem, getClientItemHistory, ClientItemHistoryDTO, QuoteItemInput } from "@/app/actions/quoteActions";
import { addClientAddress, consultarCNPJAction, createClient, getClientDetails, getClients, syncClientFromCNPJ, ClientDetailsDTO, ClientDTO } from "@/app/actions/clientActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Modal } from "../ui/Modal";
import { Search, Loader2, FileText, Plus, CheckCircle, XCircle, Printer, PlusCircle, Trash2, Award, ArrowLeft, Save, Sparkles, Edit, UserPlus, Building2, MapPin, ContactRound } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import { getCompanyTaxProfile } from "@/app/actions/settingsActions";
import { calculateProposalTax, TaxProfile } from "@/lib/tax";

interface OrcamentosTabProps {
  newRecord?: boolean;
  requestId?: string;
  clientId?: string;
  quoteId?: string;
}

export default function OrcamentosTab({ newRecord = false, requestId, clientId, quoteId }: OrcamentosTabProps) {
  const pathname = usePathname();
  const { hasPermission, user: currentUser } = useAuth();
  const { openTab } = useWorkspace();
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Toggle view state: "list" vs "create" vs "edit"
  const [view, setView] = useState<"list" | "create" | "edit">(newRecord ? "create" : "list");

  // Selected Quote for detailed print preview
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteId || null);
  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);
  const [quotePendingApproval, setQuotePendingApproval] = useState<any | null>(null);

  useEffect(() => {
    if (newRecord) setView("create");
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
    price: "",
    cost: "",
    unit: "UN",
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
    { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 },
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
    if (selectedQuoteId) {
      fetchDetails(selectedQuoteId);
    } else {
      setQuoteDetails(null);
    }
  }, [selectedQuoteId]);

  // Formulário adaptativo: carrega histórico, contatos e endereços sem sair do orçamento.
  useEffect(() => {
    if (!newQuoteForm.clientId || (view !== "create" && view !== "edit")) {
      setClientItemHistory([]);
      setSelectedClientDetails(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      getClientItemHistory(newQuoteForm.clientId),
      getClientDetails(newQuoteForm.clientId),
    ]).then(([history, details]) => {
      if (cancelled) return;
      setClientItemHistory(history);
      setSelectedClientDetails(details);
      if (details) {
        setClientSearch((current) => current || details.name);
        setNewQuoteForm((prev) => ({
          ...prev,
          addressId: prev.addressId || (details.addresses.length === 1 ? details.addresses[0].id : ""),
          contactId: prev.contactId || (details.contacts.length === 1 ? details.contacts[0].id : ""),
        }));
      }
    }).catch(() => {
      if (!cancelled) {
        setClientItemHistory([]);
        setSelectedClientDetails(null);
      }
    });
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
      (!!term && client.cpfCnpj.replace(/\D/g, "").includes(term))
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

  const handleSyncSelectedClient = async () => {
    if (!newQuoteForm.clientId) return;
    setCnpjSyncLoading(true);
    try {
      const result = await syncClientFromCNPJ(newQuoteForm.clientId);
      if (!result.success) {
        toast(result.error || "Não foi possível consultar este CNPJ.", "warning");
        return;
      }
      const [refreshedClients, details] = await Promise.all([
        getClients(),
        getClientDetails(newQuoteForm.clientId),
      ]);
      setClients(refreshedClients);
      setSelectedClientDetails(details);
      setClientSearch(details?.name || "");
      setNewQuoteForm((prev) => ({
        ...prev,
        addressId: prev.addressId || details?.addresses[0]?.id || "",
      }));
      toast("Cadastro atualizado com os dados públicos do CNPJ.", "success");
    } finally {
      setCnpjSyncLoading(false);
    }
  };

  const handleQuickClientSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const document = quickClientForm.cpfCnpj.replace(/\D/g, "");
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
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddItem = () => {
    setQuoteItems([
      ...quoteItems,
      { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (quoteItems.length === 1) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof QuoteItemInput, value: any) => {
    setQuoteItems(
      quoteItems.map((item, i) => {
        if (i !== idx) return item;
        return {
          ...item,
          [field]: field === "type" || field === "unit" || field === "description" ? value : parseFloat(value) || 0,
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
            unit: "UN",
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
              unit: "UN",
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

  const openAdhocModal = (idx: number, type: string) => {
    setAdhocActiveRowIdx(idx);
    setAdhocForm({
      type: type === "PECAS" ? "PECAS" : "SERVICO",
      name: "",
      price: "",
      cost: "",
      unit: "UN",
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
      });

      if (res.success && res.item) {
        toast(`Item '${res.item.name}' cadastrado com sucesso no catálogo!`, "success");

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
        : [{ type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 }]
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
          { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 }
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
          { type: "SERVICO", description: "", quantity: 1, unit: "UN", unitPrice: 0, costPrice: 0, discount: 0 }
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

  const handlePrint = () => {
    window.print();
  };

  const filteredQuotes = quotes.filter((q) =>
    (q.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
    (q.code || "").toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200 print:p-0 print:m-0 print:bg-white">

      {/* Dynamic CSS Injection to lock A4 Page parameters precisely */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          body {
            background: white !important;
            color: #18181b !important;
          }
          .print-a4-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box;
          }
          h1, h2, h3, table, tr {
            page-break-inside: avoid;
          }
        }
      `}} />

      {/* 1. DEDICATED FULL-PAGE CREATION VIEW (Non-floating page) */}
      {(view === "create" || view === "edit") && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-200">
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
                            <p className="text-xs text-zinc-500 truncate">{client.fancyName && client.fancyName !== client.name ? `${client.fancyName} · ` : ""}{client.cpfCnpj} · {client.phone}</p>
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
                        <p className="text-xs text-zinc-500">{selectedClientDetails.cpfCnpj} · {selectedClientDetails.email} · {selectedClientDetails.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPermission("clients.write") && selectedClientDetails.cpfCnpj.replace(/\D/g, "").length === 14 && (
                        <Button type="button" size="sm" variant="secondary" loading={cnpjSyncLoading} onClick={handleSyncSelectedClient}>
                          <Sparkles size={14} /> Atualizar pelo CNPJ
                        </Button>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2.5 py-1 rounded-full">Cliente selecionado</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Endereço de execução *"
                      value={newQuoteForm.addressId}
                      onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, addressId: e.target.value }))}
                      options={[
                        { value: "", label: selectedClientDetails.addresses.length ? "Selecione o endereço" : "Cliente ainda não possui endereço" },
                        ...selectedClientDetails.addresses.map((address) => ({
                          value: address.id,
                          label: `${address.label || "Endereço"} · ${address.street}, ${address.number} · ${address.city}/${address.state}`,
                        })),
                      ]}
                    />
                    <Select
                      label="Contato responsável (opcional)"
                      value={newQuoteForm.contactId}
                      onChange={(e) => setNewQuoteForm((prev) => ({ ...prev, contactId: e.target.value }))}
                      options={[
                        { value: "", label: selectedClientDetails.contacts.length ? "Selecione o contato" : "Cliente ainda não possui contato adicional" },
                        ...selectedClientDetails.contacts.map((contact) => ({
                          value: contact.id,
                          label: `${contact.name}${contact.role ? ` · ${contact.role}` : ""}`,
                        })),
                      ]}
                    />
                  </div>
                  {!selectedClientDetails.addresses.length && (
                    <p className="flex items-center gap-2 text-xs text-warning"><MapPin size={14} /> Cadastre um endereço no cliente antes de aprovar e gerar a OS.</p>
                  )}
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
            <Card className="space-y-4 shadow-premium border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-6">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-[10px] font-bold text-blue-950 dark:text-zinc-100 uppercase tracking-wider block">
                    3. Serviços, peças e valores
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <PlusCircle size={14} /> Adicionar Item
                  </button>
                </div>

                {/* Items container */}
                <div className="space-y-4 pr-1">
                  {quoteItems.map((item, idx) => {
                    const isService = item.type === "SERVICO";
                    const uniqueNames = new Set();
                    const frequentOptions: { value: string; label: string }[] = [];
                    const otherOptions: { value: string; label: string }[] = [];

                    if (isService) {
                      catalog.services.forEach((s) => {
                        if (s.name && !uniqueNames.has(s.name)) {
                          uniqueNames.add(s.name);
                          const usedBefore = clientItemHistory.find((h) => h.description === s.name);
                          const label = `${usedBefore ? "★ " : ""}${s.name} (R$ ${s.defaultPrice.toFixed(2)})`;
                          (usedBefore ? frequentOptions : otherOptions).push({ value: s.name, label });
                        }
                      });
                    } else {
                      catalog.products.forEach((p) => {
                        if (p.name && !uniqueNames.has(p.name)) {
                          uniqueNames.add(p.name);
                          const usedBefore = clientItemHistory.find((h) => h.description === p.name);
                          const label = `${usedBefore ? "★ " : ""}${p.name} (R$ ${p.salePrice.toFixed(2)})`;
                          (usedBefore ? frequentOptions : otherOptions).push({ value: p.name, label });
                        }
                      });
                    }
                    // Itens já comprados por este cliente aparecem primeiro no seletor.
                    const optionsList = [...frequentOptions, ...otherOptions];

                    return (
                      <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-800/20 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl relative space-y-3">
                        <div className="flex gap-2 items-center justify-between">
                          <span className="text-[9px] font-semibold text-zinc-400 uppercase">Item #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => openAdhocModal(idx, item.type)}
                            className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Sparkles size={11} /> + Cadastrar Novo Item no Catálogo
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-2">
                            <Select
                              label="Tipo"
                              options={[
                                { value: "SERVICO", label: "Serviço" },
                                { value: "PECAS", label: "Peça" }
                              ]}
                              value={item.type}
                              onChange={(e) => {
                                handleItemChange(idx, "type", e.target.value);
                                handleItemChange(idx, "description", "");
                                handleItemChange(idx, "unitPrice", 0);
                              }}
                            />
                          </div>

                          <div className="md:col-span-6">
                            <Select
                              label="Selecione do Catálogo *"
                              value={item.description}
                              onChange={(e) => handleCatalogSelect(idx, e.target.value, item.type)}
                              options={[
                                { value: "", label: "-- Selecione um Item --" },
                                ...optionsList
                              ]}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <Input
                              label="Qtd"
                              type="number"
                              required
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            />
                          </div>

                          <div className="md:col-span-2 flex gap-1 items-center">
                            <div className="flex-1">
                              <Input
                                label="Preço (R$)"
                                type="number"
                                required
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={quoteItems.length === 1}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all cursor-pointer disabled:opacity-50 mt-5"
                              title="Remover Item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotals card */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-150 dark:border-zinc-800 flex flex-col justify-center space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Subtotal dos Itens:</span>
                      <span className="font-bold">{formatCurrency(liveTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Desconto total:</span>
                      <span className="font-bold text-red-500">-{formatCurrency(Number(newQuoteForm.discount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Acréscimos/Impostos:</span>
                      <span className="font-bold text-zinc-650">+{formatCurrency(liveTotals.tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-blue-950 dark:text-zinc-100 pt-2 border-t">
                      <span>Total Geral:</span>
                      <span className="text-success">{formatCurrency(liveTotals.total)}</span>
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
          {/* Search Header Bar (Hidden during printing) */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between print:hidden">
            <div className="w-full sm:max-w-md">
              <Input
                placeholder="Buscar por cliente, proposta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search size={16} />}
              />
            </div>

            {hasPermission("quotes.write") && (
              <Button variant="primary" onClick={() => setView("create")} className="w-full sm:w-auto">
                <Plus size={16} /> Novo Orçamento Completo
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

            {/* Left Side Quote List (Hidden during print) */}
            <div className="xl:col-span-5 space-y-4 print:hidden">
              <Card className="p-0 overflow-hidden shadow-premium">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Histórico de Propostas</span>
                </div>

                <div className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[70vh] overflow-y-auto">
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
                      return (
                        <div
                          key={q.id}
                          onClick={() => setSelectedQuoteId(q.id)}
                          className={`p-4 flex justify-between items-center transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary/5 border-l-4 border-primary"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border-l-4 border-transparent"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-zinc-800 dark:text-zinc-150">#{q.code || q.id.slice(-4)}</span>
                              <StatusBadge status={q.status} />
                            </div>
                            <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{q.clientName}</p>
                            <p className="text-[10px] text-zinc-450">{formatDate(q.createdAt)}</p>
                          </div>

                          <div className="text-right flex flex-col items-end gap-2">
                            <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{formatCurrency(q.total || 0)}</span>

                            {/* Approval and Edit triggers inside list */}
                            <div className="flex gap-1.5 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                              {hasPermission("quotes.write") && canApproveQuote(q.status) && (
                                <button
                                  onClick={async () => {
                                    const details = await getQuoteDetails(q.id);
                                    if (details) handleStartEdit(details);
                                  }}
                                  className="p-1 text-zinc-500 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer"
                                  title="Editar Orçamento"
                                >
                                  <Edit size={15} />
                                </button>
                              )}
                              {hasPermission("quotes.write") && canApproveQuote(q.status) && (
                                <>
                                  <button
                                    onClick={() => void requestQuoteApproval(q)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-success px-2 py-1 text-[10px] font-bold text-white hover:bg-success/90 transition-all cursor-pointer"
                                    title="Aprovar e Gerar OS"
                                  >
                                    <CheckCircle size={13} /> Aprovar
                                  </button>
                                  <button
                                    onClick={() => handleReject(q.id)}
                                    className="p-1 text-danger hover:bg-danger/15 rounded transition-all cursor-pointer"
                                    title="Rejeitar Orçamento"
                                  >
                                    <XCircle size={15} />
                                  </button>
                                </>
                              )}
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
            <div className="xl:col-span-7 space-y-4">

              {/* Action Row for the PDF view */}
              {quoteDetails && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3.5 rounded-xl shadow-premium print:hidden">
                  <span className="text-xs font-bold text-zinc-650 dark:text-zinc-350">Visualização de Proposta Timbrada (Formato A4)</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handlePrint}>
                      <Printer size={14} /> Imprimir / Salvar PDF
                    </Button>
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
              )}

              {loadingDetails ? (
                <div className="py-32 text-center text-zinc-400 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs font-bold">Processando layout PDF...</p>
                </div>
              ) : quoteDetails ? (

                /* High-fidelity Blueprint PDF template matching the uploaded blueprint image */
                <div className="print-a4-sheet bg-white text-zinc-850 p-6 md:p-8 rounded-xl border border-zinc-200/80 shadow-premium font-sans max-w-4xl mx-auto space-y-6 print:border-0 print:shadow-none print:p-0 print:mx-0">

                  {/* HEADER ROW */}
                  <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-blue-950 items-center">

                    {/* Logo and company profile details */}
                    <div className="col-span-5 flex items-center gap-3">
                      {companyParams.logoUrl ? (
                        <img src={companyParams.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-blue-950 text-white rounded-xl flex items-center justify-center shrink-0">
                          <Award size={24} />
                        </div>
                      )}
                      <div className="space-y-0.5">
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
                    <div className="col-span-4 bg-blue-950 text-white p-2.5 text-center rounded-lg space-y-0.5 shadow">
                      <span className="text-[8px] font-bold uppercase tracking-wider block">Proposta Comercial</span>
                      <span className="text-xs font-bold block">Nº {quoteDetails.code}</span>
                      <div className="text-[7.5px] font-bold text-zinc-300 pt-0.5 border-t border-white/10">
                        DATA DA PROPOSTA: {formatDate(quoteDetails.createdAt)}
                      </div>
                    </div>

                    {/* Merchan Header placement */}
                    <div className="col-span-3 border border-zinc-200/80 p-2 bg-zinc-50/50 rounded-lg text-center shadow-sm">
                      <span className="text-[8px] font-bold text-blue-950 uppercase block">ESPAÇO PARA MERCHAN</span>
                      <p className="text-[7px] text-zinc-400 mt-0.5 leading-normal font-semibold">
                        {companyParams.tradeName || "NEXUS CLIMATIZACAO E ELETRICA"}: Ar limpo e manutenção preventiva garantida!
                      </p>
                    </div>
                  </div>

                  {/* DADOS DO CLIENTE & PROPOSTA BOXES */}
                  <div className="grid grid-cols-2 gap-4">

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
                  <div className="overflow-hidden border border-zinc-200 rounded-xl shadow-sm">
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
                            <td className="py-2.5 px-3 text-zinc-800 font-semibold font-sans">
                              {item.description}
                              {item.type === "PECAS" && <span className="ml-1.5 text-[7px] bg-zinc-100 text-zinc-500 py-0.5 px-1 rounded uppercase font-bold">Peça/Material</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-center font-bold">{item.unit || "UN"}</td>
                            <td className="py-2.5 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                                                 </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FOOTER INFO: DIFERENCIAIS, MERCHAN & TOTALS */}
                  <div className="grid grid-cols-3 gap-4 items-stretch">
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
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-200/80 text-[8px] text-zinc-500 leading-relaxed font-semibold">
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
                  <div className="grid grid-cols-12 gap-4 items-end pt-4 border-t border-zinc-200/80">
                    <div className="col-span-8 bg-zinc-50 p-2.5 rounded-lg border border-zinc-150 text-[7.5px] text-zinc-500 italic">
                      <span className="font-bold text-zinc-700 not-italic block mb-0.5 uppercase tracking-wide text-[8px]">Observações:</span>
                      {quoteDetails.notes || "Estaremos sempre à disposição para melhor atendê-los!"}
                    </div>

                    <div className="col-span-4 text-center text-[8.5px] text-zinc-450 border-t border-zinc-300 pt-1.5 mt-4">
                      <span className="font-bold text-zinc-750 block">{currentUser?.name || "Lucas Souza"}</span>
                      Departamento Comercial
                    </div>
                  </div>

                  <div className="bg-blue-950 text-white py-2 px-3 rounded-lg text-center flex justify-between items-center text-[7.5px] font-semibold">
                    <span>Obrigado pela confiança! Soluções que geram resultados.</span>
                    <span className="font-bold uppercase tracking-wider">{companyParams.tradeName || "NEXUS AR"}</span>
                  </div>

                </div>
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
                <Input label="CPF ou CNPJ *" required placeholder="Somente números ou formatado" value={quickClientForm.cpfCnpj} onChange={(e) => setQuickClientForm((prev) => ({ ...prev, cpfCnpj: e.target.value }))} />
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

      {/* 3. DEDICATED MODAL: CADASTRO DE ITEM NO CATÁLOGO (ON-THE-FLY) */}
      <Modal isOpen={isAdhocOpen} onClose={() => setIsAdhocOpen(false)} title="Cadastrar Novo Item no Catálogo Geral">
        <form onSubmit={handleSaveAdhoc} className="space-y-4">
          <Select
            label="Tipo de Item *"
            options={[
              { value: "SERVICO", label: "Serviço Técnico" },
              { value: "PECAS", label: "Peça / Insumo de Estoque" },
            ]}
            value={adhocForm.type}
            onChange={(e) => setAdhocForm((prev) => ({ ...prev, type: e.target.value }))}
          />

          <Input
            label="Nome do Item / Descrição Oficial *"
            required
            placeholder="Ex: Compressor Rotativo 18K BTU"
            value={adhocForm.name}
            onChange={(e) => setAdhocForm((prev) => ({ ...prev, name: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preço de Venda (R$) *"
              type="number"
              required
              placeholder="0.00"
              value={adhocForm.price}
              onChange={(e) => setAdhocForm((prev) => ({ ...prev, price: e.target.value }))}
            />

            <Input
              label="Preço de Custo (R$)"
              type="number"
              placeholder="0.00"
              value={adhocForm.cost}
              onChange={(e) => setAdhocForm((prev) => ({ ...prev, cost: e.target.value }))}
            />
          </div>

          <Input
            label="Unidade de Medida"
            placeholder="Ex: UN, M, KG, PC"
            value={adhocForm.unit}
            onChange={(e) => setAdhocForm((prev) => ({ ...prev, unit: e.target.value }))}
          />

          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsAdhocOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Cadastrar no Catálogo
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
