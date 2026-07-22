/**
 * Logger estruturado mínimo (sem dependência externa) — substitui
 * `console.log`/`console.error` soltos por linhas JSON com nível, timestamp
 * e contexto, prontas para serem coletadas por qualquer agregador de logs
 * (journald, Loki, CloudWatch etc. — todos leem stdout como texto/JSON).
 *
 * Não é um substituto completo de uma lib como pino/winston (sem
 * transports, sem redaction automática de PII, sem sampling), mas resolve o
 * problema imediato de não ter NENHUMA estrutura nos logs hoje. Trocar por
 * pino é uma melhoria futura de baixo risco (mesma interface `.info/.warn/.error`).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown> | unknown;

function normalizeContext(context: LogContext) {
  if (context instanceof Error) {
    return { error: { name: context.name, message: context.message, stack: context.stack } };
  }
  if (context && typeof context === "object") return context;
  return context === undefined ? undefined : { detail: context };
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context !== undefined ? { context: normalizeContext(context) } : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
