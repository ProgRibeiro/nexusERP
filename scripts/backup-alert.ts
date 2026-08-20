import "dotenv/config";

function parseFlag(name: string) {
  const prefix = `${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (arg) return arg.slice(prefix.length);
  return process.env[name] || undefined;
}

function getValueOrDefault(name: string, fallback = "") {
  return parseFlag(name) || fallback;
}

function normalizeText(value: string | undefined, fallback: string) {
  return value && value.trim() ? value.trim() : fallback;
}

function buildSummary() {
  const status = normalizeText(parseFlag("status"), "warning");
  const title = normalizeText(parseFlag("title"), "Nexus ERP - alerta de backup");
  const summary = normalizeText(parseFlag("summary"), `Status do backup: ${status}`);
  return { status, title, summary };
}

async function sendGenericWebhook(url: string, title: string, summary: string, status: string) {
  const payload = {
    title,
    summary,
    status,
    sentAt: new Date().toISOString(),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook genérico falhou: ${response.status} ${response.statusText}`);
  }
}

async function sendDiscordWebhook(url: string, title: string, summary: string, status: string) {
  const payload = {
    embeds: [{
      title,
      description: summary,
      color: status === "critical" ? 15158332 : 15105570,
      timestamp: new Date().toISOString(),
    }],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook falhou: ${response.status} ${response.statusText}`);
  }
}

async function sendSlackWebhook(url: string, title: string, summary: string, status: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${title}\n${summary}`,
      attachments: [{
        color: status === "critical" ? "#d9232d" : "#f59e0b",
        text: summary,
        footer: "Nexus ERP",
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook falhou: ${response.status} ${response.statusText}`);
  }
}

async function sendTelegramMessage(token: string, chatId: string, title: string, summary: string, status: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `${title}\n\n${summary}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: status === "critical" ? "Ação urgente" : "Verificar", callback_data: "backup" }]] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram falhou: ${response.status} ${response.statusText}`);
  }
}

async function sendEmail(to: string, title: string, summary: string) {
  const mailCommand = process.env.ALERT_MAIL_COMMAND || "mail";
  const content = [
    `Subject: ${title}`,
    `To: ${to}`,
    `From: ${process.env.ALERT_EMAIL_FROM || "noreply@nexus-erp.local"}`,
    "",
    summary,
    "",
  ].join("\n");

  const { execFile } = await import("node:child_process");
  const util = await import("node:util");
  const execFileAsync = util.promisify(execFile);

  try {
    await execFileAsync(mailCommand, ["-s", title, to], { input: content, shell: false });
  } catch (error) {
    throw new Error(`E-mail falhou: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const { status, title, summary } = buildSummary();
  const alertTargets: string[] = [];

  const webhookUrl = getValueOrDefault("ALERT_WEBHOOK_URL");
  if (webhookUrl) {
    alertTargets.push(`webhook:${webhookUrl}`);
  }

  const whatsappWebhookUrl = getValueOrDefault("ALERT_WHATSAPP_WEBHOOK_URL");
  if (whatsappWebhookUrl) {
    alertTargets.push(`whatsapp:${whatsappWebhookUrl}`);
  }

  const discordUrl = getValueOrDefault("ALERT_DISCORD_WEBHOOK_URL");
  if (discordUrl) {
    alertTargets.push(`discord:${discordUrl}`);
  }

  const slackUrl = getValueOrDefault("ALERT_SLACK_WEBHOOK_URL");
  if (slackUrl) {
    alertTargets.push(`slack:${slackUrl}`);
  }

  const telegramBot = getValueOrDefault("ALERT_TELEGRAM_BOT_TOKEN");
  const telegramChat = getValueOrDefault("ALERT_TELEGRAM_CHAT_ID");
  if (telegramBot && telegramChat) {
    alertTargets.push(`telegram:${telegramBot}:${telegramChat}`);
  }

  const emailTo = getValueOrDefault("ALERT_EMAIL_TO");
  if (emailTo) {
    alertTargets.push(`email:${emailTo}`);
  }

  if (alertTargets.length === 0) {
    console.log(JSON.stringify({ success: true, sent: 0, status, title, summary, message: "Nenhuma integração de alerta configurada." }));
    return;
  }

  const results: string[] = [];
  for (const target of alertTargets) {
    const [kind, ...rest] = target.split(":");
    if (kind === "webhook") {
      await sendGenericWebhook(rest.join(":"), title, summary, status);
      results.push("webhook");
    }
    if (kind === "whatsapp") {
      await sendGenericWebhook(rest.join(":"), title, summary, status);
      results.push("whatsapp");
    }
    if (kind === "discord") {
      await sendDiscordWebhook(rest.join(":"), title, summary, status);
      results.push("discord");
    }
    if (kind === "slack") {
      await sendSlackWebhook(rest.join(":"), title, summary, status);
      results.push("slack");
    }
    if (kind === "telegram") {
      const [token, chatId] = rest;
      await sendTelegramMessage(token, chatId, title, summary, status);
      results.push("telegram");
    }
    if (kind === "email") {
      await sendEmail(rest.join(":"), title, summary);
      results.push("email");
    }
  }

  console.log(JSON.stringify({ success: true, sent: results.length, status, title, summary, channels: results }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message }));
  process.exit(1);
});
