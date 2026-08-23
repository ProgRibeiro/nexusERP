"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { devLoginAction } from "@/app/actions/devActions";
import { ShieldCheck, Key, Lock, Mail, ArrowRight, Terminal, CheckCircle2 } from "lucide-react";

export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await devLoginAction(email, password);
      if (res.success) {
        router.push("/dev");
      } else {
        setError(res.error || "Credenciais de desenvolvedor inválidas.");
      }
    } catch {
      setError("Erro ao autenticar no Console do Desenvolvedor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-blue-500/20 border border-amber-500/30 shadow-[0_0_30px_rgba(37,99,235,0.15)] mb-2">
            <Terminal size={30} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            NEXUS ERP <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 uppercase">Dev Console</span>
          </h1>
          <p className="text-xs text-slate-400">Portal de Engenharia e Controle Multi-Tenant Platform</p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800 text-xs font-bold text-slate-300">
            <ShieldCheck size={16} className="text-purple-400" />
            <span>Autenticação Restrita ao Perfil Desenvolvedor</span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email de Engenharia / Dev</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@oprestador.tech"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Senha Master de Acesso</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(37,99,235,0.25)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                "Acessando Console..."
              ) : (
                <>
                  Entrar no Console do Desenvolvedor <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-600">
          Domínio oficial: <strong className="font-mono text-slate-400">dev.oprestador.tech</strong>
        </p>
      </div>
    </div>
  );
}
