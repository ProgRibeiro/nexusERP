#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP v2.0 — SOFTWARE DESKTOP NATIVO SUITE (HYBRID CHROMIUM & C ENGINE)
===============================================================================
Software de Desktop Nativo Enterprise para Windows, macOS e Linux.
Conecta-se automaticamente à nuvem da Hostinger (https://erp.oprestador.tech)
ou ao seu servidor local com interface Chromium App Mode e PyWebView.
===============================================================================
"""

import os
import sys
import json
import time
import subprocess
import shutil
import urllib.request

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

def launch_native_app():
    cfg = load_config()
    target_url = cfg.get("vps_url", DEFAULT_VPS_URL)

    # 1. Tenta abrir via PyWebView (Janela Nativa Desktop de Alta Performance)
    try:
        import webview
        window = webview.create_window(
            title="Nexus ERP Enterprise — Software Desktop Nativo",
            url=target_url,
            width=1366,
            height=850,
            resizable=True,
            confirm_close=False
        )
        webview.start(debug=False)
        return
    except Exception:
        pass

    # 2. Tenta abrir via Microsoft Edge Modo Aplicação Nativa (Windows 10/11)
    if sys.platform == "win32":
        edge_paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            shutil.which("msedge") or ""
        ]
        for ep in edge_paths:
            if ep and os.path.exists(ep):
                subprocess.Popen([
                    ep,
                    f"--app={target_url}",
                    "--window-size=1366,850",
                    "--name=NexusERPDesktop"
                ])
                return

    # 3. Tenta abrir via Google Chrome Modo Aplicação
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        shutil.which("chrome") or ""
    ]
    for cp in chrome_paths:
        if cp and os.path.exists(cp):
            subprocess.Popen([
                cp,
                f"--app={target_url}",
                "--window-size=1366,850"
            ])
            return

    # 4. Fallback: Abre no navegador padrão
    import webbrowser
    webbrowser.open(target_url)

if __name__ == "__main__":
    launch_native_app()
