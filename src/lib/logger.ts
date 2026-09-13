type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (typeof window === "undefined") {
      process.stdout.write(formatMessage("info", message, meta) + "\n");
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (typeof window === "undefined") {
      process.stdout.write(formatMessage("warn", message, meta) + "\n");
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (typeof window === "undefined") {
      process.stderr.write(formatMessage("error", message, meta) + "\n");
    }
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
      process.stdout.write(formatMessage("debug", message, meta) + "\n");
    }
  },
};
