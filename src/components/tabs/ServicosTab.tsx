"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { getServices, createService, updateService, deleteService } from "@/app/actions/serviceActions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Table, TableRow, TableCell } from "../ui/Table";
import { Modal } from "../ui/Modal";
import { ListPageShell } from "../ui/ListPageShell";
import { Briefcase, Edit, Trash2 } from "lucide-react";

export default function ServicosTab() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms States
  const [serviceForm, setServiceForm] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
  });

  async function loadServices(query = "") {
    setLoading(true);
    try {
      const data = await getServices(query);
      setServices(data);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar catálogo de serviços", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadServices(search);
    }, 0);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name || !serviceForm.price) return;

    setActionLoading(true);
    try {
      const res = await createService({
        name: serviceForm.name,
        description: serviceForm.description,
        defaultPrice: parseFloat(serviceForm.price) || 0,
      });

      if (res.success) {
        toast("Serviço cadastrado com sucesso!", "success");
        setIsAddOpen(false);
        setServiceForm({ id: "", name: "", description: "", price: "" });
        loadServices();
      } else {
        toast(res.error || "Erro ao registrar serviço", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditOpen = (service: any) => {
    setServiceForm({
      id: service.id,
      name: service.name,
      description: service.description || "",
      price: String(service.defaultPrice),
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.id || !serviceForm.name || !serviceForm.price) return;

    setActionLoading(true);
    try {
      const res = await updateService(serviceForm.id, {
        name: serviceForm.name,
        description: serviceForm.description,
        defaultPrice: parseFloat(serviceForm.price) || 0,
      });

      if (res.success) {
        toast("Serviço atualizado com sucesso!", "success");
        setIsEditOpen(false);
        setServiceForm({ id: "", name: "", description: "", price: "" });
        loadServices();
      } else {
        toast(res.error || "Erro ao atualizar serviço", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este serviço do catálogo?")) return;

    try {
      const res = await deleteService(id);
      if (res.success) {
        toast("Serviço excluído!", "success");
        loadServices();
      } else {
        toast(res.error || "Erro ao excluir serviço", "error");
      }
    } catch (err) {
      toast("Erro de conexão", "error");
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <ListPageShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome do serviço..."
        primaryActionLabel={hasPermission("estoque.write") ? "Novo Serviço" : undefined}
        onPrimaryAction={hasPermission("estoque.write") ? () => setIsAddOpen(true) : undefined}
        loading={loading}
        isEmpty={services.length === 0}
        emptyIcon={<Briefcase size={28} className="text-zinc-300" />}
        emptyMessage="Nenhum serviço localizado"
      >
        <Table headers={["Nome do Serviço", "Descrição", "Preço Padrão (R$)", "Ações"]}>
          {services.map((service) => (
            <TableRow key={service.id}>
              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-150">
                {service.name}
              </TableCell>
              <TableCell className="text-zinc-500 max-w-xs truncate">
                {service.description || <span className="text-zinc-400 font-normal italic">Sem descrição</span>}
              </TableCell>
              <TableCell className="font-semibold text-zinc-800 dark:text-zinc-200">
                {formatCurrency(service.defaultPrice)}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {hasPermission("estoque.write") && (
                    <>
                      <button
                        onClick={() => handleEditOpen(service)}
                        className="p-1 text-zinc-450 hover:text-primary transition-colors cursor-pointer"
                        title="Editar Serviço"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="p-1 text-zinc-450 hover:text-danger transition-colors cursor-pointer"
                        title="Excluir Serviço"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </ListPageShell>

      {/* MODAL: Novo Serviço */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Cadastrar Novo Serviço"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nome do Serviço *"
            required
            value={serviceForm.name}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Instalação de Ar Condicionado Split"
          />
          <Input
            label="Descrição detalhada"
            value={serviceForm.description}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descreva o que o serviço inclui..."
          />
          <Input
            label="Preço Padrão Sugerido (R$) *"
            type="number"
            step="0.01"
            required
            value={serviceForm.price}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="0.00"
          />
          <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Salvar Serviço
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Editar Serviço */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Editar Cadastro do Serviço"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Nome do Serviço *"
            required
            value={serviceForm.name}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Descrição detalhada"
            value={serviceForm.description}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Input
            label="Preço Padrão Sugerido (R$) *"
            type="number"
            step="0.01"
            required
            value={serviceForm.price}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
          />
          <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Atualizar Serviço
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
