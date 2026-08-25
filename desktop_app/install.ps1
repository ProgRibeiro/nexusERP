$LocalApp = Join-Path $env:LOCALAPPDATA "NexusERP"
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$StartMenu = Join-Path ([System.Environment]::GetFolderPath('StartMenu')) "Programs\Nexus ERP - O Prestador"

if (-not (Test-Path $LocalApp)) { New-Item -ItemType Directory -Path $LocalApp -Force | Out-Null }
if (-not (Test-Path $StartMenu)) { New-Item -ItemType Directory -Path $StartMenu -Force | Out-Null }

$ConfigFile = Join-Path $env:USERPROFILE ".nexus_erp_vps_config.json"
$ConfigJson = @'
{
  "vps_url": "https://erp.oprestador.tech",
  "app_name": "Nexus ERP - O Prestador",
  "installed_version": "2026.8.2-v2"
}
'@
Set-Content -Path $ConfigFile -Value $ConfigJson -Encoding UTF8

$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) { $EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$WshShell = New-Object -ComObject WScript.Shell
$ShortcutDesktop = $WshShell.CreateShortcut((Join-Path $Desktop "Nexus ERP - O Prestador.lnk"))
if (Test-Path $EdgePath) {
    $ShortcutDesktop.TargetPath = $EdgePath
    $ShortcutDesktop.Arguments = "--app=https://erp.oprestador.tech --window-size=1366,850"
} else {
    $ShortcutDesktop.TargetPath = "https://erp.oprestador.tech"
}
$ShortcutDesktop.WorkingDirectory = $LocalApp
$ShortcutDesktop.Description = "Nexus ERP - O Prestador"
$ShortcutDesktop.Save()

$ShortcutStart = $WshShell.CreateShortcut((Join-Path $StartMenu "Nexus ERP - O Prestador.lnk"))
$ShortcutStart.TargetPath = $ShortcutDesktop.TargetPath
$ShortcutStart.Arguments = $ShortcutDesktop.Arguments
$ShortcutStart.WorkingDirectory = $LocalApp
$ShortcutStart.Description = "Nexus ERP - O Prestador"
$ShortcutStart.Save()

Write-Host "ATALHO CRIADO COM SUCESSO EM: $Desktop\Nexus ERP - O Prestador.lnk"
