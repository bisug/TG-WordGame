// Rich messages (Bot API 10.1+, button rows 10.3+) are only sent to the official
// API root. Custom roots may point at older or self-hosted servers that reject
// these methods.
export function supportsRichMessages(apiRoot: string): boolean {
  return (
    apiRoot.replace(/\/+$/, "").toLowerCase() === "https://api.telegram.org"
  );
}

// Converts the rich HTML used by help and feedback into Telegram's classic
// HTML parse-mode subset for deployments without rich-message support.
export function richToPlainHtml(html: string): string {
  return (
    html
      .replace(
        /<tg-button(\s[^>]*)?>([\s\S]*?)<\/tg-button>/g,
        (_match, attrs: string | undefined, label: string) => {
          const marker = attrs?.includes('style="success"')
            ? "🟩"
            : attrs?.includes('style="danger"')
              ? "🟥"
              : "🟨";
          return marker + label;
        },
      )
      // Bot API 10.5: expandable quotations and button rows need plain equivalents.
      .replace(/<blockquote expandable>/g, "<blockquote>")
      .replace(/<\/?tg-button-row[^>]*>/g, "")
      .replace(/<\/?(?:h1|h2|h3|h4|h5|h6|p|div|footer)>/g, "\n")
      .replace(/<hr\s*\/?>/g, "\n")
      .replace(/<\/?(?:ol|ul)>/g, "")
      .replace(/<li>/g, "• ")
      .replace(/<\/li>/g, "\n")
      .replace(/<table[^>]*>|<\/table>/g, "")
      .replace(/<\/?tr>/g, "\n")
      .replace(/<\/?(?:th|td)>/g, " ")
      .replace(/<summary>/g, "<b>")
      .replace(/<\/summary>/g, "</b>\n")
      .replace(/<\/?details>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
