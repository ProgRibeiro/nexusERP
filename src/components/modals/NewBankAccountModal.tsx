"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createBankAccountAction } from "@/app/actions/financialActions";
import { Building, Landmark, CreditCard, DollarSign } from "lucide-react";

interface NewBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NewBankAccountModal({
  isOpen,
  onClose,
  onSuccess,
}: NewBankAccountModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bank, setBank] = useState("Itaú Unibanco");
  const [agency, setAgency] = useState("0001");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Informe o nome da conta ou caixa.", "warning");
      return;
    }

    try {
      setLoading(true);
      const res = await createBankAccountAction({
        name: name.trim(),
        bank: bank.trim(),
        agency: agency.trim(),
        accountNumber: accountNumber.trim() || "0000",
        initialBalance: parseFloat(initialBalance) || 0,
      });

      if (res.success) {
        toast(`Conta "${name}" cadastrada com sucesso!`, "success");
        setName("");
        setAccountNumber("");
        setInitialBalance("0");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast((res as any).error || "Erro ao cadastrar conta bancária.", "error");
      }
    } catch {
      toast("Erro de conexão ao cadastrar conta.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Nova Conta / Caixa / Cartão"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Input
          label="Nome da Conta ou Caixa *"
          required
          placeholder="Ex: Itaú Empresa, Nubank Cartão Corporativo, Caixa Tesouraria"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Banco / Instituição *"
            options={[
              { value: "Itaú Unibanco", label: "Itaú Unibanco" },
              { value: "Bradesco", label: "Bradesco" },
              { value: "Banco do Brasil", label: "Banco do Brasil" },
              { value: "Santander", label: "Santander" },
              { value: "Nubank", label: "Nubank (Nu Pagamentos)" },
              { value: "Banco Inter", label: "Banco Inter" },
              { value: "Caixa Econômica", label: "Caixa Econômica Federal" },
              { value: "Sicoob / Sicredi", label: "Sicoob / Sicredi" },
              { value: "Caixa Interno", label: "Caixa Interno / Dinheiro" },
              { value: "Outro", label: "Outra Instituição" },
            ]}
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />

          <Input
            label="Agência"
            placeholder="0001"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Número da Conta / Cartão"
            placeholder="Ex: 12345-6 ou Cartão Final 8890"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />

          <Input
            label="Saldo Inicial (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>

        <div className="pt-3 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" loading={loading} className="bg-blue-600 font-bold text-white">
            <Landmark size={15} className="mr-1.5" /> Salvar Conta Bancária
          </Button>
        </div>
      </form>
    </Modal>
  );
}
