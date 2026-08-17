import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60_000;
const BLOCK_MS = 30 * 60_000;
const MAX_ATTEMPTS = 5;
const keyFor = (identity:string) => `login:${createHash("sha256").update(identity.trim().toLowerCase()).digest("hex")}`;

export async function assertLoginAllowed(identity:string) {
  const row=await prisma.securityThrottle.findUnique({where:{key:keyFor(identity)}});
  if(row?.blockedUntil && row.blockedUntil > new Date()) {
    const minutes=Math.max(1,Math.ceil((row.blockedUntil.getTime()-Date.now())/60_000));
    throw new Error(`Muitas tentativas. Aguarde ${minutes} minuto(s) para tentar novamente.`);
  }
}

export async function registerLoginFailure(identity:string) {
  const key=keyFor(identity); const now=new Date(); const row=await prisma.securityThrottle.findUnique({where:{key}});
  const expired=!row || now.getTime()-row.windowStart.getTime()>WINDOW_MS; const attempts=expired?1:row.attempts+1;
  await prisma.securityThrottle.upsert({where:{key},create:{key,attempts,windowStart:now,blockedUntil:attempts>=MAX_ATTEMPTS?new Date(now.getTime()+BLOCK_MS):null},update:{attempts,windowStart:expired?now:row!.windowStart,blockedUntil:attempts>=MAX_ATTEMPTS?new Date(now.getTime()+BLOCK_MS):null}});
}

export async function clearLoginFailures(identity:string) { await prisma.securityThrottle.deleteMany({where:{key:keyFor(identity)}}); }
