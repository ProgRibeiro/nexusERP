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
  [[ -n "${MIGRATION_DATABASE_URL:-}" ]] && ok "MIGRATION_DATABASE_URL separada" || fail "MIGRATION_DATABASE_URL não configurada"
  [[ -n "${BACKUP_DATABASE_URL:-}" ]] && ok "BACKUP_DATABASE_URL separada" || fail "BACKUP_DATABASE_URL não configurada"
  [[ "${TENANT_ID:-}" =~ ^[0-9a-fA-F-]{36}$ ]] && ok "TENANT_ID configurado" || fail "TENANT_ID ausente ou inválido"
  SESSION_SECRET_VALUE="${SESSION_SECRET:-}"
  SESSION_SECRET_LENGTH="${#SESSION_SECRET_VALUE}"
  (( SESSION_SECRET_LENGTH >= 32 )) && ok "SESSION_SECRET possui tamanho seguro" || fail "SESSION_SECRET deve ter ao menos 32 caracteres"
else
  fail "ambiente ausente ou ilegível: $ENV_FILE"
fi

if [[ -n "${MIGRATION_DATABASE_URL:-}" && "$MIGRATION_DATABASE_URL" != "$DATABASE_URL" ]]; then
  MIGRATION_FLAGS="$(psql "$MIGRATION_DATABASE_URL" -Atc "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname=current_user" 2>/dev/null || true)"
  [[ "$MIGRATION_FLAGS" == "false:false" ]] && ok "usuário de migrations não é superuser/BYPASSRLS" || fail "conta de migrations possui privilégios excessivos"
else
  fail "runtime e migrations não podem usar a mesma conexão"
fi

if [[ -n "${BACKUP_DATABASE_URL:-}" && "$BACKUP_DATABASE_URL" != "$DATABASE_URL" ]]; then
  BACKUP_FLAGS="$(psql "$BACKUP_DATABASE_URL" -Atc "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname=current_user" 2>/dev/null || true)"
  [[ "$BACKUP_FLAGS" == "false:true" ]] && ok "usuário de backup separado com BYPASSRLS" || fail "conta de backup não está corretamente isolada"
else
  fail "runtime e backup não podem usar a mesma conexão"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_ROLE_FLAGS="$(psql "$DATABASE_URL" -Atc "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname=current_user" 2>/dev/null || true)"
  [[ "$DB_ROLE_FLAGS" == "false:false" ]] && ok "usuário do banco respeita RLS" || fail "usuário do banco não pode ser superuser nem BYPASSRLS"
fi

PG_LISTEN="$(runuser -u postgres -- psql -Atc 'SHOW listen_addresses' 2>/dev/null || true)"
if [[ "$PG_LISTEN" == "localhost" || "$PG_LISTEN" == "127.0.0.1" || "$PG_LISTEN" == "::1" ]]; then
  ok "PostgreSQL escuta somente no host local ($PG_LISTEN)"
else
  fail "PostgreSQL não pode escutar publicamente (listen_addresses=$PG_LISTEN)"
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

# Valida os hostnames e trajetos antes do apontamento do DNS externo.
MARKETING_HOST="${NEXUS_MARKETING_HOSTS%%,*}"
APP_HOST="${NEXUS_APP_HOST:-app.oprestador.tech}"
COMMERCIAL_HOST="${NEXUS_COMMERCIAL_HOST:-vendas.oprestador.tech}"
DEV_HOST="${NEXUS_DEVELOPER_HOST:-${NEXUS_DEV_HOST:-dev.oprestador.tech}}"
for route in / /recursos /solucoes /planos /historia /demonstracao /contato /login; do
  ROUTE_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 -H "Host: $MARKETING_HOST" "http://127.0.0.1$route" || true)"
  [[ "$ROUTE_STATUS" =~ ^(200|30[1278])$ ]] && ok "trajeto comercial $route responde ($ROUTE_STATUS)" || fail "trajeto comercial $route falhou ($ROUTE_STATUS)"
done
for portal_host in "$APP_HOST" "$COMMERCIAL_HOST" "$DEV_HOST"; do
  LOGIN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 -H "Host: $portal_host" http://127.0.0.1/login || true)"
  ROOT_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 -H "Host: $portal_host" http://127.0.0.1/ || true)"
  [[ "$LOGIN_STATUS" == "200" ]] && ok "login de $portal_host responde" || fail "login de $portal_host falhou ($LOGIN_STATUS)"
  [[ "$ROOT_STATUS" =~ ^30[1278]$ ]] && ok "área protegida de $portal_host exige sessão" || fail "área protegida de $portal_host não redirecionou ($ROOT_STATUS)"
done

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
if [[ -n "${RESTORE_TEST_DATABASE_URL:-}" ]]; then
  systemctl is-enabled --quiet nexus-erp-restore-test.timer 2>/dev/null && \
    ok "timer restore-test habilitado com banco isolado" || fail "RESTORE_TEST_DATABASE_URL existe, mas o timer restore-test não está habilitado"
else
  if systemctl is-enabled --quiet nexus-erp-restore-test.timer 2>/dev/null; then
    fail "timer restore-test não pode estar habilitado sem RESTORE_TEST_DATABASE_URL"
  else
    ok "restore-test desabilitado até configurar banco isolado"
  fi
fi

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
