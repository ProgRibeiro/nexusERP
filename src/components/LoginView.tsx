"use client";

import React, { useState } from "react";
import Image from "next/image";
import { loginAction, UserSession } from "@/app/actions/userActions";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { CheckCircle2, Eye, EyeOff, KeyRound, Mail, ShieldAlert, ShieldCheck, Sparkles, Wifi } from "lucide-react";

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
    } catch {
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
    <div className="relative flex min-h-[100dvh] w-screen select-none items-center justify-center overflow-hidden bg-[#061020] p-3 font-sans text-zinc-900 sm:p-6">
      <div className="pointer-events-none absolute -left-40 top-[-18rem] h-[38rem] w-[38rem] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-64 right-[-12rem] h-[42rem] w-[42rem] rounded-full bg-cyan-500/10 blur-[140px]" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_32px_90px_rgba(1,8,23,.45)] lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden min-h-[650px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#07152d_0%,#0c2758_62%,#0e4bb5_145%)] p-10 text-white lg:flex">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.13)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Image src="/icons/icon-192.png" width={48} height={48} alt="NX ERP" className="h-12 w-12 rounded-2xl ring-1 ring-white/20" priority />
              <div>
                <p className="text-lg font-black tracking-tight">NX ERP</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">Nexus operacional</p>
              </div>
            </div>

            <div className="mt-20 max-w-md">
              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-300/15 bg-blue-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
                <Sparkles size={13} /> Central de gestão integrada
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-[-0.04em]">Sua operação inteira, organizada em um só lugar.</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100/70">Comercial, ordens de serviço, preventivas, patrimônio, fiscal e financeiro conectados do orçamento ao recebimento.</p>
            </div>

            <div className="mt-10 grid gap-3">
              {["Fluxos operacionais com histórico completo", "Acesso responsivo no computador, tablet e celular", "Dados centralizados no seu servidor local"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-xs font-semibold text-blue-50/85">
                  <CheckCircle2 size={16} className="shrink-0 text-cyan-300" /> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-wider text-blue-100/55">
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-300" /> Ambiente protegido</span>
            <span className="flex items-center gap-2"><Wifi size={14} className="text-cyan-300" /> Servidor local</span>
          </div>
        </aside>

        <main className="flex min-h-[620px] flex-col justify-center bg-white p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Image src="/icons/icon-192.png" width={44} height={44} alt="NX ERP" className="h-11 w-11 rounded-xl" priority />
              <div><p className="font-black">NX ERP</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Gestão integrada</p></div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Acesso corporativo</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm text-slate-500">Entre com sua conta para continuar a operação.</p>
            </div>

            {errorMsg && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-1 duration-150">
                <ShieldAlert size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="mt-7 space-y-4">
              <Input label="E-mail" type="email" required autoComplete="username" placeholder="voce@empresa.com.br" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }} icon={<Mail size={16} />} className="!h-12 !border-slate-200 !bg-slate-50 !text-slate-950 caret-blue-600 placeholder:!text-slate-400 focus:!bg-white" />

              <div className="relative">
                <Input label="Senha" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }} icon={<KeyRound size={16} />} className="!h-12 !border-slate-200 !bg-slate-50 !pr-11 !text-slate-950 caret-blue-600 placeholder:!text-slate-400 focus:!bg-white" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-3 right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <Button variant="primary" type="submit" className="!h-12 w-full !rounded-xl !font-black !shadow-lg !shadow-blue-600/20" loading={loading}>Acessar o NX ERP</Button>
            </form>

            <div className="mt-7 space-y-3 border-t border-slate-200 pt-5">
              <button type="button" onClick={() => setShowQuickSelect(!showQuickSelect)} className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-blue-600">
                <Sparkles size={13} />
                <span>{showQuickSelect ? "Fechar acesso rápido" : "Acesso rápido de teste"}</span>
              </button>

              {showQuickSelect && (
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 animate-in slide-in-from-top-1 duration-150">
                  {testProfiles.map((p) => (
                    <button key={p.email} type="button" onClick={() => selectProfile(p.email)} className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white hover:shadow-sm">
                      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 group-hover:text-slate-950">{p.name}</p><p className="truncate text-[10px] text-slate-400">{p.email}</p></div>
                      <span className="ml-3 rounded-md bg-slate-200/70 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600">{p.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-8 text-center text-[10px] text-slate-400">© 2026 NX ERP · Ambiente corporativo Nexus</p>
          </div>
        </main>
      </div>
    </div>
  );
}
