import type { Context } from "grammy";
import type { BotError } from "grammy";
import pino from "pino";
import type { Logger } from "pino";

import { logger as rootLogger } from "./logger";

/**
 * Extracts the most useful context fields from a Grammy context, for logging.
 * Returns undefined for fields that are not present.
 */
export function getUpdateContext(ctx: Context): {
  update_id: number;
  user_id?: number;
  chat_id?: number;
  message_id?: number;
  thread_id?: number;
} {
  return {
    update_id: ctx.update.update_id,
    user_id: ctx.from?.id,
    chat_id: ctx.chat?.id,
    message_id: ctx.msg?.message_id,
    thread_id: ctx.msg?.message_thread_id,
  };
}

/**
 * Creates a child logger pre-bound with update context, so every log line
 * automatically includes update_id, user_id, and chat_id without repeating them.
 *
 * Usage:
 *   const log = createUpdateLogger(ctx);
 *   log.info("Processing update");   // already has update_id, user_id, chat_id
 *   log.error({ err }, "Something went wrong");
 */
export function createUpdateLogger(ctx: Context): Logger {
  const base = getUpdateContext(ctx);
  return rootLogger.child(base);
}

/**
 * Logs an error from the global error handler with consistent formatting.
 * Includes the full update context and the error type name.
 */
export function logBotError(error: BotError<Context>): Logger {
  const ctx = error.ctx;
  const e = error.error;
  const base = getUpdateContext(ctx);

  const log = rootLogger.child(base);

  // Attach error type for easy filtering in log aggregation tools
  log.error(
    { err: e, errorType: e?.constructor?.name ?? "unknown" },
    "Unhandled bot error",
  );

  return log;
}

/**
 * Standardised error log for command/handler failures.
 * Always includes the error object under the `err` key.
 */
export function logError(
  ctx: Context | null,
  err: unknown,
  message: string,
): void {
  const base = ctx ? getUpdateContext(ctx) : {};
  rootLogger.child(base).error({ err }, message);
}

/**
 * Standardised debug log for entry points of handlers/commands.
 */
export function logDebug(
  ctx: Context,
  message: string,
  extra?: Record<string, unknown>,
): void {
  createUpdateLogger(ctx).debug(extra ?? {}, message);
}

/**
 * Standardised info log for notable events.
 */
export function logInfo(
  ctx: Context,
  message: string,
  extra?: Record<string, unknown>,
): void {
  createUpdateLogger(ctx).info(extra ?? {}, message);
}

/**
 * Standardised warn log for recoverable issues.
 */
export function logWarn(
  ctx: Context,
  message: string,
  extra?: Record<string, unknown>,
): void {
  createUpdateLogger(ctx).warn(extra ?? {}, message);
}