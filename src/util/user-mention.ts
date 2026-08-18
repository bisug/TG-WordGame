// Leaf module (no imports) so it can be shared by captcha-challenge and
// captcha-queue without creating a circular dependency between them.
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
  return `<a href="tg://user?id=${id}">${name || "User"}</a>`;
};
