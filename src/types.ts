import type {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "./config/constants";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  username: string | null;
  totalScore: number;
};

export type AllowedChatSearchKey = (typeof allowedChatSearchKeys)[number];
export type AllowedChatTimeKey = (typeof allowedChatTimeKeys)[number];
