"use client";

import React, { useState } from "react";
import { loginAction, UserSession } from "@/app/actions/userActions";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { KeyRound, Mail, Sparkles, Eye, EyeOff, ShieldAlert } from "lucide-react";

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showQuickSelect, setShowQuickSelect] = useState(false);

  // Default pre-seeded test profiles
  const testProfiles = [
    { name: "Lucas Souza (Admin)", email: "admin@erp.com", role: "Administrador" },
    { name: "Roberto Silva (Gestor)", email: "gestor@erp.com", role: "Gestor" },
    { name: "Carlos Técnico (Técnico)", email: "tecnico@erp.com", role: "Técnico" },
    { name: "Flavio Finanças (Financeiro)", email: "financeiro@erp.com", role: "Financeiro" },
    { name: "Paula Vendas (Comercial)", email: "comercial@erp.com", role: "Comercial" },
  ];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await loginAction(email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.error || "Falha na autenticação.");
      }
    } catch (err) {
      setErrorMsg("Erro de conexão ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const selectProfile = (pEmail: string) => {
    setEmail(pEmail);
    setPassword("123");
    setErrorMsg("");
    setShowQuickSelect(false);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-sans select-none">
      <div className="w-full max-w-sm p-8 bg-zinc-900 border border-zinc-800 rounded-2xl relative z-10 space-y-6 mx-4">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-2.5 bg-primary rounded-lg text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">NX ERP</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Entre com sua conta corporativa</p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-xs font-medium text-red-400 animate-in fade-in slide-in-from-top-1 duration-150">
            <ShieldAlert size={14} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <Input
            label="E-mail"
            type="email"
            required
            placeholder="exemplo@erp.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorMsg("");
            }}
            icon={<Mail size={15} />}
            className="!bg-zinc-800 !border-zinc-700 !text-zinc-100 caret-white placeholder:!text-zinc-500"
          />

          <div className="relative">
            <Input
              label="Senha"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg("");
              }}
              icon={<KeyRound size={15} />}
              className="!bg-zinc-800 !border-zinc-700 !text-zinc-100 caret-white placeholder:!text-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 bottom-2.5 p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <div className="pt-1">
            <Button variant="primary" type="submit" className="w-full" loading={loading}>
              Acessar Sistema
            </Button>
          </div>
        </form>

        {/* Test Profiles Selector Panel */}
        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowQuickSelect(!showQuickSelect)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-primary transition-colors cursor-pointer"
          >
            <Sparkles size={12} />
            <span>{showQuickSelect ? "Fechar acesso rápido" : "Acesso rápido de teste"}</span>
          </button>

          {showQuickSelect && (
            <div className="flex flex-col gap-1 p-1.5 bg-zinc-950 border border-zinc-800 rounded-lg animate-in slide-in-from-top-1 duration-150">
              {testProfiles.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => selectProfile(p.email)}
                  className="w-full text-left px-2.5 py-2 hover:bg-zinc-800/60 rounded-md transition-colors flex justify-between items-center cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">{p.name}</p>
                    <p className="text-[10px] text-zinc-550">{p.email}</p>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 bg-zinc-800 text-zinc-400 group-hover:bg-primary/15 group-hover:text-primary rounded transition-colors">
                    {p.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-6 text-[10px] text-zinc-600 pointer-events-none z-10">
        © 2026 NX ERP — Todos os direitos reservados
      </div>
    </div>
  );
}
