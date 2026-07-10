"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProducts,
  createProduct,
  adjustProductStock,
  getStockMovements,
  getSuppliers,
  ProductDTO,
} from "@/app/actions/inventoryActions";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Package,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  FileText,
  Truck,
  TrendingUp,
  Tag,
  Loader2,
  Calendar,
  Layers,
  History,
} from "lucide-react";

import Link from "next/link";

export default function EstoquePage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"inventory" | "movements">("inventory");
  
  // Dados do Estoque
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Formulários
  const [productForm, setProductForm] = useState({
    code: "",
    name: "",
    type: "PECA",
    costPrice: "",
    salePrice: "",
    stockQuantity: "",
    minStock: "",
    unit: "UN",
    supplierId: "",
  });

  const [adjustForm, setAdjustForm] = useState({
    productId: "",
    type: "ENTRADA" as "ENTRADA" | "SAIDA",
    quantity: "",
    reason: "COMPRA" as "COMPRA" | "AJUSTE" | "PERDA",
  });

  // Carregar dados de inventário e logs
  async function loadInventoryData() {
    setLoading(true);
    const prods = await getProducts();
    const movs = await getStockMovements();
    const sups = await getSuppliers();

    setProducts(prods);
    setMovements(movs);
    setSuppliers(sups);

    if (prods.length > 0) {
      setAdjustForm((prev) => ({ ...prev, productId: prods[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInventoryData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    // Filtragem local para maior rapidez de digitação
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.code || !productForm.name || !productForm.costPrice || !productForm.salePrice || !currentUser) return;

    setActionLoading(true);
    const res = await createProduct({
      code: productForm.code,
      name: productForm.name,
      type: productForm.type,
      costPrice: parseFloat(productForm.costPrice) || 0,
      salePrice: parseFloat(productForm.salePrice) || 0,
      stockQuantity: parseFloat(productForm.stockQuantity) || 0,
      minStock: parseFloat(productForm.minStock) || 0,
      unit: productForm.unit,
      supplierId: productForm.supplierId || undefined,
      userId: currentUser.id,
    });

    if (res.success) {
      setIsProductModalOpen(false);
      setProductForm({
        code: "",
        name: "",
        type: "PECA",
        costPrice: "",
        salePrice: "",
        stockQuantity: "",
        minStock: "",
        unit: "UN",
        supplierId: "",
      });
      await loadInventoryData();
    } else {
      alert("Erro ao cadastrar peça: " + res.error);
    }
    setActionLoading(false);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.productId || !adjustForm.quantity || !currentUser) return;

    setActionLoading(true);
    const res = await adjustProductStock({
      productId: adjustForm.productId,
      type: adjustForm.type,
      quantity: parseFloat(adjustForm.quantity) || 0,
      reason: adjustForm.reason,
      userId: currentUser.id,
    });

    if (res.success) {
      setIsAdjustModalOpen(false);
      setAdjustForm({
        productId: products[0]?.id || "",
        type: "ENTRADA",
        quantity: "",
        reason: "COMPRA",
      });
      await loadInventoryData();
    } else {
      alert("Erro ao ajustar estoque: " + res.error);
    }
    setActionLoading(false);
  };

  // Filtrar produtos localmente
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const getStockStatusClass = (qty: number, min: number) => {
    if (qty <= 0) return "bg-red-500/10 text-red-500 border border-red-500/20 font-black animate-pulse";
    if (qty <= min) return "bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold";
    return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Resumo Rápido Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Itens em Estoque</span>
            <p className="text-2xl font-black text-zinc-950 mt-1">{products.length} Peças</p>
            <p className="text-xs text-zinc-400 font-medium">Cadastradas no almoxarifado</p>
          </div>
          <div className="bg-zinc-50 p-3 rounded-xl">
            <Package className="text-zinc-600" size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valor do Inventário (Custo)</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {formatCurrency(products.reduce((sum, p) => sum + p.stockQuantity * p.costPrice, 0))}
            </p>
            <p className="text-xs text-zinc-400 font-medium">Capital imobilizado em peças</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl">
            <TrendingUp className="text-emerald-600" size={24} />
          </div>
        </div>

        {/* Alertas Críticos */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Reposição Necessária</span>
            <p className="text-2xl font-black text-red-500 mt-1">
              {products.filter((p) => p.stockQuantity <= p.minStock).length} Alertas
            </p>
            <p className="text-xs text-zinc-400 font-medium">Itens abaixo do estoque mínimo</p>
          </div>
          <div className="bg-red-50 p-3 rounded-xl">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
        </div>
      </div>

      {/* Tabela de Produtos / Movimentações */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
        {/* Toolbar das Abas */}
        <div className="border-b border-zinc-100 flex justify-between items-center px-6 bg-zinc-50/50 flex-wrap gap-3 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "inventory"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Layers size={14} /> Saldo de Peças
            </button>
            <button
              onClick={() => setActiveTab("movements")}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === "movements"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <History size={14} /> Movimentações (Logs)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "inventory" && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-zinc-400" size={14} />
                  <input
                    type="text"
                    placeholder="Pesquisar estoque..."
                    value={search}
                    onChange={handleSearchChange}
                    className="pl-8 pr-4 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
                {hasPermission("estoque.write") && (
                  <>
                    <button
                      onClick={() => setIsAdjustModalOpen(true)}
                      className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Ajustar Saldo
                    </button>
                    <button
                      onClick={() => setIsProductModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/10 cursor-pointer"
                    >
                      <Plus size={14} /> Novo Item
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              <span className="text-xs">Carregando almoxarifado...</span>
            </div>
          ) : activeTab === "inventory" ? (
            /* ABA 1: Saldo de Peças (Inventário) */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Código</th>
                    <th className="p-3">Especificação da Peça</th>
                    <th className="p-3 w-16 text-center">Unidade</th>
                    <th className="p-3 text-right">Custo Unitário</th>
                    <th className="p-3 text-right">Venda Unitária</th>
                    <th className="p-3 text-right">Estoque Crítico</th>
                    <th className="p-3 text-center w-28">Saldo Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 italic">Nenhum produto em estoque.</td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-800 font-bold">{p.code}</td>
                        <td className="p-3 font-semibold text-zinc-750 flex flex-col gap-0.5">
                          <span>{p.name}</span>
                          {p.supplierName && (
                            <span className="text-[9px] text-zinc-400 font-normal flex items-center gap-0.5">
                              <Truck size={10} /> Fornec: {p.supplierName}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">{p.unit}</td>
                        <td className="p-3 text-right text-zinc-500">{formatCurrency(p.costPrice)}</td>
                        <td className="p-3 text-right text-zinc-700 font-bold">{formatCurrency(p.salePrice)}</td>
                        <td className="p-3 text-right text-red-500 font-semibold">{p.minStock} {p.unit}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getStockStatusClass(p.stockQuantity, p.minStock)}`}>
                            {p.stockQuantity} {p.unit}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ABA 2: Movimentações (Logs) */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 font-bold uppercase text-[9px]">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3 font-semibold">Motivo</th>
                    <th className="p-3 font-semibold">OS Vinculada</th>
                    <th className="p-3 text-right">Custo Carga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 italic">Nenhuma movimentação de estoque efetuada.</td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 text-zinc-400">{formatDate(mov.date)}</td>
                        <td className="p-3 text-zinc-800 font-bold flex flex-col">
                          <span>{mov.productName}</span>
                          <span className="text-[9px] text-zinc-400 font-normal">{mov.productCode}</span>
                        </td>
                        <td className="p-3">
                          {mov.type === "ENTRADA" ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <ArrowUpRight size={12} /> Entrada
                            </span>
                          ) : (
                            <span className="text-red-500 font-bold flex items-center gap-1">
                              <ArrowDownLeft size={12} /> Saída
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-zinc-800 font-bold">{mov.quantity}</td>
                        <td className="p-3 font-semibold text-zinc-500">{mov.reason}</td>
                        <td className="p-3 font-semibold text-blue-600 underline">
                          {mov.osCode ? (
                            <Link href={`/ordens-servico?code=${mov.osCode}`}>
                              {mov.osCode}
                            </Link>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-zinc-700">{formatCurrency(mov.cost * mov.quantity)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Novo Produto / Peça */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-sm">Cadastrar Peça / Equipamento master</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 block mb-1">Código Único (Ref) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: P-0007"
                    value={productForm.code}
                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Unidade de Medida</label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="RL">RL (Rolo)</option>
                    <option value="KM">KM (Quilômetro)</option>
                    <option value="HR">HR (Hora)</option>
                    <option value="LT">LT (Litro)</option>
                    <option value="KG">KG (Quilo)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-zinc-500 block mb-1">Nome / Descrição da Peça *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Motor Ventilador Condensadora Midea 12k"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Preço de Custo (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 120.00"
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 260.00"
                    value={productForm.salePrice}
                    onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Saldo Inicial Almoxarifado *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 10"
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Estoque Mínimo (Alerta) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 3"
                    value={productForm.minStock}
                    onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs focus:outline-none text-right"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-zinc-500 block mb-1">Fornecedor Principal</label>
                  <select
                    value={productForm.supplierId}
                    onChange={(e) => setProductForm({ ...productForm, supplierId: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="">Nenhum fornecedor vinculado</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded-lg hover:bg-zinc-50 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Cadastrar Peça
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Ajuste de Saldo (Manuais de Entrada/Saída) */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-zinc-800 text-sm">Registrar Entrada / Saída Manual</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 font-bold">✕</button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-5 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-zinc-500 block mb-1">Selecionar Peça/Produto *</label>
                <select
                  required
                  value={adjustForm.productId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                  className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} (Saldo: {p.stockQuantity} {p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 block mb-1">Ação de Estoque</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, type: e.target.value as "ENTRADA" | "SAIDA" })
                    }
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="ENTRADA">Entrada (Compra/Ajuste)</option>
                    <option value="SAIDA">Saída (Ajuste/Perda/Venda)</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-1">Motivo do Ajuste</label>
                  <select
                    value={adjustForm.reason}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, reason: e.target.value as "COMPRA" | "AJUSTE" | "PERDA" })
                    }
                    className="w-full border border-zinc-200 rounded p-2 text-xs bg-white focus:outline-none"
                  >
                    <option value="COMPRA">Nova Compra</option>
                    <option value="AJUSTE">Ajuste de Balanço / Inventário</option>
                    <option value="PERDA">Perda / Descarte Técnico</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-zinc-500 block mb-1">Quantidade *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 5"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                    className="w-full border border-zinc-200 rounded p-2 text-xs text-center focus:outline-none font-bold text-zinc-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-500 rounded-lg hover:bg-zinc-50 cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !adjustForm.quantity}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {actionLoading && <Loader2 size={12} className="animate-spin" />}
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
