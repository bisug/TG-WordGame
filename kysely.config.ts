import { Pool } from "pg";
import { defineConfig } from "kysely-ctl";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  PostgresDialect,
} from "kysely";

import {
  getDbConnectionString,
  getDbSslConfig,
} from "./src/config/database-url";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: getDbConnectionString(),
    max: 10,
    ssl: getDbSslConfig(),
  }),
});

export default defineConfig({
  dialect,
  migrations: {
    migrationFolder: "migrations",
  },
  seeds: {
    seedFolder: "seeds",
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
