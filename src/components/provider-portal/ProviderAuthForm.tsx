"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldAlert,
  User,
  FileText,
  Phone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { loginProviderPortal, registerProviderPortal } from "@/app/actions/providerPortalActions";

export function ProviderAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    document: "",
    phone: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result =
        mode === "login"
          ? await loginProviderPortal(form.email, form.password)
          : await registerProviderPortal(form);

      setLoading(false);

      if (result.success) {
        router.push("/portal/prestador/painel");
        router.refresh();
      } else {
        setError(result.error || "Não foi possível autenticar. Verifique seus dados.");
      }
    } catch (err) {
      setLoading(false);
      setError("Erro de conexão ao acessar o portal.");
    }
  };

  const inputClass =
    "h-12 w-full rounded-xl border border-white/10 bg-white/[.045] px-4 text-xs font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-[#d4af37] focus:bg-white/[.08] focus:ring-4 focus:ring-[#d4af37]/15";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {mode === "register" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Nome ou Razão Social */}
          <div className="relative">
            <User className="absolute left-4 top-3.5 text-zinc-500" size={17} />
            <input
              className={`${inputClass} pl-11`}
              required
              placeholder="Nome Completo ou Razão Social"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Documento CPF/CNPJ */}
            <div className="relative">
              <FileText className="absolute left-4 top-3.5 text-zinc-500" size={17} />
              <input
                className={`${inputClass} pl-11`}
                required
                placeholder="CPF ou CNPJ"
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
              />
            </div>

            {/* Telefone / WhatsApp */}
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 text-zinc-500" size={17} />
              <input
                className={`${inputClass} pl-11`}
                required
                placeholder="Telefone com DDD / WhatsApp"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* E-mail */}
      <div className="relative">
        <Mail className="absolute left-4 top-3.5 text-zinc-500" size={17} />
        <input
          className={`${inputClass} pl-11`}
          type="email"
          required
          autoComplete="email"
          placeholder="seu.email@empresa.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>

      {/* Senha */}
      <div className="relative">
        <LockKeyhole className="absolute left-4 top-3.5 text-zinc-500" size={17} />
        <input
          className={`${inputClass} pl-11 pr-11`}
          type={showPassword ? "text" : "password"}
          minLength={6}
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "login" ? "Digite sua senha de acesso" : "Crie uma senha segura (mínimo 6 dígitos)"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button
          type="button"
          aria-label="Mostrar senha"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-3.5 text-zinc-500 hover:text-white transition-colors"
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-300 animate-in fade-in duration-150">
          <ShieldAlert size={16} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#e6c653] to-[#b88d1b] text-xs font-black text-black shadow-lg shadow-[#d4af37]/25 transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <Loader2 className="animate-spin text-black" size={18} />
        ) : (
          <>
            <span>{mode === "login" ? "Acessar Painel do Técnico" : "Concluir Cadastro de Prestador"}</span>
            <ArrowRight size={15} />
          </>
        )}
      </button>

      <div className="pt-2 text-center text-xs text-zinc-400">
        {mode === "login" ? (
          <p>
            Ainda não possui cadastro de parceiro?{" "}
            <Link className="font-bold text-[#d4af37] hover:underline" href="/portal/prestador/cadastro">
              Cadastre-se como Prestador
            </Link>
          </p>
        ) : (
          <p>
            Já possui cadastro de prestador ativo?{" "}
            <Link className="font-bold text-[#d4af37] hover:underline" href="/portal/prestador/login">
              Entrar no Portal
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
