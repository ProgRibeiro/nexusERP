/*
 * ===============================================================================
 * NEXUS ERP — ENTERPRISE JAVA DESKTOP LAUNCHER
 * ===============================================================================
 * Lançador de alta performance para ambientes corporativos executando Java (JVM).
 */

import java.awt.Desktop;
import java.net.URI;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;

public class NexusERPLauncher {
    private static final String DEFAULT_VPS_URL = "https://erp.oprestador.tech";

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            String vpsUrl = JOptionPane.showInputDialog(
                null,
                "Informe o endereço do Servidor VPS do Nexus ERP:",
                "Nexus ERP — Lançador Java Desktop Enterprise",
                JOptionPane.QUESTION_MESSAGE,
                null,
                null,
                DEFAULT_VPS_URL
            ) + "";

            if (vpsUrl == null || vpsUrl.trim().isEmpty() || vpsUrl.equals("null")) {
                vpsUrl = DEFAULT_VPS_URL;
            }

            try {
                if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                    Desktop.getDesktop().browse(new URI(vpsUrl));
                } else {
                    Runtime.getRuntime().exec("python3 desktop_app/nexus_erp_desktop.py");
                }
            } catch (Exception e) {
                JOptionPane.showMessageDialog(null, "Erro ao iniciar o Software Desktop: " + e.getMessage());
            }
        });
    }
}
