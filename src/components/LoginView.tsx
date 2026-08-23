"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loginAction, UserSession } from "@/app/actions/userActions";
import { LandingArea } from "@/lib/portalRouting";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, Mail, ShieldAlert, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { PrestadorBrand } from "@/components/brand/PrestadorBrand";

interface LoginViewProps {
  onLoginSuccess: (user: UserSession, landingArea: LandingArea) => void;
  variant?: "app" | "commercial";
}

export default function LoginView({ onLoginSuccess, variant = "app" }: LoginViewProps) {
  const isCommercial = variant === "commercial";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
        onLoginSuccess(res.user, res.landingArea || "app");
      } else {
        setErrorMsg(res.error || "Falha na autenticação.");
      }
    } catch {
      setErrorMsg("Erro de conexão ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-screen select-none items-center justify-center overflow-hidden bg-[#041022] p-3 font-sans text-zinc-900 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(37,99,235,.24),transparent_28rem),radial-gradient(circle_at_88%_85%,rgba(56,189,248,.12),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10 grid w-full max-w-[1180px] overflow-hidden rounded-[30px] border border-white/15 bg-white shadow-[0_45px_120px_rgba(0,6,20,.55)] ring-1 ring-white/5 lg:grid-cols-[1.15fr_.85fr]">
        <aside className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
          <Image src="/brand/nx-login-hero.webp" alt="Infraestrutura predial integrada pelo O Prestador" fill priority unoptimized sizes="(min-width: 1024px) 58vw, 0px" className="object-cover object-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,12,29,.96)_0%,rgba(4,19,45,.79)_45%,rgba(5,22,48,.30)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,27,.16),rgba(3,11,26,.72))]" />
          <div className="relative">
            <PrestadorBrand light />

            <div className="mt-24 max-w-[31rem]">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-100 backdrop-blur-md">
                <Sparkles size={13} /> {isCommercial ? "Portal de vendas e relacionamento" : "Central de gestão integrada"}
              </span>
              <h1 className="mt-7 text-[2.7rem] font-black leading-[1.03] tracking-[-0.055em] xl:text-[3.15rem]">
                {isCommercial ? "Venda com método." : "Toda a operação."}<br />
                <span className="bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent">{isCommercial ? "Cresça com visão." : "Uma única visão."}</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-blue-100/75">
                {isCommercial ? "Leads, propostas, pipeline, metas, comissões e agenda comercial reunidos para sua equipe vender melhor." : "Comercial, ordens de serviço, preventivas, patrimônio, fiscal e financeiro conectados do orçamento ao recebimento."}
              </p>
            </div>

            <div className="mt-11 grid max-w-md gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4 backdrop-blur-md">
              {(isCommercial
                ? ["Pipeline e oportunidades em tempo real", "Follow-ups e propostas no mesmo fluxo", "Metas e comissões com visão da equipe"]
                : ["Fluxos operacionais com histórico completo", "Acesso responsivo no computador, tablet e celular", "Ambiente seguro e disponível na nuvem"]
              ).map((item) => (
                <div key={item} className="flex items-center gap-3 text-xs font-semibold text-blue-50/85">
                  <CheckCircle2 size={16} className="shrink-0 text-cyan-300" /> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[9px] font-black uppercase tracking-[0.14em] text-blue-100/60">
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-300" /> Ambiente protegido</span>
            <span className="flex items-center gap-2"><Wifi size={14} className="text-cyan-300" /> Ambiente online</span>
          </div>
        </aside>

        <main className="relative flex min-h-[650px] flex-col justify-center bg-[linear-gradient(160deg,#ffffff_0%,#f8fbff_58%,#eef5ff_100%)] p-6 sm:p-10 lg:p-12 xl:p-14">
          <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 lg:hidden"><PrestadorBrand /></div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-600">{isCommercial ? "Acesso exclusivo da equipe comercial" : "Acesso corporativo seguro"}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{isCommercial ? "Portal Comercial" : "Bem-vindo de volta"}</h2>
              <p className="mt-2 text-sm text-slate-500">{isCommercial ? "Entre para acompanhar vendas, clientes e resultados." : "Entre com sua conta para continuar a operação."}</p>
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

              <Button variant="primary" type="submit" className="!h-12 w-full !rounded-xl !font-black !shadow-[0_14px_28px_rgba(37,99,235,.25)]" loading={loading}>{isCommercial ? "Entrar no Portal Comercial" : "Entrar no O Prestador"}</Button>
            </form>

            <div className="mt-7 space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <Link href="/recuperar-senha" className="hover:text-blue-600">Esqueci minha senha</Link>
                <Link href="/cadastro" className="hover:text-blue-600">Criar conta</Link>
              </div>
              <Link href="/treinamentos" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">
                <GraduationCap size={16} /> Acessar treinamentos
              </Link>
            </div>

            <div className="mt-5 text-center"><Link href="/" className="text-[11px] font-bold text-blue-600 hover:underline">Voltar para oprestador.tech</Link></div>
            <p className="mt-5 text-center text-[10px] text-slate-400">© 2026 O Prestador · Ambiente corporativo seguro</p>
          </div>
        </main>
      </div>
    </div>
  );
}
