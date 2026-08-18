import { randomInt } from "node:crypto";
import { logger } from "../config/logger";
import { redis } from "../config/redis";
import commonFiveWords from "../data/common-five.json";
import commonFourWords from "../data/common-four.json";
import commonSixWords from "../data/common-six.json";

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
    // "hw" prefix: the legacy "h:" keys are Redis SETs; reusing them with
    // list commands would raise WRONGTYPE until their 7-day TTL expired.
    return `hw:${chatId}:${wordLength}`;
  }

  async getRandomWord(
    chatId: string | number,
    wordLength: WordLength = 5,
  ): Promise<string> {
    const historyKey = this.historyKey(chatId, wordLength);
    const wordList = WORD_LIST[wordLength];

    // Use a loop instead of recursion to avoid call-stack overhead
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // A LIST keeps insertion order, so "recent words" kept across a reset
        // are actually recent. The old SET returned arbitrary order, so the
        // kept words were random and recently-used words repeated at once.
        const usedWords = await redis.lrange(historyKey, 0, -1);

        const usedWordsSet = new Set(usedWords.map((w) => w.toLowerCase()));
        const availableWords = wordList.filter(
          (word) => !usedWordsSet.has(word.toLowerCase()),
        );

        if (availableWords.length < this.config.resetThreshold) {
          // Reset history and retry (loop iteration), keeping the newest few
          // words so they don't immediately repeat.
          const recentWords = usedWords.slice(
            -Math.floor(this.config.resetThreshold / 2),
          );
          const resetPipeline = redis.pipeline();
          resetPipeline.del(historyKey);
          if (recentWords.length > 0) {
            resetPipeline.rpush(historyKey, ...recentWords);
          }
          resetPipeline.expire(historyKey, this.config.ttlSeconds);
          await resetPipeline.exec();
          continue; // retry with fresh history
        }

        const selectedWord =
          availableWords[randomInt(0, availableWords.length)];
        if (!selectedWord) throw new Error("No available word found");
        const randomWord = selectedWord.toLowerCase();

        const updatePipeline = redis.pipeline();
        updatePipeline.rpush(historyKey, randomWord);
        // Cap the list at historySize, keeping the newest entries (the old
        // SPOP trim removed random members, possibly the word just added).
        updatePipeline.ltrim(historyKey, -this.config.historySize, -1);
        updatePipeline.expire(historyKey, this.config.ttlSeconds);
        await updatePipeline.exec();

        return randomWord;
      } catch (error) {
        logger.error({ err: error }, "Redis error, using fallback word");
        const fallbackWord = wordList[randomInt(0, wordList.length)];
        if (!fallbackWord) {
          throw new Error(`Word list for length ${wordLength} is empty`);
        }
        return fallbackWord.toLowerCase();
      }
    }

    // Fallback if loop exhausts retries
    const fallbackWord = wordList[randomInt(0, wordList.length)];
    if (!fallbackWord) {
      throw new Error(`Word list for length ${wordLength} is empty`);
    }
    return fallbackWord.toLowerCase();
  }
}
