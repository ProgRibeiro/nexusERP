# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — HARDWARE BARCODE SCANNER MODULE
===============================================================================
Módulo de escuta de leitores USB/COM de Código de Barras e QR Code.
Sincroniza a busca de produtos e materiais instantaneamente na tela do ERP.
"""

class BarcodeScannerEngine:
    def __init__(self, callback_on_scan=None):
        self.callback = callback_on_scan
        self.buffer = ""

    def process_keypress(self, char_key):
        if char_key == "\n" or char_key == "\r":
            scanned_code = self.buffer.strip()
            self.buffer = ""
            if scanned_code and self.callback:
                self.callback(scanned_code)
            return scanned_code
        else:
            self.buffer += char_key
            return None
