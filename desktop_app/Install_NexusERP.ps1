# ===============================================================================
# NEXUS ERP — O PRESTADOR v2.0 — INSTALADOR AUTOMÁTICO POWERSHELL DESKTOP
# ===============================================================================

$ErrorActionPreference = "Stop"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " 🚀 INSTALADOR AUTOMÁTICO NEXUS ERP — O PRESTADOR DESKTOP v2.0" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$LocalApp = "$env:LOCALAPPDATA\NexusERP"
$ConfigFile = "$env:USERPROFILE\.nexus_erp_vps_config.json"
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$StartMenu = [System.Environment]::GetFolderPath('StartMenu') + '\Programs\Nexus ERP - O Prestador'

if (-not (Test-Path $LocalApp)) {
    New-Item -ItemType Directory -Path $LocalApp | Out-Null
}
if (-not (Test-Path $StartMenu)) {
    New-Item -ItemType Directory -Path $StartMenu | Out-Null
}

# 1. Escrever configuração pronta do servidor VPS O Prestador
$ConfigJson = @{
    vps_url = "https://erp.oprestador.tech"
    app_name = "Nexus ERP — O Prestador"
    fullscreen = $false
    auto_start = $false
    installed_version = "2026.8.2-v2"
    installed_at = (Get-Date).ToString("o")
} | ConvertTo-Json

Set-Content -Path $ConfigFile -Value $ConfigJson -Encoding UTF8

# 2. Localizar executável do Chromium/Edge para janela de aplicação dedicada
$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) {
    $EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

# 3. Criar Atalho na Área de Trabalho
$WshShell = New-Object -ComObject WScript.Shell
$ShortcutDesktop = $WshShell.CreateShortcut("$Desktop\Nexus ERP - O Prestador.lnk")

if (Test-Path $EdgePath) {
    $ShortcutDesktop.TargetPath = $EdgePath
    $ShortcutDesktop.Arguments = "--app=https://erp.oprestador.tech --window-size=1366,850"
} else {
    $ShortcutDesktop.TargetPath = "powershell.exe"
    $ShortcutDesktop.Arguments = "-NoProfile -Command Start-Process 'https://erp.oprestador.tech'"
}

$ShortcutDesktop.WorkingDirectory = $LocalApp
$ShortcutDesktop.Description = "Nexus ERP — O Prestador | Gestão Nativa Enterprise"
$ShortcutDesktop.Save()

# 4. Criar Atalho no Menu Iniciar
$ShortcutStart = $WshShell.CreateShortcut("$StartMenu\Nexus ERP - O Prestador.lnk")
$ShortcutStart.TargetPath = $ShortcutDesktop.TargetPath
$ShortcutStart.Arguments = $ShortcutDesktop.Arguments
$ShortcutStart.WorkingDirectory = $LocalApp
$ShortcutStart.Description = "Nexus ERP — O Prestador | Gestão Nativa Enterprise"
$ShortcutStart.Save()

Write-Host "✅ Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host "• Atalho criado na sua Área de Trabalho: Nexus ERP - O Prestador" -ForegroundColor Yellow
Write-Host "• Servidor pré-configurado: https://erp.oprestador.tech" -ForegroundColor Yellow
Write-Host ""
Write-Host "Iniciando a aplicação desktop..." -ForegroundColor Cyan

if (Test-Path $EdgePath) {
    Start-Process $EdgePath -ArgumentList "--app=https://erp.oprestador.tech --window-size=1366,850"
} else {
    Start-Process "https://erp.oprestador.tech"
}
