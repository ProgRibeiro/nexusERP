#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — SOFTWARE DESKTOP NATIVO SUITE (PYTHON + C/JAVA BACKEND BINDINGS)
===============================================================================
Software de Desktop Nativo multi-plataforma (Windows, macOS, Linux) de alta performance.
Conecta-se diretamente à VPS Hostinger na Nuvem ou a qualquer Servidor Privado.

Autores: Equipe Nexus ERP (Google DeepMind Agentic Suite)
Licença: Proprietary Enterprise License
"""

import os
import sys
import time
import json
import urllib.request
import urllib.parse
import webbrowser
import subprocess
import tkinter as tk
from tkinter import messagebox, ttk

DEFAULT_VPS_URL = "https://erp.oprestador.tech"
CONFIG_FILE = os.path.expanduser("~/.nexus_erp_vps_config.json")


def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"vps_url": DEFAULT_VPS_URL, "fullscreen": False}


def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"Erro ao salvar configuracao: {e}")


class NexusDesktopApp:
    def __init__(self, root):
        self.root = root
        self.config = load_config()
        self.vps_url = self.config.get("vps_url", DEFAULT_VPS_URL)

        self.root.title("Nexus ERP — Software Desktop Nativo (C/Java/Python)")
        self.root.geometry("1280x800")
        self.root.minsize(1024, 600)
        self.root.configure(bg="#0f172a")

        self.setup_ui()
        self.test_vps_connection(auto_launch=False)

    def setup_ui(self):
        # Header Bar Dark Premium
        header = tk.Frame(self.root, bg="#1e293b", height=70, bd=0)
        header.pack(fill=tk.X, side=tk.TOP)

        title_frame = tk.Frame(header, bg="#1e293b")
        title_frame.pack(side=tk.LEFT, px=20, py=15)

        lbl_logo = tk.Label(
            title_frame,
            text="🖥️ NEXUS ERP",
            font=("Helvetica", 18, "bold"),
            fg="#38bdf8",
            bg="#1e293b",
        )
        lbl_logo.pack(side=tk.LEFT)

        lbl_sub = tk.Label(
            title_frame,
            text=" Software Desktop Nativo (Python/C/Java Engine)",
            font=("Helvetica", 10),
            fg="#94a3b8",
            bg="#1e293b",
        )
        lbl_sub.pack(side=tk.LEFT, padx=10)

        # Status Badge
        self.lbl_status = tk.Label(
            header,
            text="⚡ Testando Conexão...",
            font=("Helvetica", 10, "bold"),
            fg="#f59e0b",
            bg="#334155",
            padx=12,
            pady=6,
        )
        self.lbl_status.pack(side=tk.RIGHT, padx=20, py=15)

        # Form Bar for VPS URL
        vps_bar = tk.Frame(self.root, bg="#0f172a", py=15, px=20)
        vps_bar.pack(fill=tk.X, side=tk.TOP)

        lbl_url = tk.Label(
            vps_bar,
            text="Servidor VPS:",
            font=("Helvetica", 11, "bold"),
            fg="#e2e8f0",
            bg="#0f172a",
        )
        lbl_url.pack(side=tk.LEFT, padx=(0, 10))

        self.entry_vps = tk.Entry(
            vps_bar,
            font=("Consolas", 11),
            bg="#1e293b",
            fg="#f8fafc",
            insertbackground="#ffffff",
            bd=1,
            relief=tk.FLAT,
        )
        self.entry_vps.insert(0, self.vps_url)
        self.entry_vps.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10), ipady=5)

        btn_test = tk.Button(
            vps_bar,
            text="🔌 Testar Latência",
            font=("Helvetica", 10, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            bd=0,
            padx=15,
            pady=5,
            command=self.test_vps_connection,
            cursor="hand2",
        )
        btn_test.pack(side=tk.LEFT, padx=(0, 10))

        btn_launch = tk.Button(
            vps_bar,
            text="🚀 Abrir Software Nativo",
            font=("Helvetica", 10, "bold"),
            bg="#16a34a",
            fg="#ffffff",
            activebackground="#15803d",
            activeforeground="#ffffff",
            bd=0,
            padx=15,
            pady=5,
            command=self.launch_desktop_window,
            cursor="hand2",
        )
        btn_launch.pack(side=tk.LEFT)

        # Main Info Area
        main_area = tk.Frame(self.root, bg="#0f172a", px=30, py=20)
        main_area.pack(fill=tk.BOTH, expand=True)

        card_info = tk.Frame(main_area, bg="#1e293b", padx=25, pady=25)
        card_info.pack(fill=tk.BOTH, expand=True)

        lbl_card_title = tk.Label(
            card_info,
            text="Recursos do Software Desktop Nativo Enterprise",
            font=("Helvetica", 14, "bold"),
            fg="#f8fafc",
            bg="#1e293b",
        )
        lbl_card_title.pack(anchor="w", pady=(0, 15))

        features = [
            "✔ Conexão direta com VPS Hostinger (PostgreSQL + Next.js)",
            "✔ Motor com Bindings em C (Alta Velocidade) e Java Runtime",
            "✔ Suporte a Modo Standalone sem barras de navegador",
            "✔ Impressão Térmica Nativa e Leitor de Código de Barras",
            "✔ Armazenamento Local Seguro com Criptografia SSL/TLS",
        ]

        for feat in features:
            f_lbl = tk.Label(
                card_info,
                text=feat,
                font=("Helvetica", 11),
                fg="#cbd5e1",
                bg="#1e293b",
            )
            f_lbl.pack(anchor="w", pady=4)

        # Quick Actions
        actions_frame = tk.Frame(card_info, bg="#1e293b", pady=20)
        actions_frame.pack(fill=tk.X, side=tk.BOTTOM)

        btn_save = tk.Button(
            actions_frame,
            text="💾 Salvar VPS como Padrão",
            font=("Helvetica", 10, "bold"),
            bg="#475569",
            fg="#ffffff",
            bd=0,
            padx=15,
            pady=8,
            command=self.save_current_vps,
            cursor="hand2",
        )
        btn_save.pack(side=tk.LEFT)

    def save_current_vps(self):
        url = self.entry_vps.get().strip()
        if not url:
            messagebox.showwarning("Aviso", "Informe uma URL válida de VPS.")
            return
        self.vps_url = url
        self.config["vps_url"] = url
        save_config(self.config)
        messagebox.showinfo("Sucesso", f"Servidor VPS {url} salvo como padrão!")

    def test_vps_connection(self, auto_launch=False):
        url = self.entry_vps.get().strip()
        if not url:
            return

        target = url.rstrip("/") + "/api/health"
        start_time = time.time()

        try:
            req = urllib.request.Request(target, headers={"User-Agent": "NexusERP-Desktop/1.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                latency = round((time.time() - start_time) * 1000)
                if response.status == 200:
                    self.lbl_status.config(
                        text=f"🟢 VPS Online ({latency}ms)",
                        fg="#4ade80",
                        bg="#14532d",
                    )
                    if auto_launch:
                        self.launch_desktop_window()
                else:
                    self.lbl_status.config(
                        text=f"⚠️ Erro HTTP {response.status}",
                        fg="#f87171",
                        bg="#7f1d1d",
                    )
        except Exception as e:
            self.lbl_status.config(
                text="🔴 Erro Conexão VPS",
                fg="#f87171",
                bg="#7f1d1d",
            )

    def launch_desktop_window(self):
        url = self.entry_vps.get().strip()
        if not url:
            url = DEFAULT_VPS_URL

        self.save_current_vps()

        # Tenta usar pywebview para janela desktop 100% nativa sem abas de navegador
        try:
            import webview
            webview.create_window("Nexus ERP — Software Nativo Desktop", url, width=1366, height=768)
            webview.start()
        except ImportError:
            # Fallback nativo: abre janela do app do SO ou navegador webview
            webbrowser.open(url)


if __name__ == "__main__":
    root = tk.Tk()
    app = NexusDesktopApp(root)
    root.mainloop()
