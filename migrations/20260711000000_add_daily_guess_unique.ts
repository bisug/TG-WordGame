import { type Kysely, sql } from "kysely";

// Make the daily-wordle duplicate-guess guard atomic. The app already rejects
// duplicate guesses, so this only ever trips on a genuine race (two identical
// rapid guesses), turning a possible double-insert into a clean unique violation
// that the handler already catches and reports as "already guessed".
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE daily_guesses
    ADD CONSTRAINT daily_guesses_user_word_guess_unique
    UNIQUE (user_id, daily_word_id, guess);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE daily_guesses
    DROP CONSTRAINT IF EXISTS daily_guesses_user_word_guess_unique;
  `.execute(db);
}
