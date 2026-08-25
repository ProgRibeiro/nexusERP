@echo off
title Instalador Nexus ERP - O Prestador Desktop v2.0

echo.
echo ================================================================
echo   INSTALADOR AUTOMATICO NEXUS ERP - O PRESTADOR DESKTOP v2.0
echo ================================================================
echo.
echo Instalando e pre-configurando o software no seu computador...
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\NexusERP"
set "CONFIG_FILE=%USERPROFILE%\.nexus_erp_vps_config.json"
set "SCRIPT_DIR=%~dp0"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [1/4] Copiando arquivos do aplicativo...
copy /Y "%SCRIPT_DIR%nexus_erp_desktop.py" "%INSTALL_DIR%\nexus_erp_desktop.py" >nul 2>&1
if exist "%SCRIPT_DIR%nexus_desktop_launcher.c" copy /Y "%SCRIPT_DIR%nexus_desktop_launcher.c" "%INSTALL_DIR%\" >nul 2>&1
if exist "%SCRIPT_DIR%NexusERPLauncher.java" copy /Y "%SCRIPT_DIR%NexusERPLauncher.java" "%INSTALL_DIR%\" >nul 2>&1

echo [2/4] Pre-configurando servidor VPS (https://erp.oprestador.tech)...
echo { > "%CONFIG_FILE%"
echo   "vps_url": "https://erp.oprestador.tech", >> "%CONFIG_FILE%"
echo   "app_name": "Nexus ERP - O Prestador", >> "%CONFIG_FILE%"
echo   "fullscreen": false, >> "%CONFIG_FILE%"
echo   "auto_start": false, >> "%CONFIG_FILE%"
echo   "installed_version": "2026.8.2-v2" >> "%CONFIG_FILE%"
echo } >> "%CONFIG_FILE%"

echo [3/4] Criando atalhos na Area de Trabalho e Menu Iniciar...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$LocalApp = '$env:LOCALAPPDATA\NexusERP'; $Desktop = [System.Environment]::GetFolderPath('Desktop'); $StartMenu = [System.Environment]::GetFolderPath('StartMenu') + '\Programs\Nexus ERP - O Prestador'; if (-not (Test-Path $StartMenu)) { New-Item -ItemType Directory -Path $StartMenu | Out-Null }; $EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; if (-not (Test-Path $EdgePath)) { $EdgePath = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }; $WshShell = New-Object -ComObject WScript.Shell; $ShortcutDesktop = $WshShell.CreateShortcut(\"$Desktop\Nexus ERP - O Prestador.lnk\"); if (Test-Path $EdgePath) { $ShortcutDesktop.TargetPath = $EdgePath; $ShortcutDesktop.Arguments = '--app=https://erp.oprestador.tech --window-size=1366,850'; } else { $ShortcutDesktop.TargetPath = 'pythonw.exe'; $ShortcutDesktop.Arguments = \"`\"$LocalApp\nexus_erp_desktop.py`\"\"; }; $ShortcutDesktop.WorkingDirectory = $LocalApp; $ShortcutDesktop.Description = 'Nexus ERP - O Prestador'; $ShortcutDesktop.Save(); $ShortcutStart = $WshShell.CreateShortcut(\"$StartMenu\Nexus ERP - O Prestador.lnk\"); $ShortcutStart.TargetPath = $ShortcutDesktop.TargetPath; $ShortcutStart.Arguments = $ShortcutDesktop.Arguments; $ShortcutStart.WorkingDirectory = $LocalApp; $ShortcutStart.Description = 'Nexus ERP - O Prestador'; $ShortcutStart.Save();" >nul 2>&1

echo [4/4] Finalizando instalacao...
echo.
echo ================================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ================================================================
echo.
echo • Atalho criado na sua Area de Trabalho: "Nexus ERP - O Prestador"
echo • Servidor pre-configurado: https://erp.oprestador.tech
echo.
echo Iniciando a aplicacao desktop...
echo.

start "" "msedge.exe" --app=https://erp.oprestador.tech --window-size=1366,850 2>nul || start "" "https://erp.oprestador.tech"

timeout /t 3 >nul
exit /b 0
