import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Create shared types and functions
  await sql`CREATE TYPE word_length AS ENUM ('4', '5', '6');`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END
    $$;
  `.execute(db);

  // 2. Core Tables
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("username", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("broadcast_chats")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text")
    .addColumn("username", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  // 3. Game Management Tables
  await db.schema
    .createTable("chat_game_topics")
    .addColumn("chat_id", "text", (col) => col.notNull())
    .addColumn("topic_id", "text", (col) => col.notNull())
    .addColumn("name", "text")
    .addColumn("icon_custom_emoji_id", "text")
    .addColumn("should_recreate_on_expire", "boolean", (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn("allowed_lengths", sql`integer[]`, (col) =>
      col.defaultTo(sql`ARRAY[5,4,6]`).notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("chat_game_topics_pkey", ["chat_id", "topic_id"])
    .execute();

  await db.schema
    .createTable("authorized_users")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedAlwaysAsIdentity(),
    )
    .addColumn("chat_id", "text", (col) =>
      col.notNull().references("broadcast_chats.id").onDelete("cascade"),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("authorized_by", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("unique_chat_user", ["chat_id", "user_id"])
    .execute();

  await db.schema
    .createTable("banned_users")
    .addColumn("user_id", "text", (col) =>
      col.notNull().primaryKey().references("users.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  // 4. Game Data Tables
  await db.schema
    .createTable("games")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("word", "varchar(6)", (col) => col.notNull())
    .addColumn("active_chat", "text", (col) => col.notNull())
    .addColumn("topic_id", "text", (col) => col.notNull().defaultTo("general"))
    .addColumn("started_by", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("games_active_chat_topic_id_unique", [
      "active_chat",
      "topic_id",
    ])
    .execute();

  await db.schema
    .createTable("guesses")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("guess", "varchar(6)", (col) => col.notNull())
    .addColumn("game_id", "integer", (col) =>
      col.notNull().references("games.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("leaderboard")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("user_id", "text", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("chat_id", "text", (col) => col.notNull())
    .addColumn("score", "integer", (col) => col.notNull())
    .addColumn("word_length", sql`word_length`, (col) =>
      col.notNull().defaultTo(sql`'5'::word_length`),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  // 5. Daily Wordle Tables
  await db.schema
    .createTable("user_stats")
    .addColumn("user_id", "text", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade"),
    )
    .addColumn("highest_streak", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("current_streak", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("last_guessed", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("daily_words")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("day_number", "integer", (col) =>
      col.notNull().unique().generatedByDefaultAsIdentity(),
    )
    .addColumn("word", "varchar(6)", (col) => col.notNull())
    .addColumn("date", "date", (col) => col.notNull().unique())
    .addColumn("meaning", "text")
    .addColumn("phonetic", "text")
    .addColumn("sentence", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`ALTER TABLE daily_words ADD CONSTRAINT daily_words_word_length_check CHECK (char_length(word) = 5);`.execute(
    db,
  );

  await db.schema
    .createTable("daily_guesses")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("daily_word_id", "integer", (col) =>
      col.notNull().references("daily_words.id").onDelete("cascade"),
    )
    .addColumn("guess", "varchar(6)", (col) => col.notNull())
    .addColumn("attempt_number", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("daily_guesses_user_word_attempt_unique", [
      "user_id",
      "daily_word_id",
      "attempt_number",
    ])
    .execute();

  // 6. Indexes
  await db.schema
    .createIndex("leaderboard_chat_word_len_idx")
    .on("leaderboard")
    .columns(["chat_id", "word_length", "created_at"])
    .execute();
  await db.schema
    .createIndex("leaderboard_user_word_len_idx")
    .on("leaderboard")
    .columns(["user_id", "word_length"])
    .execute();
  await db.schema
    .createIndex("guesses_game_id_idx")
    .on("guesses")
    .column("game_id")
    .execute();
  await db.schema
    .createIndex("daily_guesses_user_daily_word_idx")
    .on("daily_guesses")
    .columns(["user_id", "daily_word_id"])
    .execute();

  // 7. Triggers
  const tables = [
    "users",
    "broadcast_chats",
    "chat_game_topics",
    "banned_users",
    "games",
    "guesses",
    "leaderboard",
    "user_stats",
    "daily_words",
    "daily_guesses",
  ];
  for (const table of tables) {
    await sql`
      CREATE TRIGGER update_${sql.raw(table)}_updated_at
      BEFORE UPDATE ON ${sql.table(table)}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `.execute(db);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = [
    "daily_guesses",
    "daily_words",
    "user_stats",
    "leaderboard",
    "guesses",
    "games",
    "banned_users",
    "authorized_users",
    "chat_game_topics",
    "broadcast_chats",
    "users",
  ];
  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;`.execute(
    db,
  );
  await sql`DROP TYPE IF EXISTS word_length;`.execute(db);
}
