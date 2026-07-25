export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function escapeHtmlEntities(text: string): string {
  const entityMap = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };

  return text.replace(
    /[<>&"'/]/g,
    (char) => entityMap[char as keyof typeof entityMap],
  );
}

export function formatDuration(duration: number): string {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  }
}

const fancyMap: Record<string, string> = {
  "0": "𝟬",
  "1": "𝟭",
  "2": "𝟮",
  "3": "𝟯",
  "4": "𝟰",
  "5": "𝟱",
  "6": "𝟲",
  "7": "𝟳",
  "8": "𝟴",
  "9": "𝟵",
  A: "𝗔",
  B: "𝗕",
  C: "𝗖",
  D: "𝗗",
  E: "𝗘",
  F: "𝗙",
  G: "𝗚",
  H: "𝗛",
  I: "𝗜",
  J: "𝗝",
  K: "𝗞",
  L: "𝗟",
  M: "𝗠",
  N: "𝗡",
  O: "𝗢",
  P: "𝗣",
  Q: "𝗤",
  R: "𝗥",
  S: "𝗦",
  T: "𝗧",
  U: "𝗨",
  V: "𝗩",
  W: "𝗪",
  X: "𝗫",
  Y: "𝗬",
  Z: "𝗭",
  a: "𝗮",
  b: "𝗯",
  c: "𝗰",
  d: "𝗱",
  e: "𝗲",
  f: "𝗳",
  g: "𝗴",
  h: "𝗵",
  i: "𝗶",
  j: "𝗷",
  k: "𝗸",
  l: "𝗹",
  m: "𝗺",
  n: "𝗻",
  o: "𝗼",
  p: "𝗽",
  q: "𝗾",
  r: "𝗿",
  s: "𝘀",
  t: "𝘁",
  u: "𝘂",
  v: "𝘃",
  w: "𝘄",
  x: "𝘅",
  y: "𝘆",
  z: "𝘇",
  "!": "!",
  "?": "？",
  "@": "@",
  "#": "#",
  $: "$",
  "%": "%",
  "^": "^",
  "&": "&",
  "*": "*",
  "(": "(",
  ")": ")",
  "-": "-",
  "+": "+",
  "=": "=",
  ":": ":",
  ";": ";",
  '"': '"',
  "'": "'",
  "<": "<",
  ">": ">",
  ",": ",",
  ".": ".",
  "/": "/",
  "\\": "\\",
  "|": "|",
  "[": "[",
  "]": "]",
  "{": "{",
  "}": "}",
};

export function toFancyText(text: string): string {
  return text
    .split("")
    .map((char) => fancyMap[char] || char)
    .join("");
}
