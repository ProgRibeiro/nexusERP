@echo off
:: ===============================================================================
:: NEXUS ERP — O PRESTADOR v2.0 — INSTALADOR AUTOMÁTICO PADRÃO 1-CLIQUE (WINDOWS)
:: ===============================================================================
:: Este script instala e pré-configura o Software Desktop Nativo do Nexus ERP — O Prestador
:: no computador do usuário, criando atalhos na Área de Trabalho e Menu Iniciar.
:: ===============================================================================

chcp 65001 >nul
title Instalador Nexus ERP — O Prestador Enterprise v2.0

echo.
echo  ================================================================
echo  🚀 INSTALADOR AUTOMÁTICO NEXUS ERP — O PRESTADOR DESKTOP v2.0
echo  ================================================================
echo.
echo  Instalando e pré-configurando o software no seu computador...
echo.

:: 1. Definir diretórios de instalação
set "INSTALL_DIR=%LOCALAPPDATA%\NexusERP"
set "CONFIG_FILE=%USERPROFILE%\.nexus_erp_vps_config.json"
set "SCRIPT_DIR=%~dp0"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 2. Copiar arquivos da aplicação
echo  [1/4] Copiando arquivos do aplicativo...
copy /Y "%SCRIPT_DIR%nexus_erp_desktop.py" "%INSTALL_DIR%\nexus_erp_desktop.py" >nul 2>&1
if exist "%SCRIPT_DIR%nexus_desktop_launcher.c" copy /Y "%SCRIPT_DIR%nexus_desktop_launcher.c" "%INSTALL_DIR%\" >nul 2>&1
if exist "%SCRIPT_DIR%NexusERPLauncher.java" copy /Y "%SCRIPT_DIR%NexusERPLauncher.java" "%INSTALL_DIR%\" >nul 2>&1

:: 3. Pré-configurar o arquivo de conexão com a VPS Cloud Hostinger
echo  [2/4] Pré-configurando servidor VPS O Prestador (https://erp.oprestador.tech)...
(
  echo {
  echo   "vps_url": "https://erp.oprestador.tech",
  echo   "app_name": "Nexus ERP — O Prestador",
  echo   "fullscreen": false,
  echo   "auto_start": false,
  echo   "installed_version": "2026.8.2-v2",
  echo   "installed_at": "%DATE% %TIME%"
  echo }
) > "%CONFIG_FILE%"

:: 4. Executar Script de PowerShell para criar Atalhos e Registro de Protocolo
echo  [3/4] Criando atalhos "Nexus ERP — O Prestador" na Área de Trabalho e Menu Iniciar...
powershell -NoProfile -ExecutionPolicy Bypass -Command "^
$LocalApp = '$env:LOCALAPPDATA\NexusERP'; ^
$Desktop = [System.Environment]::GetFolderPath('Desktop'); ^
$StartMenu = [System.Environment]::GetFolderPath('StartMenu') + '\Programs\Nexus ERP - O Prestador'; ^
if (-not (Test-Path $StartMenu)) { New-Item -ItemType Directory -Path $StartMenu | Out-Null }; ^
$EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; ^
if (-not (Test-Path $EdgePath)) { $EdgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }; ^
$WshShell = New-Object -ComObject WScript.Shell; ^
$ShortcutDesktop = $WshShell.CreateShortcut(\"$Desktop\Nexus ERP - O Prestador.lnk\"); ^
if (Test-Path $EdgePath) { ^
  $ShortcutDesktop.TargetPath = $EdgePath; ^
  $ShortcutDesktop.Arguments = '--app=https://erp.oprestador.tech --window-size=1366,850'; ^
} else { ^
  $ShortcutDesktop.TargetPath = 'pythonw.exe'; ^
  $ShortcutDesktop.Arguments = \"`\"$LocalApp\nexus_erp_desktop.py`\"\"; ^
}; ^
$ShortcutDesktop.WorkingDirectory = $LocalApp; ^
$ShortcutDesktop.Description = 'Nexus ERP — O Prestador | Gestão Nativa Enterprise'; ^
$ShortcutDesktop.Save(); ^
$ShortcutStart = $WshShell.CreateShortcut(\"$StartMenu\Nexus ERP - O Prestador.lnk\"); ^
$ShortcutStart.TargetPath = $ShortcutDesktop.TargetPath; ^
$ShortcutStart.Arguments = $ShortcutDesktop.Arguments; ^
$ShortcutStart.WorkingDirectory = $LocalApp; ^
$ShortcutStart.Description = 'Nexus ERP — O Prestador | Gestão Nativa Enterprise'; ^
$ShortcutStart.Save(); ^
New-Item -Path 'HKCU:\Software\Classes\nexus-erp' -Force | Out-Null; ^
Set-ItemProperty -Path 'HKCU:\Software\Classes\nexus-erp' -Name '(default)' -Value 'URL:Nexus ERP O Prestador Protocol' | Out-Null; ^
Set-ItemProperty -Path 'HKCU:\Software\Classes\nexus-erp' -Name 'URL Protocol' -Value '' | Out-Null; ^
New-Item -Path 'HKCU:\Software\Classes\nexus-erp\shell\open\command' -Force | Out-Null; ^
Set-ItemProperty -Path 'HKCU:\Software\Classes\nexus-erp\shell\open\command' -Name '(default)' -Value \"`\"$EdgePath`\" --app=https://erp.oprestador.tech\" | Out-Null; ^
" >nul 2>&1

:: 5. Conclusão e Inicialização
echo  [4/4] Finalizando instalação...
echo.
echo  ================================================================
echo  ✅ INSTALAÇÃO DO NEXUS ERP — O PRESTADOR CONCLUÍDA COM SUCESSO!
echo  ================================================================
echo.
echo  • Diretório de instalação: %INSTALL_DIR%
echo  • Atalho na sua Área de Trabalho: "Nexus ERP - O Prestador"
echo  • Servidor pré-configurado: https://erp.oprestador.tech
echo.
echo  Iniciando a aplicação desktop...
echo.

start "" "msedge.exe" --app=https://erp.oprestador.tech --window-size=1366,850 2>nul || start "" pythonw "%INSTALL_DIR%\nexus_erp_desktop.py" 2>nul || start "" "https://erp.oprestador.tech"

timeout /t 3 >nul
exit /b 0
