import { env } from "./env";

// Strip sslmode from DATABASE_URL so our explicit ssl option is the only one
// pg sees. This prevents providers from forcing stricter verify-full behavior.
export function getDbConnectionString() {
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

export function getDbSslConfig() {
  const defaultSsl = env.NODE_ENV === "production";
  const useSsl = env.DATABASE_SSL ?? defaultSsl;

  return useSsl
    ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED }
    : false;
}
