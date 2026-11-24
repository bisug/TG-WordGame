// Runs an operation at the scheduled delays until it succeeds. Returns
// undefined when all attempts fail, so callers can keep best-effort startup
// work from blocking the bot.
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void> = async (ms) => {
    await Bun.sleep(ms);
  },
): Promise<T | undefined> {
  for (const delay of delaysMs) {
    if (delay > 0) await sleep(delay);
    try {
      return await operation();
    } catch {
      // Try again at the next scheduled delay.
    }
  }
  return undefined;
}
