# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — O PRESTADOR v2.0 — MASTER DESKTOP ENGINE (ENTRYPOINT)
===============================================================================
Ponto de entrada principal da suíte Desktop Enterprise.
Integra os módulos de Hardware (impressão/leitor), Core (config/tray), Storage e UI.
"""

import sys
import threading
import webview

from src.core.config_manager import ConfigManager, DEFAULT_VPS_URL
from src.hardware.printer import ThermalPrinterSpooler
from src.hardware.scanner import BarcodeScannerEngine
from src.core.tray_manager import SystemTrayManager
from src.storage.offline_sync import OfflineSyncEngine

class NexusDesktopBridge:
    def __init__(self, window_ref=None):
        self.window = window_ref
        self.offline = OfflineSyncEngine()

    def print_direct(self, html_content):
        return ThermalPrinterSpooler.print_html_receipt(html_content)

    def print_text_receipt(self, text_content):
        return ThermalPrinterSpooler.print_raw_text(text_content)

    def get_app_info(self):
        cfg = ConfigManager.load()
        return {
            "app_name": "Nexus ERP - O Prestador Enterprise Desktop",
            "version": cfg.get("installed_version", "2026.8.2-v2"),
            "vps_url": cfg.get("vps_url", DEFAULT_VPS_URL),
        }

def main():
    cfg = ConfigManager.load()
    target_url = cfg.get("vps_url", DEFAULT_VPS_URL)

    print("=================================================================")
    print("INICIANDO NEXUS ERP - O PRESTADOR MASTER DESKTOP SUITE v2.0")
    print("=================================================================")
    print(f"Servidor Conectado: {target_url}")

    bridge = NexusDesktopBridge(None)

    window = webview.create_window(
        title="Nexus ERP - O Prestador Enterprise - Software Desktop Nativo",
        url=target_url,
        width=1400,
        height=900,
        min_size=(1024, 650),
        resizable=True,
        confirm_close=False,
        js_api=bridge
    )
    bridge.window = window

    # Inicia a bandeja do sistema
    try:
        tray_icon = SystemTrayManager.create_tray_icon(window)
        tray_thread = threading.Thread(target=tray_icon.run, daemon=True)
        tray_thread.start()
    except Exception as e:
        print(f"Bandeja do sistema nao inicializada: {e}")

    webview.start(debug=False, user_agent="NexusERPDesktop/2.0 (Windows NT 10.0; Win64; x64; OPrestadorMaster)")

if __name__ == "__main__":
    main()
