# Script PowerShell para Upload e Deploy do Nexus ERP a partir do Windows
# Altere $VPS_USER e $VPS_IP para os seus dados reais de acesso SSH.

$VPS_USER = "seu_usuario_ssh"
$VPS_IP   = "IP_DO_SEU_SERVIDOR"
$PUBLISH_PATH = ".\bin\Release\net10.0\publish\*"

Write-Host "[1/3] Criando diretório temporário de deploy na VPS..." -ForegroundColor Cyan
ssh "${VPS_USER}@${VPS_IP}" "mkdir -p /tmp/nexus-deploy"

Write-Host "[2/3] Enviando arquivos publicados via SCP..." -ForegroundColor Cyan
scp -r $PUBLISH_PATH "${VPS_USER}@${VPS_IP}:/tmp/nexus-deploy/"

Write-Host "[3/3] Executando script de deploy automatizado..." -ForegroundColor Cyan
ssh "${VPS_USER}@${VPS_IP}" "sudo deploy-nexus-erp"

Write-Host "[SUCESSO] Processo de deploy concluído!" -ForegroundColor Green
