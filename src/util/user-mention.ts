import { escapeHtmlEntities } from "./formatting";

// Leaf module (formatting itself has no imports) so it can be shared by
// captcha-challenge and captcha-queue without creating a circular dependency.
export const formatUserMention = ({
  id,
  name,
  username,
}: {
  id: string;
  name?: string | null;
  username?: string | null;
}) => {
  if (username) return `@${username}`;
  return `<a href="tg://user?id=${id}">${escapeHtmlEntities(name || "User")}</a>`;
};
