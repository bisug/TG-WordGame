import { sql } from "kysely";

import { db } from "../config/db";

// Resolve a Telegram user from an @username or numeric id. Usernames are
// case-insensitive (Telegram treats them that way), matching the rest of the
// codebase's lower(username) lookups.
export async function findUserByIdentifier(identifier: string) {
  const isUsername = identifier.startsWith("@");
  const value = isUsername ? identifier.slice(1) : identifier;

  return await db
    .selectFrom("users")
    .selectAll()
    .$if(isUsername, (q) =>
      q.where(sql`lower(username)`, "=", value.toLowerCase()),
    )
    .$if(!isUsername, (q) => q.where("id", "=", value))
    .executeTakeFirst();
}
