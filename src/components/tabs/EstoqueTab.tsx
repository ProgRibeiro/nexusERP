"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { getProducts, createProduct } from "@/app/actions/inventoryActions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Modal } from "../ui/Modal";
import { ListPageShell } from "../ui/ListPageShell";
import { InsightBar, Insight } from "../ui/InsightBar";
import { Package, Download } from "lucide-react";

export default function EstoqueTab({ newRecord = false, requestId }: { newRecord?: boolean; requestId?: string }) {
  const { hasPermission, user: currentUser } = useAuth();
  const { openDrawer } = useWorkspace();
  const { toast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(newRecord);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (newRecord) setIsAddOpen(true);
  }, [newRecord, requestId]);

  // Form State
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    quantity: "10",
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
        code: productForm.sku,
        name: productForm.name,
        costPrice: parseFloat(productForm.price) * 0.6,
        salePrice: parseFloat(productForm.price) || 0,
        stockQuantity: parseInt(productForm.quantity) || 0,
        minStock: parseInt(productForm.minStock) || 0,
        unit: productForm.unit,
        userId: currentUser?.id || "",
      });

      if (res.success) {
        toast("Item registrado no estoque!", "success");
        setIsAddOpen(false);
        setProductForm({
          name: "",
          sku: "",
          quantity: "10",
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

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast("Nenhum item para exportar.", "warning");
      return;
    }

    const headers = ["SKU", "Nome da Peca", "Quantidade", "Unidade", "Preco Custo (R$)", "Preco Venda (R$)", "Estoque Minimo"];
    const rows = products.map((p) => [
      p.code || "",
      p.name || "",
      p.stockQuantity ?? 0,
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

  const lowStockCount = products.filter((p) => p.stockQuantity <= (p.minStock || 0)).length;
  const insights: Insight[] = lowStockCount > 0
    ? [{ id: "low-stock", severity: "warning", message: "Itens abaixo do estoque mínimo", count: lowStockCount }]
    : [];

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, SKU/Código..."
        insight={<InsightBar insights={insights} />}
        filters={
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download size={15} /> Exportar CSV
          </Button>
        }
        primaryActionLabel={hasPermission("estoque.write") ? "Novo Item / Peça" : undefined}
        onPrimaryAction={hasPermission("estoque.write") ? () => setIsAddOpen(true) : undefined}
        loading={loading}
        isEmpty={products.length === 0}
        emptyIcon={<Package size={28} className="text-zinc-300" />}
        emptyMessage="Nenhum item em estoque"
      >
        <Table headers={["SKU", "Nome da Peça", "Quantidade", "Mínimo", "Preço Venda", "Status"]}>
          {products.map((p) => {
            const isLow = p.stockQuantity <= (p.minStock || 0);
            return (
              <TableRow
                key={p.id}
                onClick={() => openDrawer("product", `Estoque: ${p.name}`, p)}
              >
                <TableCell className="font-mono text-zinc-550 dark:text-zinc-500 font-semibold">{p.code || "N/A"}</TableCell>
                <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</TableCell>
                <TableCell className={`font-semibold ${isLow ? "text-danger" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {p.stockQuantity} {p.unit}
                </TableCell>
                <TableCell className="font-medium text-zinc-650 dark:text-zinc-450">{p.minStock || 0} {p.unit}</TableCell>
                <TableCell className="font-semibold text-zinc-850 dark:text-zinc-100">{formatCurrency(p.salePrice)}</TableCell>
                <TableCell>
                  {isLow ? (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20">Crítico</span>
                  ) : (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Regular</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      </ListPageShell>

      {/* Add Product Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Adicionar Item ao Estoque">
        <form onSubmit={handleCreateProduct} className="space-y-4">
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

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Qtd Atual *"
              type="number"
              required
              value={productForm.quantity}
              onChange={(e) => setProductForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />
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
          </div>

          <Input
            label="Preço de Venda (R$) *"
            type="number"
            required
            placeholder="0.00"
            value={productForm.price}
            onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
          />

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={actionLoading}>Adicionar ao Almoxarifado</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
