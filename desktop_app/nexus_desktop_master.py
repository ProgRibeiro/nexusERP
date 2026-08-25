#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — O PRESTADOR v2.0 — MASTER DESKTOP ENGINE (STANDALONE WINDOWS .EXE)
===============================================================================
Software Desktop Nativo de Alta Performance para Windows (WebView2 / Chromium Engine).
Conecta-se ao mesmo banco de dados PostgreSQL na VPS Cloud (https://erp.oprestador.tech)
ou ao servidor local, com suporte a impressão térmica direta, atalhos de teclado F1-F12,
leitor de código de barras e bandeja do sistema (System Tray).
===============================================================================
"""

import os
import sys
import json
import time
import threading
import subprocess
import shutil
import urllib.request
import webview

DEFAULT_VPS_URL = "https://erp.oprestador.tech"
CONFIG_FILE = os.path.expanduser("~/.nexus_erp_vps_config.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "vps_url": DEFAULT_VPS_URL,
        "app_name": "Nexus ERP - O Prestador",
        "fullscreen": False,
        "auto_start": False,
        "installed_version": "2026.8.2-v2",
    }

def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass

class NexusDesktopAPI:
    def __init__(self, window_ref):
        self.window = window_ref

    def get_system_info(self):
        import socket
        hostname = socket.gethostname()
        return {
            "app": "Nexus ERP - O Prestador Desktop Engine v2.0",
            "hostname": hostname,
            "os": sys.platform,
            "vps_url": load_config().get("vps_url", DEFAULT_VPS_URL),
        }

    def print_direct(self, content_html):
        """Dispara impressão nativa sem precisar da caixa de diálogo do navegador"""
        try:
            temp_file = os.path.join(os.environ.get("TEMP", "."), "nexus_print_temp.html")
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(content_html)
            if sys.platform == "win32":
                os.startfile(temp_file, "print")
                return {"success": True, "message": "Enviado para a impressora padrao com sucesso!"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def switch_server(self, new_url):
        cfg = load_config()
        cfg["vps_url"] = new_url
        save_config(cfg)
        if self.window:
            self.window.load_url(new_url)
        return {"success": True, "vps_url": new_url}

    def notify_user(self, title, message):
        try:
            if self.window:
                self.window.evaluate_js(f"console.log('[DESKTOP NOTIFY] {title}: {message}');")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

def run_system_tray(window):
    try:
        import pystray
        from PIL import Image, ImageDraw

        def create_icon_image():
            img = Image.new("RGBA", (64, 64), color=(15, 23, 42, 255))
            d = ImageDraw.Draw(img)
            d.rectangle([12, 12, 52, 52], fill=(56, 189, 248, 255))
            d.text((22, 22), "NX", fill=(15, 23, 42, 255))
            return img

        def on_open(icon, item):
            if window:
                window.show()
                window.restore()

        def on_new_os(icon, item):
            if window:
                window.show()
                window.load_url(load_config().get("vps_url", DEFAULT_VPS_URL) + "/ordens-servico")

        def on_new_quote(icon, item):
            if window:
                window.show()
                window.load_url(load_config().get("vps_url", DEFAULT_VPS_URL) + "/orcamentos")

        def on_faturamento(icon, item):
            if window:
                window.show()
                window.load_url(load_config().get("vps_url", DEFAULT_VPS_URL) + "/faturamento")

        def on_exit(icon, item):
            icon.stop()
            if window:
                window.destroy()
            sys.exit(0)

        menu = pystray.Menu(
            pystray.MenuItem("Abrir Nexus ERP - O Prestador", on_open, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Nova Ordem de Servico (F2)", on_new_os),
            pystray.MenuItem("Novo Orcamento (F1)", on_new_quote),
            pystray.MenuItem("Faturamento e Baixa Rapida (F4)", on_faturamento),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair do Software", on_exit)
        )

        icon = pystray.Icon("NexusERP", create_icon_image(), "Nexus ERP - O Prestador", menu)
        icon.run()
    except Exception as err:
        print(f"System tray error: {err}")

def main():
    cfg = load_config()
    target_url = cfg.get("vps_url", DEFAULT_VPS_URL)

    print("=================================================================")
    print("INICIANDO NEXUS ERP - O PRESTADOR MASTER DESKTOP ENGINE v2.0")
    print("=================================================================")
    print(f"Servidor Conectado: {target_url}")
    print("Carregando motor nativo Chromium / MSWebView2...")

    api = NexusDesktopAPI(None)
    window = webview.create_window(
        title="Nexus ERP - O Prestador Enterprise - Software Desktop Nativo",
        url=target_url,
        width=1400,
        height=900,
        min_size=(1024, 650),
        resizable=True,
        confirm_close=False,
        js_api=api
    )
    api.window = window

    tray_thread = threading.Thread(target=run_system_tray, args=(window,), daemon=True)
    tray_thread.start()

    webview.start(debug=False, user_agent="NexusERPDesktop/2.0 (Windows NT 10.0; Win64; x64; OPrestadorMaster)")

if __name__ == "__main__":
    main()
