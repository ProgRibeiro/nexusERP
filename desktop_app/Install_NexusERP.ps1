# ===============================================================================
# NEXUS ERP — INSTALADOR AUTOMÁTICO POWERSHELL (WINDOWS NATIVO)
# ===============================================================================
# Instala o software desktop pré-configurado com atalhos e suporte a protocolo.
# ===============================================================================

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🚀 NEXUS ERP ENTERPRISE DESKTOP — INSTALADOR POWERSHELL" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$InstallDir = "$env:LOCALAPPDATA\NexusERP"
$ConfigFile = "$env:USERPROFILE\.nexus_erp_vps_config.json"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "[1/4] Criando diretório em: $InstallDir" -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "[2/4] Copiando arquivos do aplicativo..." -ForegroundColor Yellow
Get-ChildItem -Path $ScriptDir -Include *.py, *.c, *.java, *.js -Recurse | Copy-Item -Destination $InstallDir -Force

Write-Host "[3/4] Gravando pré-configuração do Servidor VPS (https://erp.oprestador.tech)..." -ForegroundColor Yellow
$ConfigJson = @{
    vps_url = "https://erp.oprestador.tech"
    fullscreen = $false
    auto_start = $false
    tray_icon = $true
    installed_version = "2026.8.1"
    installed_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

Set-Content -Path $ConfigFile -Value $ConfigJson -Encoding UTF8

Write-Host "[4/4] Criando atalhos e registrando o protocolo nexus-erp://..." -ForegroundColor Yellow
$DesktopPath = [System.Environment]::GetFolderPath("Desktop")
$StartMenuPath = Join-Path ([System.Environment]::GetFolderPath("StartMenu")) "Programs\Nexus ERP"

if (-not (Test-Path $StartMenuPath)) {
    New-Item -ItemType Directory -Path $StartMenuPath -Force | Out-Null
}

$WshShell = New-Object -ComObject WScript.Shell

# Atalho Área de Trabalho
$ShortcutDesktop = $WshShell.CreateShortcut("$DesktopPath\Nexus ERP Enterprise.lnk")
$PythonExe = if (Get-Command "pythonw.exe" -ErrorAction SilentlyContinue) { "pythonw.exe" } else { "python.exe" }
$ShortcutDesktop.TargetPath = $PythonExe
$ShortcutDesktop.Arguments = "`"$InstallDir\nexus_erp_desktop.py`""
$ShortcutDesktop.WorkingDirectory = $InstallDir
$ShortcutDesktop.Description = "Nexus ERP — Software Desktop Nativo"
$ShortcutDesktop.Save()

# Atalho Menu Iniciar
$ShortcutStart = $WshShell.CreateShortcut("$StartMenuPath\Nexus ERP Enterprise.lnk")
$ShortcutStart.TargetPath = $PythonExe
$ShortcutStart.Arguments = "`"$InstallDir\nexus_erp_desktop.py`""
$ShortcutStart.WorkingDirectory = $InstallDir
$ShortcutStart.Description = "Nexus ERP — Software Desktop Nativo"
$ShortcutStart.Save()

# Registro de Protocolo nexus-erp://
New-Item -Path "HKCU:\Software\Classes\nexus-erp" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\nexus-erp" -Name "(default)" -Value "URL:Nexus ERP Protocol"
Set-ItemProperty -Path "HKCU:\Software\Classes\nexus-erp" -Name "URL Protocol" -Value ""
New-Item -Path "HKCU:\Software\Classes\nexus-erp\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\nexus-erp\shell\open\command" -Name "(default)" -Value "$PythonExe `"$InstallDir\nexus_erp_desktop.py`" `"%1`""

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "O Nexus ERP Desktop está instalado e pronto para uso." -ForegroundColor White
Write-Host ""

# Executa a aplicação em background
Start-Process -FilePath $PythonExe -ArgumentList "`"$InstallDir\nexus_erp_desktop.py`"" -ErrorAction SilentlyContinue
