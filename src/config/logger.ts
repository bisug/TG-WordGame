import pino from "pino";

import { env } from "./env";

// Pretty, human-readable output locally; structured JSON in production so log
// aggregators can index fields. errorProps "*" keeps full error causes/stacks
// visible in dev without affecting production output.
const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname,service",
          errorProps: "*",
        },
      }
    : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "wordseek-bot" },
  // Never let a token/password slip into logs, regardless of call site.
  redact: {
    paths: [
      "token",
      "password",
      "secret",
      "authorization",
      "cookie",
      "*.token",
      "*.password",
      "*.secret",
    ],
    censor: "[redacted]",
  },
  transport,
});
