// DB/Redis-backed tests. Skipped unless INTEGRATION_DB=1 — CI runs them
// against real postgres + valkey services after `bun run db:migrate`.
// Modules are imported lazily in beforeAll so a local `bun test` run (no env)
// never instantiates the db/redis clients.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";

import type { DB } from "../database-schemas";
import type {
  deleteCachedGame as delGameFn,
  getCachedBanStatus as getBanFn,
  getCachedGame as getGameFn,
  setCachedBanStatus as setBanFn,
  setCachedGame as setGameFn,
} from "./cache";
import type { findUserByIdentifier as findUserFn } from "./find-user";

const RUN = !!process.env.INTEGRATION_DB;
const USER_ID = "987654321";
const CHAT_ID = "987654321";
const TOPIC = "general";
// Exercises the redis/DB miss path for an id that is never seeded.
const MISS_ID = "111222333";

describe.skipIf(!RUN)("integration: db + redis", () => {
  let db!: Kysely<DB>;
  let redis!: import("ioredis").default;
  let findUserByIdentifier!: typeof findUserFn;
  let getCachedBanStatus!: typeof getBanFn;
  let setCachedBanStatus!: typeof setBanFn;
  let getCachedGame!: typeof getGameFn;
  let setCachedGame!: typeof setGameFn;
  let deleteCachedGame!: typeof delGameFn;

  beforeAll(async () => {
    ({ db } = await import("../config/db"));
    ({ redis } = await import("../config/redis"));
    ({ findUserByIdentifier } = await import("./find-user"));
    ({
      deleteCachedGame,
      getCachedBanStatus,
      getCachedGame,
      setCachedBanStatus,
      setCachedGame,
    } = await import("./cache"));

    // Deterministic baseline for the fixtures used below.
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
    await db.deleteFrom("bannedUsers").where("userId", "=", USER_ID).execute();
    await db
      .deleteFrom("games")
      .where("activeChat", "=", CHAT_ID)
      .where("topicId", "=", TOPIC)
      .execute();
    await redis.del(`ban:${USER_ID}`);
    await redis.del(`ban:${MISS_ID}`);
    await deleteCachedGame(CHAT_ID, TOPIC);
  });

  afterAll(async () => {
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
    await db.deleteFrom("bannedUsers").where("userId", "=", USER_ID).execute();
    await db
      .deleteFrom("games")
      .where("activeChat", "=", CHAT_ID)
      .where("topicId", "=", TOPIC)
      .execute();
    await redis.del(`ban:${USER_ID}`);
    await redis.del(`ban:${MISS_ID}`);
    await deleteCachedGame(CHAT_ID, TOPIC);
    await db.destroy();
    await redis.quit();
  });

  test("migrations applied", async () => {
    // The migrated table exists and is queryable.
    const rows = await db.selectFrom("users").select("id").limit(1).execute();
    expect(Array.isArray(rows)).toBe(true);
  });

  test("findUserByIdentifier resolves @username case-insensitively", async () => {
    await db
      .insertInto("users")
      .values({ id: USER_ID, name: "Int Test", username: "IntUser" })
      .execute();

    const byMention = await findUserByIdentifier("@intuser");
    expect(byMention?.id).toBe(USER_ID);
    expect(byMention?.username).toBe("IntUser");

    const byId = await findUserByIdentifier(USER_ID);
    expect(byId?.id).toBe(USER_ID);

    expect(await findUserByIdentifier("@nobody-here")).toBeUndefined();
  });

  test("ban status round-trips through redis + db", async () => {
    await setCachedBanStatus(USER_ID, true);
    // Different id exercises the redis/DB read path, not the memory cache.
    expect(await getCachedBanStatus(MISS_ID)).toBe(false);
    expect(await getCachedBanStatus(USER_ID)).toBe(true);
  });

  test("game cache: miss sentinel, set, get, delete", async () => {
    expect(await getCachedGame(CHAT_ID, TOPIC)).toBeNull();

    await setCachedGame(CHAT_ID, TOPIC, {
      id: 1,
      word: "crane",
      activeChat: CHAT_ID,
      topicId: TOPIC,
      startedBy: USER_ID,
    });
    const game = await getCachedGame(CHAT_ID, TOPIC);
    expect(game?.word).toBe("crane");

    await deleteCachedGame(CHAT_ID, TOPIC);
    expect(await getCachedGame(CHAT_ID, TOPIC)).toBeNull();
  });
});
