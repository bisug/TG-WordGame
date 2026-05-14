import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";
import type { LogEvent } from "kysely";
import pg from "pg";

import type { DB } from "../database-schemas";
import { env } from "./env";
import { logger } from "./logger";

const { Pool } = pg;

// Strip sslmode from the URL
// so our explicit ssl config is the only one pg sees.
function getDbConnectionString() {
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: getDbConnectionString(),
    max: 10,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  }),
});

export const db = new Kysely<DB>({
  dialect,
  log: (event: LogEvent) => {
    if (env.NODE_ENV === "development") {
      if (event.level === "query") {
        logger.debug({ sql: event.query.sql, parameters: event.query.parameters }, "Kysely Query");
      } else {
        logger.error({ err: event.error }, "Kysely Error");
      }
    }
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
