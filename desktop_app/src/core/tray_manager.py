# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — SYSTEM TRAY MANAGER MODULE
===============================================================================
Gerenciador da Bandeja do Sistema (Windows Taskbar Notification Area).
"""

import sys
import pystray
from PIL import Image, ImageDraw

class SystemTrayManager:
    @staticmethod
    def create_tray_icon(window_ref, on_exit_callback=None):
        def create_icon_image():
            img = Image.new("RGBA", (64, 64), color=(15, 23, 42, 255))
            d = ImageDraw.Draw(img)
            d.rectangle([12, 12, 52, 52], fill=(56, 189, 248, 255))
            d.text((22, 22), "NX", fill=(15, 23, 42, 255))
            return img

        def on_open(icon, item):
            if window_ref:
                window_ref.show()
                window_ref.restore()

        def on_new_os(icon, item):
            if window_ref:
                window_ref.show()
                window_ref.load_url("https://erp.oprestador.tech/ordens-servico")

        def on_new_quote(icon, item):
            if window_ref:
                window_ref.show()
                window_ref.load_url("https://erp.oprestador.tech/orcamentos")

        def on_faturamento(icon, item):
            if window_ref:
                window_ref.show()
                window_ref.load_url("https://erp.oprestador.tech/faturamento")

        def on_quit(icon, item):
            icon.stop()
            if on_exit_callback:
                on_exit_callback()
            sys.exit(0)

        menu = pystray.Menu(
            pystray.MenuItem("Abrir Nexus ERP - O Prestador", on_open, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Nova Ordem de Servico (F2)", on_new_os),
            pystray.MenuItem("Novo Orcamento (F1)", on_new_quote),
            pystray.MenuItem("Faturamento e Baixa Rapida (F4)", on_faturamento),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair do Software", on_quit)
        )

        icon = pystray.Icon("NexusERP", create_icon_image(), "Nexus ERP - O Prestador", menu)
        return icon
