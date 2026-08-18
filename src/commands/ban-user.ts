import { Composer } from "grammy";

import { sql } from "kysely";
import { db } from "../config/db";
import { env } from "../config/env";
import { rateLimit } from "../handlers/anticheat";
import { setCachedBanStatus } from "../util/cache";

const composer = new Composer();

composer.command("ban", rateLimit("ban"), async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const isUsername = ctx.match.startsWith("@");
  const identifier = isUsername ? ctx.match.substring(1) : ctx.match;

  // Telegram usernames are case-insensitive; match like the rest of the
  // codebase (lower(username)) instead of an exact match that misses
  // differently-cased usernames.
  const user = await db
    .selectFrom("users")
    .selectAll()
    .$if(isUsername, (q) =>
      q.where(sql`lower(username)`, "=", identifier.toLowerCase()),
    )
    .$if(!isUsername, (q) => q.where("id", "=", identifier))
    .executeTakeFirst();

  if (!user) return ctx.reply("Can't find the user");

  const existingBan = await db
    .selectFrom("bannedUsers")
    .selectAll()
    .where("userId", "=", user.id)
    .executeTakeFirst();

  if (existingBan) {
    return ctx.reply(`⚠️ ${user.name} is already banned`);
  }

  await db
    .insertInto("bannedUsers")
    .values({
      userId: user.id,
    })
    .execute();

  await setCachedBanStatus(user.id, true);

  ctx.reply(`Banned ${user.name} from the bot`);
});

export const banCommand = composer;
