import { randomInt } from "crypto";

import { redis } from "../config/redis";
import { logger } from "../config/logger";
import commonSixWords from "../data/common-six.json";
import commonFiveWords from "../data/common-five.json";
import commonFourWords from "../data/common-four.json";

export type WordLength = 4 | 5 | 6;

const WORD_LIST: Record<WordLength, string[]> = {
  4: commonFourWords,
  5: commonFiveWords,
  6: commonSixWords,
};

export interface WordSelectorConfig {
  historySize: number;
  resetThreshold: number;
  ttlSeconds: number;
}

export class WordSelector {
  private config: WordSelectorConfig;

  constructor(config: Partial<WordSelectorConfig> = {}) {
    this.config = {
      historySize: config.historySize ?? 50,
      resetThreshold: config.resetThreshold ?? 10,
      ttlSeconds: config.ttlSeconds ?? 7 * 24 * 60 * 60,
    };
  }

  private historyKey(chatId: string | number, wordLength: WordLength): string {
    return `h:${chatId}:${wordLength}`;
  }

  async getRandomWord(
    chatId: string | number,
    wordLength: WordLength = 5,
  ): Promise<string> {
    const historyKey = this.historyKey(chatId, wordLength);
    const wordList = WORD_LIST[wordLength];

    try {
      const pipeline = redis.pipeline();
      pipeline.smembers(historyKey);
      pipeline.scard(historyKey);
      const results = await pipeline.exec();

      if (!results || results.length !== 2) {
        throw new Error("Pipeline failed");
      }

      const usedWords = results[0][1] as string[];
      const setSize = results[1][1] as number;

      const usedWordsSet = new Set(usedWords.map((w) => w.toLowerCase()));
      const availableWords = wordList.filter(
        (word) => !usedWordsSet.has(word.toLowerCase()),
      );

      if (availableWords.length < this.config.resetThreshold) {
        const recentWords = usedWords.slice(
          -Math.floor(this.config.resetThreshold / 2),
        );
        await redis.del(historyKey);
        if (recentWords.length > 0) {
          await redis.sadd(historyKey, ...recentWords);
        }
        return this.getRandomWord(chatId, wordLength);
      }

      const randomWord =
        availableWords[randomInt(0, availableWords.length)].toLowerCase();

      const updatePipeline = redis.pipeline();
      updatePipeline.sadd(historyKey, randomWord);
      updatePipeline.expire(historyKey, this.config.ttlSeconds);

      if (setSize >= this.config.historySize) {
        const trimCount = Math.floor(this.config.historySize * 0.2);
        updatePipeline.spop(historyKey, trimCount);
      }

      await updatePipeline.exec();

      return randomWord;
    } catch (error) {
      logger.error({ err: error }, "Redis error, using fallback word");
      return wordList[randomInt(0, wordList.length)].toLowerCase();
    }
  }

}
