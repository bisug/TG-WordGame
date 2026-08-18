import { type Kysely, sql } from "kysely";

// Same race guard as daily_guesses (20260711000000): private chats are not
// sequentialized, so two identical rapid guesses can both pass the in-memory
// duplicate check and double-insert. The app already rejects duplicate
// guesses, so this only trips on a genuine race, turning a double insert into
// a clean unique violation that the handler catches and reports as
// "already guessed".
export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // A race could have already produced duplicate rows; keep the earliest of
  // each (game_id, guess) pair so the constraint can be applied cleanly.
  await sql`
    DELETE FROM guesses a
    USING guesses b
    WHERE a.game_id = b.game_id
      AND a.guess = b.guess
      AND a.id > b.id
  `.execute(db);

  await sql`
    ALTER TABLE guesses
    ADD CONSTRAINT guesses_game_id_guess_unique
    UNIQUE (game_id, guess)
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    ALTER TABLE guesses
    DROP CONSTRAINT IF EXISTS guesses_game_id_guess_unique
  `.execute(db);
}
