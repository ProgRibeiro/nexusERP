#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ok() { printf 'OK   %s\n' "$1"; }
fail() { printf 'ERRO %s\n' "$1" >&2; exit 1; }

for command_name in node npm npx git bash; do
  command -v "$command_name" >/dev/null 2>&1 || fail "comando ausente: $command_name"
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)' \
  || fail "Node.js 20.9 ou superior é necessário"
ok "Node.js $(node -p 'process.versions.node') compatível"

required_files=(
  package.json package-lock.json prisma/schema.prisma prisma.config.ts
  deploy/install-linux.sh deploy/update-linux.sh deploy/check-linux.sh
  deploy/nexus-erp@.service deploy/nginx-nexus-erp.conf
  deploy/nexus-erp-blue.env deploy/nexus-erp-green.env
)
for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || fail "arquivo obrigatório ausente: $file"
done
ok "artefatos de publicação presentes"

while IFS= read -r script; do
  bash -n "$script"
done < <(find deploy -maxdepth 1 -type f -name '*.sh' -print | sort)
ok "sintaxe dos scripts Linux válida"

grep -q '__NEXUS_DOMAIN__' deploy/nginx-nexus-erp.conf || fail "template Nginx sem placeholder de domínio"
grep -q '127.0.0.1:3001' deploy/install-linux.sh || fail "slot blue não configurado"
grep -q 'CANDIDATE_PORT=3001' deploy/update-linux.sh || fail "porta do slot blue não configurada"
grep -q 'CANDIDATE_PORT=3002' deploy/update-linux.sh || fail "porta do slot green não configurada"
ok "template Nginx e slots blue/green coerentes"

if git ls-files | grep -Eq '(^|/)(\.env|nexus-erp-initial-admin\.txt)$'; then
  fail "arquivo secreto rastreado pelo Git"
fi
ok "nenhum arquivo de segredo conhecido rastreado"

npm run security:audit
npm run test:action-errors
npm run test:tenant-foundation
npm run test:rls
npm run test:core-crud
npm run build
git diff --check

printf '\nPREPARO_VPS_OK — pacote Git → VPS validado.\n'
