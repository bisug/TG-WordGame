import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  PostgresDialect,
} from "kysely";
import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";

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
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
