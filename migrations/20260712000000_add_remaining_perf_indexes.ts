import { type Kysely, sql } from "kysely";

// Additional performance indexes for hot paths not covered by the initial set.
export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // Covers regular (non-daily) game guess lookups by game_id.
  // Used in on-message.tsx when checking existing guesses before processing a guess.
  await sql`CREATE INDEX IF NOT EXISTS guesses_game_id_idx
    ON guesses (game_id)`.execute(db);

  // Covers case-insensitive username search in callback-query.ts (score_list path).
  // Without this, Postgres does a seq scan on the users table.
  await sql`CREATE INDEX IF NOT EXISTS users_lower_username_idx
    ON users ((lower(username)))`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP INDEX IF EXISTS guesses_game_id_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS users_lower_username_idx`.execute(db);
}
