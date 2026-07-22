"use client";

import React, { useState } from "react";
import { Drawer } from "./ui/Drawer";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Phone, Mail, Building } from "lucide-react";
import { formatCurrency, formatDate, formatPhone, formatCpfCnpj } from "@/lib/utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { StatusBadge } from "./ui/StatusBadge";
import { FieldRow } from "./ui/FieldRow";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { updateProduct } from "@/app/actions/inventoryActions";

export default function GlobalDrawer() {
  const { drawer, closeDrawer, openTab } = useWorkspace();

  if (!drawer.isOpen) return null;

  const renderContent = () => {
    const data = drawer.data;
    if (!data) return <p className="text-xs text-zinc-400">Sem dados cadastrados.</p>;

    switch (drawer.type) {
      case "client":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                {data.name?.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{data.name}</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">{formatCpfCnpj(data.cpfCnpj)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Contato</h5>
              <div className="space-y-2 text-xs font-medium text-zinc-700 dark:text-zinc-350">
                <p className="flex items-center gap-2"><Phone size={13} className="text-zinc-400" /> {formatPhone(data.phone)}</p>
                <p className="flex items-center gap-2"><Mail size={13} className="text-zinc-400" /> {data.email}</p>
                {data.segment && <p className="flex items-center gap-2"><Building size={13} className="text-zinc-400" /> Segmento: {data.segment}</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 space-y-2">
              <Button
                variant="primary"
                className="w-full"
                size="sm"
                onClick={() => {
                  openTab("clientes", data.name, { id: data.id });
                  closeDrawer();
                }}
              >
                Abrir Prontuário Completo
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                size="sm"
                onClick={() => {
                  openTab("ordens-servico", `Nova OS`, { new: "true", clientId: data.id });
                  closeDrawer();
                }}
              >
                Nova OS para Cliente
              </Button>
            </div>
          </div>
        );

      case "os":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <span className="text-xs font-medium text-zinc-400">OS #{data.id?.slice(-4)}</span>
              <StatusBadge status={data.status} />
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-lg space-y-3">
                <FieldRow label="Cliente">{data.client?.name || data.clientName}</FieldRow>
                <FieldRow label="Serviço">{data.description || "Manutenção corretiva de ar condicionado"}</FieldRow>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Técnico">{data.technician?.name || "Não atribuído"}</FieldRow>
                <FieldRow label="Data Agendada">{formatDate(data.scheduledDate || data.createdAt)}</FieldRow>
                <FieldRow label="Valor Total">{formatCurrency(data.totalValue || data.value)}</FieldRow>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <Button
                variant="primary"
                className="w-full"
                size="sm"
                onClick={() => {
                  openTab("ordens-servico", `OS #${data.id?.slice(-4)}`, { id: data.id });
                  closeDrawer();
                }}
              >
                Ver Detalhes da OS
              </Button>
            </div>
          </div>
        );

      case "receivable":
      case "payable": {
        const isRec = drawer.type === "receivable";
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <span className="text-xs font-medium text-zinc-400">{isRec ? "Conta a Receber" : "Conta a Pagar"}</span>
              <StatusBadge status={data.status} />
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-lg space-y-3">
                <FieldRow label={isRec ? "Cliente" : "Fornecedor"}>
                  {data.client?.name || data.providerName || data.clientName}
                </FieldRow>
                {data.description && <FieldRow label="Descrição">{data.description}</FieldRow>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Vencimento">{formatDate(data.dueDate)}</FieldRow>
                <FieldRow label="Valor">{formatCurrency(data.value)}</FieldRow>
                {data.category && <FieldRow label="Categoria">{data.category}</FieldRow>}
                {data.bankAccount && <FieldRow label="Conta">{data.bankAccount.name}</FieldRow>}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <Button
                variant="primary"
                className="w-full"
                size="sm"
                onClick={() => {
                  openTab("financeiro", "Financeiro", { tab: isRec ? "receber" : "pagar" });
                  closeDrawer();
                }}
              >
                Abrir Painel Financeiro
              </Button>
            </div>
          </div>
        );
      }

      case "product":
        return <ProductDrawerContent data={data} onClose={closeDrawer} />;

      default:
        return (
          <div className="space-y-4">
            <p className="text-xs text-zinc-650 dark:text-zinc-400">{JSON.stringify(data, null, 2)}</p>
          </div>
        );
    }
  };

  return (
    <Drawer isOpen={drawer.isOpen} onClose={closeDrawer} title={drawer.title}>
      {renderContent()}
    </Drawer>
  );
}

function ProductDrawerContent({ data, onClose }: { data: any, onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { openTab } = useWorkspace();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: data.name || "",
    code: data.code || "",
    stockQuantity: String(data.stockQuantity ?? 0),
    minStock: String(data.minStock ?? 0),
    salePrice: String(data.salePrice ?? 0),
    costPrice: String(data.costPrice ?? (data.salePrice * 0.6)),
    unit: data.unit || "UN",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      toast("Preencha o nome e o código SKU.", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await updateProduct({
        id: data.id,
        code: form.code,
        name: form.name,
        costPrice: parseFloat(form.costPrice) || 0,
        salePrice: parseFloat(form.salePrice) || 0,
        stockQuantity: parseFloat(form.stockQuantity) || 0,
        minStock: parseFloat(form.minStock) || 0,
        unit: form.unit,
        userId: user?.id || "",
      });

      if (res.success) {
        toast("Item de estoque atualizado!", "success");
        setEditMode(false);
        // Dispatch refresh event to update the catalog list in real time
        window.dispatchEvent(new Event("refresh-estoque"));
        onClose();
      } else {
        toast(res.error || "Erro ao salvar alterações.", "error");
      }
    } catch (err) {
      toast("Erro de conexão.", "error");
    } finally {
      setLoading(false);
    }
  };

  const minStockAlert = (parseFloat(form.stockQuantity) || 0) <= (parseFloat(form.minStock) || 0);

  if (editMode) {
    return (
      <form onSubmit={handleSave} className="space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
          <span className="text-xs font-medium text-zinc-400">Editar Item do Estoque</span>
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-700 cursor-pointer"
          >
            Cancelar
          </button>
        </div>

        <Input
          label="Nome da Peça / Item *"
          required
          value={form.name}
          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
        />

        <Input
          label="Código SKU / Ref *"
          required
          value={form.code}
          onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Saldo em Estoque"
            type="number"
            value={form.stockQuantity}
            onChange={(e) => setForm(prev => ({ ...prev, stockQuantity: e.target.value }))}
          />
          <Input
            label="Estoque Mínimo"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm(prev => ({ ...prev, minStock: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Preço Custo (R$)"
            type="number"
            step="0.01"
            value={form.costPrice}
            onChange={(e) => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
          />
          <Input
            label="Preço Venda (R$)"
            type="number"
            step="0.01"
            value={form.salePrice}
            onChange={(e) => setForm(prev => ({ ...prev, salePrice: e.target.value }))}
          />
        </div>

        <Input
          label="Unidade (ex: UN, M, KG)"
          value={form.unit}
          onChange={(e) => setForm(prev => ({ ...prev, unit: e.target.value }))}
        />

        <div className="pt-2 flex gap-2">
          <Button
            variant="secondary"
            type="button"
            className="w-1/2"
            onClick={() => setEditMode(false)}
            disabled={loading}
          >
            Voltar
          </Button>
          <Button
            variant="primary"
            type="submit"
            className="w-1/2"
            loading={loading}
          >
            Salvar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
        <span className="text-xs font-medium text-zinc-400">Detalhes do Estoque</span>
        {minStockAlert ? (
          <span className="bg-danger/10 text-danger text-[9px] font-semibold px-2 py-0.5 rounded-full border border-danger/20">Estoque Crítico</span>
        ) : (
          <span className="bg-success/10 text-success text-[9px] font-semibold px-2 py-0.5 rounded-full border border-success/20">Estoque Regular</span>
        )}
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-3">
        <FieldRow label="Nome do Item">{data.name}</FieldRow>
        <FieldRow label="Código SKU / Referência">
          <span className="font-mono">{data.code || "N/A"}</span>
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Saldo Disponível">
          <span className={minStockAlert ? "text-danger" : ""}>{data.stockQuantity} {data.unit || "UN"}</span>
        </FieldRow>
        <FieldRow label="Estoque Mínimo">{data.minStock || 0} {data.unit || "UN"}</FieldRow>
        <FieldRow label="Preço de Custo">{formatCurrency(data.costPrice ?? (data.salePrice * 0.6))}</FieldRow>
        <FieldRow label="Preço de Venda">{formatCurrency(data.salePrice)}</FieldRow>
      </div>

      <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 space-y-2">
        <Button variant="primary" className="w-full" onClick={() => setEditMode(true)}>
          Editar Cadastro da Peça
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            openTab("estoque", "Estoque");
            onClose();
          }}
        >
          Ver Estoque Completo
        </Button>
      </div>
    </div>
  );
}
