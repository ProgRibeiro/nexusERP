#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE DEPLOY ATÔMICO E ROLLBACK AUTOMÁTICO PARA NEXUS ERP
# Instalar em: /usr/local/bin/deploy-nexus-erp (chmod +x)
# ==============================================================================

set -euo pipefail

APP_USER="nexuserp"
APP_DLL="NexusERP.dll"
DEPLOY_DIR="/tmp/nexus-deploy"
RELEASES_DIR="/var/www/nexus-erp/releases"
CURRENT_LINK="/var/www/nexus-erp/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

echo "[DEPLOY] Iniciando processo de publicação do Nexus ERP..."

# 1. Validar existência dos arquivos enviados
if [ ! -d "${DEPLOY_DIR}" ]; then
    echo "[ERRO] Diretório de deploy '${DEPLOY_DIR}' não foi encontrado!"
    exit 1
fi

if [ ! -f "${DEPLOY_DIR}/${APP_DLL}" ]; then
    echo "[ERRO] Arquivo principal '${APP_DLL}' não encontrado em '${DEPLOY_DIR}'!"
    echo "Verifique se a DLL no script coincide com o nome compilado no Visual Studio."
    exit 1
fi

# 2. Criar pasta da nova release
echo "[DEPLOY] Criando nova release: ${TIMESTAMP}..."
mkdir -p "${NEW_RELEASE_DIR}"

# 3. Copiar arquivos da pasta temporária para a nova release
cp -a ${DEPLOY_DIR}/. "${NEW_RELEASE_DIR}/"

# 4. Ajustar proprietário e permissões da nova release
chown -R ${APP_USER}:${APP_USER} "${NEW_RELEASE_DIR}"
chmod -R 755 "${NEW_RELEASE_DIR}"

# Guardar a release anterior (para rollback em caso de falha)
PREVIOUS_RELEASE=""
if [ -L "${CURRENT_LINK}" ]; then
    PREVIOUS_RELEASE=$(readlink -f "${CURRENT_LINK}")
fi

# 5. Trocar o symlink 'current' de forma atômica
echo "[DEPLOY] Atualizando o link de versão ativa ('current')..."
ln -sfn "${NEW_RELEASE_DIR}" "${CURRENT_LINK}"

# 6. Reiniciar o serviço do ERP
echo "[DEPLOY] Reiniciando serviço systemd 'nexus-erp'..."
systemctl restart nexus-erp

# 7. Verificar se o serviço iniciou com sucesso
echo "[DEPLOY] Verificando estabilidade do serviço..."
sleep 4

if systemctl is-active --quiet nexus-erp; then
    echo "[OK] Nexus ERP iniciado com sucesso na versão ${TIMESTAMP}!"
    
    # 8. Manter apenas as últimas 5 releases
    echo "[DEPLOY] Removendo releases antigas (mantendo as 5 mais recentes)..."
    ls -dt ${RELEASES_DIR}/* | tail -n +6 | xargs rm -rf 2>/dev/null || true
    
    # 9. Limpeza da pasta temporária
    rm -rf "${DEPLOY_DIR}"
    echo "[OK] Deploy concluído e pasta temporária removida!"
else
    echo "[ERRO CRÍTICO] O ERP falhou ao iniciar! Iniciando rollback imediato..."
    if [ -n "${PREVIOUS_RELEASE}" ] && [ -d "${PREVIOUS_RELEASE}" ]; then
        echo "[ROLLBACK] Retornando para release anterior: ${PREVIOUS_RELEASE}"
        ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT_LINK}"
        systemctl restart nexus-erp
        echo "[ROLLBACK] Rollback concluído. O sistema continua rodando na versão antiga."
    else
        echo "[ROLLBACK ERRO] Nenhuma release anterior válida para restaurar."
    fi
    exit 1
fi
