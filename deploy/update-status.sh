#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
SOURCE="$ROOT/source"
STATUS_FILE="$ROOT/shared/update-status.json"
if [[ -r /etc/nexus-erp-update.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/nexus-erp-update.env
  set +a
fi
ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || echo desconhecido)"

case "$ACTIVE" in
  blue)
    ACTIVE_PORT=3001
    UPGRADE_SLOT=green
    UPGRADE_PORT=3002
    ;;
  green)
    ACTIVE_PORT=3002
    UPGRADE_SLOT=blue
    UPGRADE_PORT=3001
    ;;
  *)
    ACTIVE_PORT="-"
    UPGRADE_SLOT="-"
    UPGRADE_PORT="-"
    ;;
esac

ACTIVE_COMMIT="-"
if [[ "$ACTIVE" != "desconhecido" && -f "$ROOT/slots/$ACTIVE/.release-commit" ]]; then
  ACTIVE_COMMIT="$(cut -c1-12 "$ROOT/slots/$ACTIVE/.release-commit")"
fi

REMOTE_COMMIT="indisponível"
if [[ -d "$SOURCE/.git" ]]; then
  BRANCH="${DEPLOY_BRANCH:-main}"
  if [[ "${EUID:-$(id -u)}" -eq 0 ]] && id nexus >/dev/null 2>&1 && command -v runuser >/dev/null 2>&1; then
    REMOTE_COMMIT="$(runuser -u nexus -- /usr/bin/git -C "$SOURCE" rev-parse --short=12 "origin/$BRANCH" 2>/dev/null || echo indisponível)"
  else
    REMOTE_COMMIT="$(git -C "$SOURCE" rev-parse --short=12 "origin/$BRANCH" 2>/dev/null || echo indisponível)"
  fi
fi

printf 'Nexus ERP - estado de publicação\n'
printf '  Slot ativo:       %s\n' "$ACTIVE"
printf '  Porta ativa:      127.0.0.1:%s\n' "$ACTIVE_PORT"
printf '  Commit ativo:     %s\n' "$ACTIVE_COMMIT"
printf '  Slot de upgrade:  %s\n' "$UPGRADE_SLOT"
printf '  Porta de upgrade: 127.0.0.1:%s\n' "$UPGRADE_PORT"
printf '  Commit no Git:    %s\n' "$REMOTE_COMMIT"

if command -v systemctl >/dev/null 2>&1; then
  printf '  Atualização auto: %s\n' "$(systemctl is-enabled nexus-erp-update.timer 2>/dev/null || echo desabilitada)"
  printf '  Próxima busca:    %s\n' "$(systemctl list-timers nexus-erp-update.timer --no-legend 2>/dev/null | awk '{print $1, $2, $3, $4}' || true)"
fi

if [[ -r "$STATUS_FILE" ]]; then
  printf '\nÚltima execução:\n'
  if command -v node >/dev/null 2>&1; then
    node - "$STATUS_FILE" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
try {
  const status = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`  Estado:    ${status.state || "desconhecido"}`);
  console.log(`  Data:      ${status.updatedAt || "-"}`);
  console.log(`  Mensagem:  ${status.message || "-"}`);
  if (status.fromCommit || status.toCommit) {
    console.log(`  Versão:    ${(status.fromCommit || "-").slice(0, 12)} -> ${(status.toCommit || "-").slice(0, 12)}`);
  }
} catch {
  console.log("  Não foi possível interpretar o arquivo de estado.");
}
NODE
  else
    sed 's/^/  /' "$STATUS_FILE"
  fi
fi

printf '\nAs portas 3001 e 3002 são internas. Usuários acessam somente o Nginx em 80/443.\n'
