import commonWords from "../data/commonWords.json";
import overrideWords from "../data/daily-word-details-overrides.json";

interface RawWordDetails {
  meaning?: string;
  pronunciation?: string;
  example?: string;
}

export interface LocalWordDetails {
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
}

const WORD_DETAILS = commonWords as Record<string, RawWordDetails | undefined>;
const OVERRIDE_WORD_DETAILS = overrideWords as Record<
  string,
  RawWordDetails | undefined
>;

export function getLocalWordDetails(word: string): LocalWordDetails {
  const normalizedWord = word.toLowerCase();
  const details =
    OVERRIDE_WORD_DETAILS[normalizedWord] ?? WORD_DETAILS[normalizedWord];

  return {
    meaning: normalizeDetail(details?.meaning, 900),
    phonetic: normalizeDetail(details?.pronunciation, 120),
    sentence: normalizeDetail(details?.example, 300),
  };
}

function normalizeDetail(value: string | undefined, maxLength: number) {
  const normalized = value
    ? stripControlCharacters(value).replace(/\s+/g, " ").trim()
    : undefined;

  if (!normalized) return null;
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trimEnd()
    : normalized;
}

function stripControlCharacters(value: string) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? " " : char;
  }).join("");
}
