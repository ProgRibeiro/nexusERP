import { execFileSync } from "node:child_process";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const run = (bin, args) => execFileSync(bin, args, { stdio: "inherit", env: process.env });
console.log("[security] Validando schema e tipos...");
run("npx", ["prisma", "validate"]);
run("npx", ["tsc", "--noEmit"]);

function getAllFiles(dir, fileList = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        getAllFiles(filePath, fileList);
      }
    } else if (/\.(?:ts|tsx|js|mjs|cjs|sh|conf)$/.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

console.log("[security] Procurando segredos incorporados no código...");
const targetDirs = ["src", "scripts", "prisma", "deploy"];
const files = targetDirs.flatMap((dir) => getAllFiles(dir));
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i,
  /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/i,
];
const allowed = [
  "SENHA_FORTE",
  "SEGREDO_ALEATORIO",
  "GOOGLE_GMAIL_CLIENT_SECRET",
  "process.env",
  "password: migratedHash",
  "${DB_PASSWORD}",
];
const hits = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((p) => p.test(line)) && !allowed.some((a) => line.includes(a))) {
      hits.push(`${file}:${index + 1}`);
    }
  });
}
if (hits.length) {
  console.error("Possíveis segredos encontrados:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("[security] Verificando dependências de produção...");
try{run("npm",["audit","--omit=dev","--audit-level=high"]);}catch{console.error("Auditoria de dependências reprovada.");process.exit(1);}
console.log("[security] APROVADO");
