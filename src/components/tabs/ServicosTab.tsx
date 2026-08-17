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
import { getSuppliersForQuote } from "@/app/actions/providerActions";
import { Select } from "../ui/Select";
import { calculateServicePrice } from "@/lib/servicePricing";

export default function ServicosTab() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
    serviceType: "PROPRIO", workforceRegime: "CLT", supplierId: "", referenceCode: "", billingUnit: "SERVIÇO",
    materialCost: "0", laborCost: "0", equipmentCost: "0", otherDirectCost: "0", productivity: "1", estimatedHours: "",
    payrollBurdenPercentage: "70", overheadPercentage: "8", riskPercentage: "3", profitPercentage: "15", serviceTaxPercentage: "6",
  });
  const emptyServiceForm = { id:"", name:"", description:"", price:"", serviceType:"PROPRIO", workforceRegime:"CLT", supplierId:"", referenceCode:"", billingUnit:"SERVIÇO", materialCost:"0", laborCost:"0", equipmentCost:"0", otherDirectCost:"0", productivity:"1", estimatedHours:"", payrollBurdenPercentage:"70", overheadPercentage:"8", riskPercentage:"3", profitPercentage:"15", serviceTaxPercentage:"6" };
  const pricing = calculateServicePrice(Object.fromEntries(["materialCost","laborCost","equipmentCost","otherDirectCost","payrollBurdenPercentage","overheadPercentage","riskPercentage","profitPercentage","serviceTaxPercentage"].map((key)=>[key, Number(serviceForm[key as keyof typeof serviceForm]) || 0])));

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
  useEffect(() => { getSuppliersForQuote().then(setSuppliers).catch(()=>setSuppliers([])); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name) return;

    setActionLoading(true);
    try {
      const res = await createService({
        name: serviceForm.name,
        description: serviceForm.description,
        serviceType: serviceForm.serviceType, workforceRegime: serviceForm.workforceRegime, supplierId: serviceForm.supplierId,
        referenceCode: serviceForm.referenceCode, billingUnit: serviceForm.billingUnit,
        defaultPrice: parseFloat(serviceForm.price) || 0,
        materialCost: Number(serviceForm.materialCost) || 0, laborCost: Number(serviceForm.laborCost) || 0,
        equipmentCost: Number(serviceForm.equipmentCost) || 0, otherDirectCost: Number(serviceForm.otherDirectCost) || 0,
        productivity: Number(serviceForm.productivity) || 1, estimatedHours: Number(serviceForm.estimatedHours) || undefined,
        payrollBurdenPercentage:Number(serviceForm.payrollBurdenPercentage)||0,overheadPercentage:Number(serviceForm.overheadPercentage)||0,riskPercentage:Number(serviceForm.riskPercentage)||0,profitPercentage:Number(serviceForm.profitPercentage)||0,serviceTaxPercentage:Number(serviceForm.serviceTaxPercentage)||0,
      });

      if (res.success) {
        toast("Serviço cadastrado com sucesso!", "success");
        setIsAddOpen(false);
        setServiceForm(emptyServiceForm);
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
      serviceType:service.serviceType||"PROPRIO",workforceRegime:service.workforceRegime||"CLT",supplierId:service.supplierId||"",referenceCode:service.referenceCode||"",billingUnit:service.billingUnit||"SERVIÇO",materialCost:String(service.materialCost||0),laborCost:String(service.laborCost||0),equipmentCost:String(service.equipmentCost||0),otherDirectCost:String(service.otherDirectCost||0),productivity:String(service.productivity||1),estimatedHours:String(service.estimatedHours||""),payrollBurdenPercentage:String(service.payrollBurdenPercentage||0),overheadPercentage:String(service.overheadPercentage||0),riskPercentage:String(service.riskPercentage||0),profitPercentage:String(service.profitPercentage||0),serviceTaxPercentage:String(service.serviceTaxPercentage||0),
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.id || !serviceForm.name) return;

    setActionLoading(true);
    try {
      const res = await updateService(serviceForm.id, {
        name: serviceForm.name,
        description: serviceForm.description,
        serviceType: serviceForm.serviceType, workforceRegime: serviceForm.workforceRegime, supplierId: serviceForm.supplierId,
        referenceCode: serviceForm.referenceCode, billingUnit: serviceForm.billingUnit,
        defaultPrice: parseFloat(serviceForm.price) || 0,
        materialCost: Number(serviceForm.materialCost) || 0, laborCost: Number(serviceForm.laborCost) || 0,
        equipmentCost: Number(serviceForm.equipmentCost) || 0, otherDirectCost: Number(serviceForm.otherDirectCost) || 0,
        productivity: Number(serviceForm.productivity) || 1, estimatedHours: Number(serviceForm.estimatedHours) || undefined,
        payrollBurdenPercentage:Number(serviceForm.payrollBurdenPercentage)||0,overheadPercentage:Number(serviceForm.overheadPercentage)||0,riskPercentage:Number(serviceForm.riskPercentage)||0,profitPercentage:Number(serviceForm.profitPercentage)||0,serviceTaxPercentage:Number(serviceForm.serviceTaxPercentage)||0,
      });

      if (res.success) {
        toast("Serviço atualizado com sucesso!", "success");
        setIsEditOpen(false);
        setServiceForm(emptyServiceForm);
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
        <Table headers={["Serviço / referência", "Execução", "Custo direto", "Preço sugerido", "Ações"]}>
          {services.map((service) => (
            <TableRow key={service.id}>
              <TableCell className="font-semibold text-zinc-900 dark:text-zinc-150">
                <p>{service.name}</p><p className="text-[10px] font-normal text-zinc-500">{service.referenceCode||"Sem código de referência"}</p>
              </TableCell>
              <TableCell className="text-zinc-500">{service.serviceType === "TERCEIRIZADO" ? `Prestador · ${service.supplier?.name || "pendente"}` : "Equipe própria"}</TableCell>
              <TableCell className="font-semibold">{formatCurrency((service.materialCost||0)+(service.laborCost||0)+(service.equipmentCost||0)+(service.otherDirectCost||0))}</TableCell>
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
          <div className="grid grid-cols-2 gap-3"><Select label="Forma de execução" value={serviceForm.serviceType} onChange={(e)=>setServiceForm(p=>({...p,serviceType:e.target.value,supplierId:e.target.value==="PROPRIO"?"":p.supplierId}))} options={[{value:"PROPRIO",label:"Equipe própria"},{value:"TERCEIRIZADO",label:"Prestador"}]}/><Input label="Código de referência" value={serviceForm.referenceCode} onChange={(e)=>setServiceForm(p=>({...p,referenceCode:e.target.value}))} placeholder="Ex.: MAN-001"/></div>
          {serviceForm.serviceType==="TERCEIRIZADO"&&<Select label="Prestador responsável *" required value={serviceForm.supplierId} onChange={(e)=>setServiceForm(p=>({...p,supplierId:e.target.value}))} options={[{value:"",label:"Selecione"},...suppliers.map(s=>({value:s.id,label:s.name}))]}/>} 
          {serviceForm.serviceType === "PROPRIO" && <Select label="Regime da mão de obra" value={serviceForm.workforceRegime} onChange={(e)=>setServiceForm(p=>({...p,workforceRegime:e.target.value,payrollBurdenPercentage:e.target.value==="CLT"?"70":"0"}))} options={[{value:"CLT",label:"Equipe CLT"},{value:"PROFISSIONAL",label:"Profissional / pró-labore"},{value:"AUTONOMO",label:"Autônomo"}]}/>} 
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"><p className="mb-3 text-[10px] font-black uppercase text-zinc-500">Composição do custo direto</p><div className="grid grid-cols-2 gap-3"><Input label="Materiais" type="number" step="0.01" value={serviceForm.materialCost} onChange={(e)=>setServiceForm(p=>({...p,materialCost:e.target.value}))}/><Input label="Mão de obra" type="number" step="0.01" value={serviceForm.laborCost} onChange={(e)=>setServiceForm(p=>({...p,laborCost:e.target.value}))}/><Input label="Equipamentos" type="number" step="0.01" value={serviceForm.equipmentCost} onChange={(e)=>setServiceForm(p=>({...p,equipmentCost:e.target.value}))}/><Input label="Outros diretos" type="number" step="0.01" value={serviceForm.otherDirectCost} onChange={(e)=>setServiceForm(p=>({...p,otherDirectCost:e.target.value}))}/></div><p className="mt-3 text-right text-xs font-black">Custo direto: {formatCurrency(Number(serviceForm.materialCost)+Number(serviceForm.laborCost)+Number(serviceForm.equipmentCost)+Number(serviceForm.otherDirectCost))}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/10"><p className="mb-3 text-[10px] font-black uppercase">Formação interna do preço</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Input label="Encargos pessoal %" type="number" value={serviceForm.payrollBurdenPercentage} onChange={(e)=>setServiceForm(p=>({...p,payrollBurdenPercentage:e.target.value}))}/><Input label="Administração %" type="number" value={serviceForm.overheadPercentage} onChange={(e)=>setServiceForm(p=>({...p,overheadPercentage:e.target.value}))}/><Input label="Risco %" type="number" value={serviceForm.riskPercentage} onChange={(e)=>setServiceForm(p=>({...p,riskPercentage:e.target.value}))}/><Input label="Margem %" type="number" value={serviceForm.profitPercentage} onChange={(e)=>setServiceForm(p=>({...p,profitPercentage:e.target.value}))}/><Input label="Tributo serviço %" type="number" value={serviceForm.serviceTaxPercentage} onChange={(e)=>setServiceForm(p=>({...p,serviceTaxPercentage:e.target.value}))}/></div><div className="mt-3 flex justify-between rounded-lg bg-white p-3 text-xs dark:bg-zinc-900"><span>Custo com encargos: <b>{formatCurrency(pricing.directCost)}</b></span><span>Preço calculado: <b className="text-emerald-600">{formatCurrency(pricing.salePrice)}</b></span></div></div>
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
          <div className="grid grid-cols-2 gap-3"><Select label="Forma de execução" value={serviceForm.serviceType} onChange={(e)=>setServiceForm(p=>({...p,serviceType:e.target.value,supplierId:e.target.value==="PROPRIO"?"":p.supplierId}))} options={[{value:"PROPRIO",label:"Equipe própria"},{value:"TERCEIRIZADO",label:"Prestador"}]}/><Input label="Código de referência" value={serviceForm.referenceCode} onChange={(e)=>setServiceForm(p=>({...p,referenceCode:e.target.value}))}/></div>
          {serviceForm.serviceType==="TERCEIRIZADO"&&<Select label="Prestador responsável *" required value={serviceForm.supplierId} onChange={(e)=>setServiceForm(p=>({...p,supplierId:e.target.value}))} options={[{value:"",label:"Selecione"},...suppliers.map(s=>({value:s.id,label:s.name}))]}/>} 
          {serviceForm.serviceType === "PROPRIO" && <Select label="Regime da mão de obra" value={serviceForm.workforceRegime} onChange={(e)=>setServiceForm(p=>({...p,workforceRegime:e.target.value}))} options={[{value:"CLT",label:"Equipe CLT"},{value:"PROFISSIONAL",label:"Profissional / pró-labore"},{value:"AUTONOMO",label:"Autônomo"}]}/>} 
          <div className="grid grid-cols-2 gap-3"><Input label="Materiais" type="number" step="0.01" value={serviceForm.materialCost} onChange={(e)=>setServiceForm(p=>({...p,materialCost:e.target.value}))}/><Input label="Mão de obra" type="number" step="0.01" value={serviceForm.laborCost} onChange={(e)=>setServiceForm(p=>({...p,laborCost:e.target.value}))}/><Input label="Equipamentos" type="number" step="0.01" value={serviceForm.equipmentCost} onChange={(e)=>setServiceForm(p=>({...p,equipmentCost:e.target.value}))}/><Input label="Outros diretos" type="number" step="0.01" value={serviceForm.otherDirectCost} onChange={(e)=>setServiceForm(p=>({...p,otherDirectCost:e.target.value}))}/></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/10"><p className="mb-3 text-[10px] font-black uppercase">Formação interna do preço</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Input label="Encargos pessoal %" type="number" value={serviceForm.payrollBurdenPercentage} onChange={(e)=>setServiceForm(p=>({...p,payrollBurdenPercentage:e.target.value}))}/><Input label="Administração %" type="number" value={serviceForm.overheadPercentage} onChange={(e)=>setServiceForm(p=>({...p,overheadPercentage:e.target.value}))}/><Input label="Risco %" type="number" value={serviceForm.riskPercentage} onChange={(e)=>setServiceForm(p=>({...p,riskPercentage:e.target.value}))}/><Input label="Margem %" type="number" value={serviceForm.profitPercentage} onChange={(e)=>setServiceForm(p=>({...p,profitPercentage:e.target.value}))}/><Input label="Tributo serviço %" type="number" value={serviceForm.serviceTaxPercentage} onChange={(e)=>setServiceForm(p=>({...p,serviceTaxPercentage:e.target.value}))}/></div><div className="mt-3 flex justify-between rounded-lg bg-white p-3 text-xs dark:bg-zinc-900"><span>Custo com encargos: <b>{formatCurrency(pricing.directCost)}</b></span><span>Preço calculado: <b className="text-emerald-600">{formatCurrency(pricing.salePrice)}</b></span></div></div>
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
