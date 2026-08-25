"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import {
  getProducts,
  createProduct,
  convertFutureStockToPresentAction,
} from "@/app/actions/inventoryActions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Modal } from "../ui/Modal";
import { ListPageShell } from "../ui/ListPageShell";
import { InsightBar, Insight } from "../ui/InsightBar";
import { Package, Download, ArrowRight, Zap, CheckCircle2, Clock, Factory } from "lucide-react";

export default function EstoqueTab({ newRecord = false, requestId }: { newRecord?: boolean; requestId?: string }) {
  const { hasPermission, user: currentUser } = useAuth();
  const { openDrawer } = useWorkspace();
  const { toast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [stockTypeFilter, setStockTypeFilter] = useState<"todos" | "presente" | "futuro">("todos");
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(newRecord);
  const [actionLoading, setActionLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    setIsAddOpen(newRecord);
  }, [newRecord, requestId]);

  // Form State
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    quantity: "0",
    futureStock: "0",
    minStock: "5",
    unit: "un",
    price: "",
  });

  async function loadProducts(query = "") {
    setLoading(true);
    try {
      const data = await getProducts(query);
      setProducts(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar catálogo de estoque", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts(search);
  }, [search]);

  useEffect(() => {
    const handleRefresh = () => {
      loadProducts(search);
    };
    window.addEventListener("refresh-estoque", handleRefresh);
    return () => {
      window.removeEventListener("refresh-estoque", handleRefresh);
    };
  }, [search]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) return;

    setActionLoading(true);
    try {
      const res = await createProduct({
        code: productForm.sku || `PECA-${Date.now().toString().slice(-6)}`,
        name: productForm.name,
        costPrice: parseFloat(productForm.price) * 0.6,
        salePrice: parseFloat(productForm.price) || 0,
        stockQuantity: parseFloat(productForm.quantity) || 0,
        futureStock: parseFloat(productForm.futureStock) || 0,
        minStock: parseFloat(productForm.minStock) || 0,
        unit: productForm.unit,
        userId: currentUser?.id || "",
      });

      if (res.success) {
        toast("Item registrado com divisão de estoque Presente e Futuro!", "success");
        setIsAddOpen(false);
        setProductForm({
          name: "",
          sku: "",
          quantity: "0",
          futureStock: "0",
          minStock: "5",
          unit: "un",
          price: "",
        });
        loadProducts();
      } else {
        toast(res.error || "Erro ao registrar produto", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertFutureToPresent = async (e: React.MouseEvent, productId: string, qty: number) => {
    e.stopPropagation();
    setConvertingId(productId);

    try {
      const res = await convertFutureStockToPresentAction({
        productId,
        quantityToConvert: qty,
      });

      if (res.success) {
        toast(`Sucesso! ${res.convertedQuantity} unidade(s) transferida(s) de Estoque Futuro para Presente (Físico).`, "success");
        loadProducts();
      } else {
        toast(res.error || "Erro ao dar entrada no estoque.", "error");
      }
    } catch {
      toast("Erro ao dar entrada no produto.", "error");
    } finally {
      setConvertingId(null);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast("Nenhum item para exportar.", "warning");
      return;
    }

    const headers = ["SKU", "Nome da Peca", "Estoque Presente (Fisico)", "Estoque Futuro (A Comprar)", "Unidade", "Preco Custo (R$)", "Preco Venda (R$)", "Estoque Minimo"];
    const rows = products.map((p) => [
      p.code || "",
      p.name || "",
      p.stockQuantity ?? 0,
      p.futureStock ?? 0,
      p.unit || "UN",
      p.costPrice ?? 0,
      p.salePrice ?? 0,
      p.minStock ?? 0,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.map((val) => typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val).join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nx_erp_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Estoque exportado com sucesso!", "success");
  };

  // Filtragem e Métricas
  const totalPresentUnits = products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  const totalFutureUnits = products.reduce((acc, p) => acc + (p.futureStock || 0), 0);

  const filteredProducts = products.filter((p) => {
    if (stockTypeFilter === "presente") return (p.stockQuantity || 0) > 0;
    if (stockTypeFilter === "futuro") return (p.futureStock || 0) > 0;
    return true;
  });

  const lowStockCount = products.filter((p) => (p.stockQuantity || 0) <= (p.minStock || 0)).length;
  const insights: Insight[] = lowStockCount > 0
    ? [{ id: "low-stock", severity: "warning", message: "Itens com estoque presente abaixo do mínimo", count: lowStockCount }]
    : [];

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* KPI Cards de Divisão de Estoque */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Factory size={15} className="text-emerald-600 dark:text-emerald-400" />
              Estoque Presente (Físico)
            </span>
            <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:text-emerald-300">Pronta Entrega</span>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono">
            {totalPresentUnits} <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">unidades</span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">Materiais disponíveis no almoxarifado</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Clock size={15} className="text-blue-600 dark:text-blue-400" />
              Estoque Futuro (A Comprar)
            </span>
            <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[9px] font-black text-blue-700 dark:text-blue-300">Encomendado</span>
          </div>
          <p className="mt-2 text-2xl font-black text-blue-950 dark:text-blue-100 font-mono">
            {totalFutureUnits} <span className="text-xs font-bold text-blue-700 dark:text-blue-400">unidades</span>
          </p>
          <p className="mt-1 text-[11px] text-blue-800 dark:text-blue-300">Materiais para compras futuras e obras</p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">
              Total de Itens Cadastrados
            </span>
            <span className="rounded-full bg-purple-600/10 px-2 py-0.5 text-[9px] font-black text-purple-700 dark:text-purple-300">Catálogo Master</span>
          </div>
          <p className="mt-2 text-2xl font-black text-purple-950 dark:text-purple-100 font-mono">
            {products.length} <span className="text-xs font-bold text-purple-700 dark:text-purple-400">produtos</span>
          </p>
          <p className="mt-1 text-[11px] text-purple-800 dark:text-purple-300">Divididos entre físico e projeção</p>
        </div>
      </div>

      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, SKU/Código..."
        insight={<InsightBar insights={insights} />}
        filters={
          <div className="flex items-center gap-2">
            {/* Filtro por Divisão de Estoque */}
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStockTypeFilter("todos")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  stockTypeFilter === "todos"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setStockTypeFilter("presente")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  stockTypeFilter === "presente"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                📦 Estoque Presente ({products.filter((p) => (p.stockQuantity || 0) > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setStockTypeFilter("futuro")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  stockTypeFilter === "futuro"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                ⏳ Estoque Futuro ({products.filter((p) => (p.futureStock || 0) > 0).length})
              </button>
            </div>

            <Button variant="secondary" onClick={handleExportCSV}>
              <Download size={15} /> CSV
            </Button>
          </div>
        }
        primaryActionLabel={hasPermission("estoque.write") ? "Novo Item / Peça" : undefined}
        onPrimaryAction={hasPermission("estoque.write") ? () => setIsAddOpen(true) : undefined}
        loading={loading}
        isEmpty={filteredProducts.length === 0}
        emptyIcon={<Package size={28} className="text-zinc-300" />}
        emptyMessage="Nenhum item cadastrado nesta visão de estoque."
      >
        <Table headers={["SKU", "Nome da Peça", "Estoque Presente (Físico)", "Estoque Futuro (A Comprar)", "Mínimo", "Preço Venda", "Ações / Entrada"]}>
          {filteredProducts.map((p) => {
            const isLow = (p.stockQuantity || 0) <= (p.minStock || 0);
            const hasFutureStock = (p.futureStock || 0) > 0;

            return (
              <TableRow
                key={p.id}
                onClick={() => openDrawer("product", `Estoque: ${p.name}`, p)}
              >
                <TableCell className="font-mono text-zinc-550 dark:text-zinc-500 font-semibold">{p.code || "N/A"}</TableCell>
                <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</TableCell>
                
                {/* Estoque Presente */}
                <TableCell>
                  <span className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-xl ${
                    isLow
                      ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                  }`}>
                    📦 {p.stockQuantity || 0} {p.unit}
                  </span>
                </TableCell>

                {/* Estoque Futuro */}
                <TableCell>
                  {hasFutureStock ? (
                    <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                      ⏳ {p.futureStock} {p.unit}
                    </span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-600 text-xs">0 {p.unit}</span>
                  )}
                </TableCell>

                <TableCell className="font-medium text-zinc-650 dark:text-zinc-450">{p.minStock || 0} {p.unit}</TableCell>
                <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">{formatCurrency(p.salePrice)}</TableCell>

                {/* Ações: Dar entrada de Futuro para Presente */}
                <TableCell>
                  {hasFutureStock ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={convertingId === p.id}
                      onClick={(e) => handleConvertFutureToPresent(e, p.id, p.futureStock)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg"
                      title="Chegou no almoxarifado? Clique para converter o Estoque Futuro em Presente (Físico)"
                    >
                      <Zap size={12} className="mr-1" /> Dar Entrada (Físico)
                    </Button>
                  ) : (
                    <span className="text-[10px] text-zinc-400 font-medium">Sem pendência</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      </ListPageShell>

      {/* Add Product Modal com divisão de Estoque Presente e Futuro */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Adicionar Item com Divisão de Estoque">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <Input
            label="Nome do Item / Peça *"
            required
            placeholder="Ex: Válvula Expansora Daikin"
            value={productForm.name}
            onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Código SKU / Ref"
            placeholder="Ex: SKU-VALV-DK-01"
            value={productForm.sku}
            onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <label className="block font-extrabold text-emerald-700 dark:text-emerald-300 mb-1">
                📦 Qtd Presente (Físico no Almoxarifado) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={productForm.quantity}
                onChange={(e) => setProductForm((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full rounded-xl border border-emerald-300 bg-white p-2.5 font-mono text-xs font-bold text-zinc-900 focus:border-emerald-600 focus:outline-none dark:border-emerald-900 dark:bg-zinc-800 dark:text-white"
              />
              <span className="text-[10px] text-zinc-500 mt-0.5 block">Pronta entrega no estoque</span>
            </div>

            <div>
              <label className="block font-extrabold text-blue-700 dark:text-blue-300 mb-1">
                ⏳ Qtd Futuro (A Comprar / Encomendado)
              </label>
              <input
                type="number"
                min="0"
                value={productForm.futureStock}
                onChange={(e) => setProductForm((prev) => ({ ...prev, futureStock: e.target.value }))}
                className="w-full rounded-xl border border-blue-300 bg-white p-2.5 font-mono text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none dark:border-blue-900 dark:bg-zinc-800 dark:text-white"
              />
              <span className="text-[10px] text-zinc-500 mt-0.5 block">Previsão de compra para obras</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Mínimo *"
              type="number"
              required
              value={productForm.minStock}
              onChange={(e) => setProductForm((prev) => ({ ...prev, minStock: e.target.value }))}
            />
            <Input
              label="Unidade *"
              required
              placeholder="ex: un, m, kg"
              value={productForm.unit}
              onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}
            />
            <Input
              label="Preço Venda (R$) *"
              type="number"
              required
              placeholder="0.00"
              value={productForm.price}
              onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Salvar no Almoxarifado
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

