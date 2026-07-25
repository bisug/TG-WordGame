import type { LogEvent } from "kysely";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";
import pg from "pg";
import type { DB } from "../database-schemas";
import { getDbConnectionString, getDbSslConfig } from "./database-url";
import { env } from "./env";
import { logger } from "./logger";

const { Pool } = pg;

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: getDbConnectionString(),
    // Sized to comfortably exceed steady-state in-flight connections from the
    // runner (run(bot, { concurrency: 15 })) plus headroom. Raise this together
    // with runner concurrency if benchmarking shows saturation — never one alone.
    max: 20,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: false,
    application_name: "tg-wordgame",
    ssl: getDbSslConfig(),
    // Kill runaway queries (e.g. a pre-index leaderboard aggregate) instead of
    // letting them pin a connection indefinitely.
    options: "-c statement_timeout=15000",
  }),
});

export const db = new Kysely<DB>({
  dialect,
  log: (event: LogEvent) => {
    if (env.NODE_ENV === "development") {
      if (event.level === "query") {
        logger.debug(
          { sql: event.query.sql, parameters: event.query.parameters },
          "Kysely Query",
        );
      } else {
        logger.error({ err: event.error }, "Kysely Error");
      }
    }
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
