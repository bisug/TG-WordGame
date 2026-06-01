import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE guesses ADD COLUMN IF NOT EXISTS chat_id text;`.execute(
    db,
  );

  await sql`
    UPDATE guesses
    SET chat_id = games.active_chat
    FROM games
    WHERE guesses.game_id = games.id
      AND guesses.chat_id IS NULL;
  `.execute(db);

  await sql`ALTER TABLE guesses ALTER COLUMN chat_id SET NOT NULL;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE guesses DROP COLUMN IF EXISTS chat_id;`.execute(db);
}
