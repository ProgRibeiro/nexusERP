import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";

// Em produção o atualizador Linux informa o ID da release. Em compilações
// locais geramos um ID novo, impedindo que uma aba antiga envie Server Actions
// para um servidor recompilado com outros identificadores.
const deploymentId = process.env.NEXT_DEPLOYMENT_ID
  || `local-${Date.now()}-${randomUUID().slice(0, 8)}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

console.log(`Compilando publicação ${deploymentId}...`);

const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_DEPLOYMENT_ID: deploymentId },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Não foi possível iniciar a compilação:", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Compilação interrompida pelo sinal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
