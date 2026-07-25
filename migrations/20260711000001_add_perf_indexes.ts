import { type Kysely, sql } from "kysely";

// Production performance indexes. These back the hot leaderboard/score paths
// and the daily streak-reset scan. Run via `bun run db:migrate`.
export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // Global leaderboard aggregate + /score lookups: filter by word_length, range
  // on created_at, and the INCLUDE lets Postgres satisfy sum(score)/user_id from
  // the index without heap fetches.
  await sql`CREATE INDEX IF NOT EXISTS leaderboard_word_len_created_idx
    ON leaderboard (word_length, created_at) INCLUDE (user_id, score)`.execute(
    db,
  );

  // Same, scoped to a group (the common group leaderboard / score paths).
  await sql`CREATE INDEX IF NOT EXISTS leaderboard_chat_word_created_idx
    ON leaderboard (chat_id, word_length, created_at) INCLUDE (user_id, score)`.execute(
    db,
  );

  // Prunes the daily streak-reset full scan (resetStreaksForInactivePlayers in
  // daily-wordle-cron.ts).
  await sql`CREATE INDEX IF NOT EXISTS user_stats_streak_last_guessed_idx
    ON user_stats (current_streak, last_guessed)`.execute(db);

  // Daily guess lookups by word (unique-constraint path + listing).
  await sql`CREATE INDEX IF NOT EXISTS daily_guesses_daily_word_id_idx
    ON daily_guesses (daily_word_id)`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP INDEX IF EXISTS leaderboard_word_len_created_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS leaderboard_chat_word_created_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS user_stats_streak_last_guessed_idx`.execute(
    db,
  );
  await sql`DROP INDEX IF EXISTS daily_guesses_daily_word_id_idx`.execute(db);
}
