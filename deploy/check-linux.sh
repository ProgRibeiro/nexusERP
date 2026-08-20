#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
ENV_FILE="${NEXUS_ENV_FILE:-/etc/nexus-erp.env}"
ERRORS=0

ok() { printf 'OK   %s\n' "$1"; }
fail() { printf 'ERRO %s\n' "$1" >&2; ERRORS=$((ERRORS + 1)); }

for command_name in node npm npx nginx curl psql pg_dump systemctl flock; do
  if command -v "$command_name" >/dev/null 2>&1; then
    ok "comando $command_name disponível"
  else
    fail "comando $command_name ausente"
  fi
done

NODE_VERSION="$(node -p 'process.versions.node' 2>/dev/null || echo ausente)"
if node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)' 2>/dev/null; then
  ok "Node.js $NODE_VERSION compatível"
else
  fail "Node.js 20.9 ou superior é necessário (atual: $NODE_VERSION)"
fi

if [[ -r "$ENV_FILE" ]]; then
  ok "ambiente persistente disponível"
  ENV_MODE="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo 999)"
  if [[ "$ENV_MODE" =~ ^[0-9]+$ ]] && (( 10#$ENV_MODE <= 640 )); then
    ok "permissões do ambiente restritas ($ENV_MODE)"
  else
    fail "proteja $ENV_FILE com chmod 640 (atual: $ENV_MODE)"
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  [[ -n "${DATABASE_URL:-}" ]] && ok "DATABASE_URL configurada" || fail "DATABASE_URL não configurada"
  [[ "${TENANT_ID:-}" =~ ^[0-9a-fA-F-]{36}$ ]] && ok "TENANT_ID configurado" || fail "TENANT_ID ausente ou inválido"
  SESSION_SECRET_VALUE="${SESSION_SECRET:-}"
  SESSION_SECRET_LENGTH="${#SESSION_SECRET_VALUE}"
  (( SESSION_SECRET_LENGTH >= 32 )) && ok "SESSION_SECRET possui tamanho seguro" || fail "SESSION_SECRET deve ter ao menos 32 caracteres"
else
  fail "ambiente ausente ou ilegível: $ENV_FILE"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_ROLE_FLAGS="$(psql "$DATABASE_URL" -Atc "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname=current_user" 2>/dev/null || true)"
  [[ "$DB_ROLE_FLAGS" == "false:false" ]] && ok "usuário do banco respeita RLS" || fail "usuário do banco não pode ser superuser nem BYPASSRLS"
fi

ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || true)"
if [[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]]; then
  ok "slot ativo: $ACTIVE"
else
  fail "slot ativo inválido ou ausente"
fi

if [[ -n "$ACTIVE" && -L "$ROOT/slots/$ACTIVE" && -f "$ROOT/slots/$ACTIVE/.release-commit" ]]; then
  ok "release ativa íntegra ($(cut -c1-12 "$ROOT/slots/$ACTIVE/.release-commit"))"
else
  fail "release ativa ou marcador de commit ausente"
fi

if [[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]]; then
  systemctl is-active --quiet "nexus-erp@$ACTIVE.service" && ok "serviço do ERP ativo" || fail "serviço nexus-erp@$ACTIVE inativo"
  [[ "$ACTIVE" == "blue" ]] && ACTIVE_PORT=3001 || ACTIVE_PORT=3002
  DIRECT_HEALTH="$(curl -fsS --max-time 5 "http://127.0.0.1:$ACTIVE_PORT/api/health" 2>/dev/null || true)"
  grep -q '"status":"ok"' <<<"$DIRECT_HEALTH" && ok "slot ativo responde somente na porta interna $ACTIVE_PORT" || fail "porta interna $ACTIVE_PORT não respondeu"
fi

nginx -t >/dev/null 2>&1 && ok "configuração do Nginx válida" || fail "configuração do Nginx inválida"

HEALTH="$(curl -fsS --max-time 5 http://127.0.0.1/api/health 2>/dev/null || true)"
if grep -q '"status":"ok"' <<<"$HEALTH" && grep -q '"database":"ok"' <<<"$HEALTH"; then
  ok "aplicação e PostgreSQL respondendo"
else
  fail "health check da aplicação falhou"
fi

if [[ -n "$HEALTH" ]]; then
  BACKUP_HEALTH="$(HEALTH_JSON="$HEALTH" node <<'NODE'
const raw = process.env.HEALTH_JSON || "";
try {
  const payload = JSON.parse(raw);
  process.stdout.write(String(payload.backup?.status || "unknown"));
} catch {
  process.stdout.write("invalid");
}
NODE
)"
  case "$BACKUP_HEALTH" in
    ok)
      ok "saúde de backup dentro do SLA"
      ;;
    warning)
      ok "backup com alerta não crítico (verifique cópia externa)"
      ;;
    critical)
      fail "backup em estado crítico (ausente, antigo ou inválido)"
      ;;
    *)
      fail "não foi possível interpretar a saúde de backup no /api/health"
      ;;
  esac
fi

for timer in hourly daily weekly audit alert; do
  systemctl is-enabled --quiet "nexus-erp-backup-$timer.timer" 2>/dev/null && \
    ok "timer de backup $timer habilitado" || fail "timer de backup $timer não habilitado"
done
systemctl is-enabled --quiet nexus-erp-restore-test.timer 2>/dev/null && \
  ok "timer de backup restore-test habilitado" || fail "timer de backup restore-test não habilitado"

if systemctl is-enabled --quiet nexus-erp-update.timer 2>/dev/null; then
  ok "busca automática de atualizações habilitada"
else
  ok "atualização automática desabilitada (modo manual)"
fi

[[ -f /etc/nexus-erp-update.env ]] && ok "branch de atualização configurado" || fail "/etc/nexus-erp-update.env ausente"

for directory in "$ROOT/shared/uploads" "$ROOT/shared/backups"; do
  if runuser -u nexus -- test -w "$directory" 2>/dev/null; then
    ok "diretório persistente gravável: $directory"
  else
    fail "usuário nexus não pode gravar em $directory"
  fi
done

if runuser -u nexus -- test -w /var/cache/nexus-erp/static 2>/dev/null && runuser -u www-data -- test -r /var/cache/nexus-erp/static 2>/dev/null; then
  ok "arquivos estáticos compartilhados entre releases"
else
  fail "permissões inválidas em /var/cache/nexus-erp/static"
fi

if (( ERRORS > 0 )); then
  printf '\nVerificação terminou com %d erro(s).\n' "$ERRORS" >&2
  exit 1
fi

printf '\nServidor pronto: todos os testes passaram.\n'
