#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_BIN="$(command -v npm)"
PATH_VALUE="$(dirname "$(command -v node)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
PLIST="$HOME/Library/LaunchAgents/com.nexus.erp.backup.plist"
LOG_DIR="$PROJECT_DIR/backups"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nexus.erp.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NPM_BIN</string><string>run</string><string>backup:hourly</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH_VALUE</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/auto-backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/auto-backup-error.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/com.nexus.erp.backup"
echo "Backup automático instalado: a cada 60 minutos."
