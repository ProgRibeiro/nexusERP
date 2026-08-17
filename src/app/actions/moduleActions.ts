"use server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth";
import { MODULE_CATALOG, ModuleId } from "@/lib/moduleCatalog";
import { revalidatePath } from "next/cache";

export async function getModuleFlags(): Promise<Record<string,boolean>> {
  await requireAuth(); const rows=await prisma.setting.findMany({where:{key:{startsWith:"feature.module."}}});
  const saved=new Map(rows.map(r=>[r.key,r.value])); return Object.fromEntries(MODULE_CATALOG.map(m=>[m.id,saved.get(`feature.module.${m.id}`)!=="false"]));
}
export async function setModuleFlag(id:ModuleId,enabled:boolean){
  const session=await requirePermission("admin.all"); if(!MODULE_CATALOG.some(m=>m.id===id)) return {success:false,error:"Módulo inválido."};
  await prisma.$transaction([prisma.setting.upsert({where:{key:`feature.module.${id}`},create:{key:`feature.module.${id}`,value:String(enabled)},update:{value:String(enabled)}}),prisma.auditLog.create({data:{userId:session.userId,action:"EDICAO",entity:"FeatureFlag",entityId:id,changesJson:JSON.stringify({enabled})}})]);
  revalidatePath("/"); return {success:true};
}
