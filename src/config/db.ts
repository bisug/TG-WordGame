import pg from "pg";
import type { LogEvent } from "kysely";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";

import { env } from "./env";
import { logger } from "./logger";
import type { DB } from "../database-schemas";
import { getDbConnectionString, getDbSslConfig } from "./database-url";

const { Pool } = pg;

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: getDbConnectionString(),
    max: 10,
    ssl: getDbSslConfig(),
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
