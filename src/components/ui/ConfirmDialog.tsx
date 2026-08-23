"use client";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", destructive = false, loading = false, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel?: string; destructive?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal isOpen={open} onClose={onClose} title={title}><div className="p-5"><div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${destructive ? "bg-red-50 text-[#f04438]" : "bg-blue-50 text-[#155eef]"}`}><AlertTriangle size={18}/></span><p className="pt-1 text-sm leading-6 text-[#667085]">{description}</p></div><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></div></div></Modal>;
}
