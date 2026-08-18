import { z } from "zod";

const optionalBoolean = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value.trim() === "") return undefined;

    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;

    ctx.addIssue({
      code: "custom",
      message: "Expected true or false",
    });
    return z.NEVER;
  });

const rawEnv = {
  ...process.env,
  REDIS_URI: process.env.REDIS_URI ?? process.env.REDIS_URL,
};

export const env = z
  .object({
    BOT_TOKEN: z.string().min(1, { message: "BOT_TOKEN is required" }),
    DATABASE_URL: z.string().min(1, { message: "DATABASE_URL is required" }),
    DATABASE_SSL: optionalBoolean,
    DATABASE_SSL_REJECT_UNAUTHORIZED: z
      .string()
      .optional()
      .default("false")
      .transform((val) => val.trim().toLowerCase() !== "false"),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    ADMIN_USERS: z
      .string()
      .default("")
      .transform((val) =>
        val
          .split(",")
          .map((s) => Number(s.trim()))
          // Telegram user ids are positive; this also drops the 0 that
          // Number("") produces for empty segments.
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    REDIS_URI: z.string().default("redis://127.0.0.1:6379"),
    CUSTOM_API_ROOT: z
      .url({ error: "CUSTOM_API_ROOT must be a valid URL" })
      .default("https://api.telegram.org"), // default to official API
    LOGS_CHANNEL: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined)),
    TIME_ZONE: z.string().optional().default("UTC"),
    DAILY_WORDLE_START_DATE: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD")
      .optional()
      .default("2025-01-01")
      .transform((val) => new Date(val)),
    // Per-instance salt mixed into the daily word selection hash. Without it,
    // anyone with the (public) word list can precompute every future daily
    // word. Set a unique random value per deployment; changing it reshuffles
    // the word rotation.
    DAILY_WORDLE_SECRET: z.string().optional().default(""),
    UPDATES_CHANNEL: z.url().default("https://t.me/WordSeek"),
    DISCUSSION_GROUP: z.url().default("https://t.me/WordGuesser"),
    // Contact link shown to banned users for appealing their ban. Must be a
    // full URL (Telegram URL buttons reject scheme-less links like t.me/x).
    BAN_APPEAL_URL: z.url().default("https://t.me/WordGuesser"),
    WEB_SERVICE: z
      .string()
      .optional()
      .default("false")
      .transform((val) => val.toLowerCase() === "true"),
  })
  .parse(rawEnv);
