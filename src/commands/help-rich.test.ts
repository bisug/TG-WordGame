import { expect, test } from "bun:test";

process.env.BOT_TOKEN ??= "test-token";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost/db";

const {
  getAdminCommandsMessage,
  getGroupSettingsMessage,
  getHowToPlayMessage,
  getOtherCommandsMessage,
  getScoresMessage,
} = await import("./help");

// Tags accepted by rich HTML in Bot API 10.5. Attributes such as `expandable`,
// `bordered`, `compact` and `align` are validated by their own assertions.
const RICH_TAGS_10_5 = new Set([
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "code",
  "mark",
  "sub",
  "sup",
  "tg-spoiler",
  "tg-reference",
  "tg-emoji",
  "img",
  "tg-time",
  "tg-math",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "pre",
  "footer",
  "hr",
  "ul",
  "ol",
  "li",
  "input",
  "br",
  "blockquote",
  "cite",
  "aside",
  "video",
  "audio",
  "tg-document",
  "figure",
  "figcaption",
  "tg-map",
  "tg-collage",
  "tg-slideshow",
  "table",
  "caption",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "tg-math-block",
  "tg-button",
  "tg-button-row",
]);

test("help messages use only Bot API 10.5 rich HTML tags", () => {
  const messages = [
    getHowToPlayMessage(),
    getScoresMessage(),
    getGroupSettingsMessage(),
    getOtherCommandsMessage(),
    getAdminCommandsMessage(),
  ];

  for (const html of messages) {
    const tags = [...html.matchAll(/<\/?([a-z][\w-]*)\b/gi)].map((m) =>
      m[1]?.toLowerCase(),
    );
    for (const tag of tags) {
      expect(RICH_TAGS_10_5.has(tag ?? "")).toBe(true);
    }
  }
});

test("how-to uses 10.3 button rows and 10.5 expandable quotations", () => {
  const html = getHowToPlayMessage();
  expect(html).toContain('<tg-button-row align="center">');
  expect(html).toContain("<blockquote expandable>");
});
