"use client";

import { useEffect, useRef, useState } from "react";
import { Bug, Camera, Send, X } from "lucide-react";
import { createErrorReport } from "@/app/actions/errorReportActions";
import { useToast } from "@/components/ui/Toast";

export default function ErrorReporter() {
  const { toast } = useToast();
  const [open,setOpen] = useState(false); const [description,setDescription] = useState("");
  const [screenshot,setScreenshot] = useState(""); const [sending,setSending] = useState(false);
  const latestError = useRef<{message?:string;stack?:string}>({});
  const logs = useRef<string[]>([]);
  useEffect(()=>{
    const onError=(event:ErrorEvent)=>{ latestError.current={message:event.message,stack:event.error?.stack}; logs.current.push(`${new Date().toISOString()} ERROR ${event.message}`); };
    const onRejection=(event:PromiseRejectionEvent)=>{ const reason=event.reason; latestError.current={message:String(reason?.message||reason),stack:reason?.stack}; logs.current.push(`${new Date().toISOString()} REJECTION ${String(reason?.message||reason)}`); };
    window.addEventListener("error",onError); window.addEventListener("unhandledrejection",onRejection);
    return()=>{window.removeEventListener("error",onError);window.removeEventListener("unhandledrejection",onRejection);};
  },[]);
  async function captureScreen(){
    try {
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false}); const video=document.createElement("video"); video.srcObject=stream; await video.play();
      const canvas=document.createElement("canvas"); const max=1280; const scale=Math.min(1,max/video.videoWidth); canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
      canvas.getContext("2d")?.drawImage(video,0,0,canvas.width,canvas.height); stream.getTracks().forEach(t=>t.stop()); setScreenshot(canvas.toDataURL("image/jpeg",.65)); toast("Captura anexada ao relato.","success");
    } catch { toast("Captura cancelada. Você ainda pode enviar o relato sem imagem.","warning"); }
  }
  async function submit(){
    setSending(true); const result=await createErrorReport({description,pageUrl:location.href,userAgent:navigator.userAgent,errorMessage:latestError.current.message,errorStack:latestError.current.stack,consoleLogs:logs.current,screenshotData:screenshot}); setSending(false);
    if(result.success){toast(`Erro reportado. Protocolo ${result.id?.slice(0,8)}.`,"success");setDescription("");setScreenshot("");setOpen(false);} else toast(result.error||"Não foi possível enviar.","error");
  }
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-full border border-red-400/30 bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-white shadow-2xl hover:bg-red-500 xl:bottom-5 xl:left-auto xl:right-5 print:hidden" aria-label="Reportar erro"><Bug size={15}/> Reportar erro</button>
    {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm print:hidden"><section className="w-full max-w-lg rounded-3xl border border-red-400/20 bg-[#121318] p-5 text-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Reportar erro"><header className="flex items-start justify-between"><div><p className="text-sm font-black">Reportar um problema</p><p className="mt-1 text-[10px] text-zinc-400">A página, navegador e último erro técnico serão anexados automaticamente.</p></div><button onClick={()=>setOpen(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-white/10"><X size={16}/></button></header><textarea autoFocus value={description} onChange={e=>setDescription(e.target.value)} placeholder="Conte o que você tentou fazer e o que aconteceu..." className="mt-4 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-red-400/50"/><div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={captureScreen} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold hover:bg-white/5"><Camera size={14}/>{screenshot?"Captura anexada":"Capturar tela"}</button><button type="button" disabled={sending||description.trim().length<3} onClick={submit} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black disabled:opacity-40"><Send size={14}/>{sending?"Enviando...":"Enviar relato"}</button></div>{screenshot&&<img src={screenshot} alt="Captura que será anexada" className="mt-3 max-h-40 w-full rounded-xl object-contain"/>}</section></div>}
  </>;
}
