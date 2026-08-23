"use client";

import { useEffect, useState } from "react";
import { createErrorReport } from "@/app/actions/errorReportActions";

export default function GlobalError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  const [protocol,setProtocol]=useState("");
  useEffect(()=>{createErrorReport({description:"Falha não tratada capturada pela barreira global.",pageUrl:location.href,userAgent:navigator.userAgent,errorMessage:error.message,errorStack:error.stack,consoleLogs:[`digest=${error.digest||"n/a"}`]}).then(r=>{if(r.success&&r.id)setProtocol(r.id.slice(0,8));}).catch(()=>{});},[error]);
  return <html lang="pt-BR"><body className="m-0 flex min-h-screen items-center justify-center bg-[#0d0e11] p-6 font-sans text-white"><main className="w-full max-w-lg rounded-3xl border border-red-500/25 bg-[#15161a] p-8 text-center shadow-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-red-400">Falha protegida</p><h1 className="mt-4 text-2xl font-black">Algo não funcionou como esperado.</h1><p className="mt-3 text-sm leading-6 text-zinc-400">O erro técnico foi capturado automaticamente{protocol?` no protocolo ${protocol}`:""}. Você pode tentar novamente sem perder os dados já gravados.</p><button onClick={reset} className="mt-6 rounded-xl bg-[#155eef] px-5 py-3 text-sm font-black text-black">Tentar novamente</button></main></body></html>;
}
