import { escapeHtmlEntities } from "./formatting";

interface WordDetailsInput {
  word: string;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
}

function renderWordDetails(input: WordDetailsInput, shouldEscape = true) {
  const { word, meaning, phonetic, sentence } = input;

  const parts: string[] = [];

  parts.push(`<strong>Correct Word: ${escapeHtmlEntities(word)}</strong>`);

  if (phonetic) {
    parts.push(
      `<strong>${escapeHtmlEntities(capitalizeFirstLetter(word))}</strong> <code>${escapeHtmlEntities(phonetic)}</code>`,
    );
  }

  if (meaning) {
    parts.push(
      `<strong>Meaning</strong>: ${
        shouldEscape ? escapeHtmlEntities(meaning) : meaning
      }`,
    );
  }

  if (sentence) {
    parts.push(`<strong>Example</strong>: ${escapeHtmlEntities(sentence)}`);
  }

  return `<blockquote>${parts.join("\n")}</blockquote>`;
}

export function formatDailyWordDetails(data: WordDetailsInput) {
  return renderWordDetails({
    word: data.word,
    meaning: data.meaning,
    phonetic: data.phonetic,
    sentence: data.sentence,
  });
}

function capitalizeFirstLetter(string: string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}
