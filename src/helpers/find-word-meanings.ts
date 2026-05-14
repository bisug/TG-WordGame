import { promises as fs } from "fs";

import { logger } from "../config/logger";

// Input JSON file
const inputFilePath = "words.json";
const outputFilePath = "words_with_details.json";

async function fetchWordDetails(word: string) {
  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Word not found: ${word}`);
    }
    const data = await response.json();
    const meanings =
      data[0]?.meanings
        .map((meaning: any) => meaning.definitions[0]?.definition)
        .join("; ") || "";
    const pronunciation = data[0]?.phonetics[0]?.text || "";
    const example = data[0]?.meanings[0]?.definitions[0]?.example || "";

    return {
      meaning: meanings,
      pronunciation: pronunciation,
      example: example,
    };
  } catch (error) {
    logger.error({ err: error, word }, `Error fetching details for word`);
    return {
      meaning: "",
      pronunciation: "",
      example: "",
    };
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processWords() {
  try {
    const words = JSON.parse(await fs.readFile(inputFilePath, "utf-8"));
    let result: Record<string, any> = {};

    try {
      result = JSON.parse(await fs.readFile(outputFilePath, "utf-8"));
    } catch {}

    for (const word of words) {
      if (!result[word]) {
        logger.info({ word }, `Fetching details for word`);
        result[word] = await fetchWordDetails(word);
        await fs.writeFile(
          outputFilePath,
          JSON.stringify(result, null, 2),
          "utf-8",
        );
        await delay(1000); // Delay to avoid rate limiting
      } else {
        logger.info({ word }, `Details already exist for word`);
      }
    }

    logger.info("Processing complete.");
  } catch (error) {
    logger.error({ err: error }, "Error during processing");
  }
}

processWords();
