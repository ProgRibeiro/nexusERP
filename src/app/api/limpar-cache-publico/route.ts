import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const target = new URL("/", request.url);
  target.searchParams.set("atualizado", Date.now().toString());
  const destination = JSON.stringify(target.toString());
  const html = `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atualizando site</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#071426;color:white;font-family:system-ui,sans-serif">
    <main style="text-align:center;padding:24px"><h1 style="font-size:22px">Atualizando o site…</h1><p style="color:#94a3b8">Removendo a versão antiga do navegador.</p></main>
    <script>
      (async () => {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        location.replace(${destination});
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Clear-Site-Data": '"cache", "storage"',
    },
  });
}
