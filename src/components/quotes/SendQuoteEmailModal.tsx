"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  History,
  Link2,
  Loader2,
  LockKeyhole,
  Mail,
  Send,
  Settings2,
  ShieldCheck,
  Unplug,
  XCircle,
} from "lucide-react";
import {
  disconnectGmail,
  getGmailProposalContext,
  sendQuoteByGmail,
} from "@/app/actions/gmailActions";
import type { QuotePdfCompanyProfile } from "@/lib/quotePdf";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface Delivery {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  ccEmails: string | null;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: Date | string | null;
  createdAt: Date | string;
  sentByName: string;
}

interface GmailContext {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  integration: {
    id: string;
    email: string;
    displayName: string | null;
    active: boolean;
    lastError: string | null;
    updatedAt: Date | string;
  } | null;
  canManageConnection: boolean;
  defaults: { recipient: string; cc: string; subject: string; body: string };
  deliveries: Delivery[];
}

interface SendQuoteEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string | null;
  quoteCode?: string;
  company: QuotePdfCompanyProfile;
  onSent?: () => void | Promise<void>;
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function DeliveryStatus({ status }: { status: string }) {
  if (status === "ENVIADO") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700"><CheckCircle2 size={12} /> Enviado</span>;
  }
  if (status === "FALHA") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700"><XCircle size={12} /> Falha</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700"><Clock3 size={12} /> Processando</span>;
}

export function SendQuoteEmailModal({ isOpen, onClose, quoteId, quoteCode, company, onSent }: SendQuoteEmailModalProps) {
  const { toast } = useToast();
  const [context, setContext] = useState<GmailContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const loadContext = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    const result = await getGmailProposalContext(quoteId);
    if (!result.success) {
      toast(result.error, "error");
      setContext(null);
      setLoading(false);
      return;
    }
    setContext(result);
    setRecipient(result.defaults.recipient);
    setCc(result.defaults.cc);
    setSubject(result.defaults.subject);
    setBody(result.defaults.body);
    setLoading(false);
  }, [quoteId, toast]);

  useEffect(() => {
    if (!isOpen || !quoteId) return;
    const timer = window.setTimeout(() => void loadContext(), 0);
    // Uma nova abertura sempre busca destinatário e histórico atualizados.
    return () => window.clearTimeout(timer);
  }, [isOpen, quoteId, loadContext]);

  const handleConnect = () => {
    window.location.assign(`/api/integrations/gmail/connect?returnTo=${encodeURIComponent("/orcamentos")}`);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quoteId) return;
    setSending(true);
    const result = await sendQuoteByGmail({ quoteId, recipient, cc, subject, body, company });
    setSending(false);
    if (!result.success) {
      toast(result.error, "error");
      await loadContext();
      return;
    }
    toast(`Proposta ${quoteCode || ""} enviada pelo Gmail com o PDF anexado.`, "success");
    await loadContext();
    await onSent?.();
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Desconectar a conta Gmail usada pelo ERP? O histórico de envios será mantido.")) return;
    setDisconnecting(true);
    const result = await disconnectGmail();
    setDisconnecting(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Conta Gmail desconectada. O histórico foi preservado.", "success");
    await loadContext();
  };

  return (
    <Modal isOpen={isOpen} onClose={sending ? () => undefined : onClose} title="Enviar proposta por Gmail" size="xl">
      {loading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="animate-spin text-blue-600" size={28} />
          <p className="text-sm font-semibold">Preparando o envio seguro...</p>
        </div>
      ) : !context ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          Não foi possível carregar a integração. Feche a janela e tente novamente.
        </div>
      ) : !context.configured ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 dark:border-amber-900 dark:from-amber-950/30 dark:to-zinc-900">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><Settings2 size={20} /></span>
              <div>
                <h3 className="font-black text-zinc-950 dark:text-white">Falta registrar o ERP no Google</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">O módulo já está instalado. Para o Google liberar o botão de conexão, informe o Client ID e o Client Secret OAuth no servidor.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Variáveis do servidor</p>
              <code className="mt-2 block break-all rounded-lg bg-zinc-950 p-3 text-xs leading-6 text-emerald-300">GOOGLE_GMAIL_CLIENT_ID<br />GOOGLE_GMAIL_CLIENT_SECRET</code>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">URI de redirecionamento autorizada</p>
              <code className="mt-2 block break-all rounded-lg bg-zinc-950 p-3 text-xs leading-6 text-sky-300">{context.redirectUri}</code>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-xs leading-relaxed text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" /> A senha do Gmail nunca é informada ao ERP. A autorização é feita na página oficial do Google e pode ser revogada.
          </div>
          <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
        </div>
      ) : !context.connected ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 dark:border-blue-900 dark:from-blue-950/30 dark:via-zinc-900 dark:to-indigo-950/20">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><Mail size={25} /></span>
              <h3 className="mt-4 text-lg font-black text-zinc-950 dark:text-white">Conecte o Gmail comercial uma única vez</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Depois disso, o ERP gera a proposta em uma folha A4, anexa o PDF e registra cada envio no histórico.</p>
              <Button className="mt-5" size="lg" onClick={handleConnect}><Link2 size={17} /> Conectar conta Google</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><LockKeyhole size={17} className="text-blue-600" /><p className="mt-2 text-xs font-bold">OAuth seguro</p><p className="mt-1 text-[11px] text-zinc-500">Sem armazenar senha.</p></div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><FileCheck2 size={17} className="text-blue-600" /><p className="mt-2 text-xs font-bold">PDF anexado</p><p className="mt-1 text-[11px] text-zinc-500">Modelo executivo A4.</p></div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><History size={17} className="text-blue-600" /><p className="mt-2 text-xs font-bold">Rastreabilidade</p><p className="mt-1 text-[11px] text-zinc-500">Conta, horário e destino.</p></div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><CheckCircle2 size={19} /></span>
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Gmail conectado</p><p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{context.integration?.displayName || context.integration?.email}</p><p className="truncate text-xs text-zinc-500">{context.integration?.email}</p></div>
            </div>
            {context.canManageConnection && <Button type="button" size="sm" variant="ghost" loading={disconnecting} onClick={handleDisconnect}><Unplug size={14} /> Desconectar</Button>}
          </div>

          {context.integration?.lastError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>Último aviso da conexão: {context.integration.lastError}</span></div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="E-mail do cliente *" type="email" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="cliente@empresa.com.br" />
            <Input label="Cópia (CC)" value={cc} onChange={(event) => setCc(event.target.value)} placeholder="financeiro@empresa.com.br; outro@email.com" />
          </div>
          <Input label="Assunto *" required maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proposal-email-body" className="text-xs font-medium text-zinc-500">Mensagem *</label>
            <textarea id="proposal-email-body" required maxLength={10000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-relaxed text-zinc-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-950 dark:bg-blue-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><FileCheck2 className="text-blue-600" size={20} /><div><p className="text-xs font-black text-zinc-900 dark:text-white">Proposta-{quoteCode || "orcamento"}.pdf</p><p className="text-[11px] text-zinc-500">PDF executivo gerado pelo servidor em uma única folha A4.</p></div></div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 shadow-sm dark:bg-zinc-900">Anexo automático</span>
          </div>

          {context.deliveries.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"><History size={15} className="text-zinc-500" /><h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Histórico desta proposta</h4></div>
              <div className="max-h-44 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                {context.deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{delivery.recipientEmail}</p><p className="mt-0.5 text-[10px] text-zinc-500">{formatDateTime(delivery.sentAt || delivery.createdAt)} · {delivery.sentByName} · {delivery.senderEmail}</p>{delivery.errorMessage && <p className="mt-1 text-[10px] text-rose-600">{delivery.errorMessage}</p>}</div>
                    <DeliveryStatus status={delivery.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={sending} onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="lg" loading={sending}><Send size={16} /> Enviar proposta e PDF</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
