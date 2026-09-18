import { Composer } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { rateLimit } from "../handlers/anticheat";
import { setCachedBanStatus } from "../util/cache";
import { findUserByIdentifier } from "../util/find-user";

const composer = new Composer();

composer.command("unban", rateLimit("ban"), async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const user = await findUserByIdentifier(ctx.match);

  if (!user) return ctx.reply("Can't find the user");

  const existingBan = await db
    .selectFrom("bannedUsers")
    .selectAll()
    .where("userId", "=", user.id)
    .executeTakeFirst();

  if (!existingBan) {
    return ctx.reply(`⚠️ ${user.name} is not banned`);
  }

  await db.deleteFrom("bannedUsers").where("userId", "=", user.id).execute();

  await setCachedBanStatus(user.id, false);

  ctx.reply(`Unbanned ${user.name} from the bot`);
});

export const unbanCommand = composer;
