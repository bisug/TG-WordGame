import { z } from "zod";

export const captchaSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  adminId: z.string(),
  messageId: z.number(),
  answer: z.tuple([z.string(), z.string(), z.string()]),
  progress: z.array(z.string()).max(3),
  attempts: z.number().max(3),
  createdAt: z.number(),
  name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
});

// Per-user WordSeek of the Day state stored under `daily_wordle:${userId}`
// (written by /daily and /pausedaily, read by the guess handler and the
// guards). It lives here rather than in handlers/on-message so util/guards.ts
// can validate it without importing a handler module.
export const dailyWordleSchema = z.object({
  dailyWordId: z.number(),
  date: z.string(),
});
