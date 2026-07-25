import { env } from "../config/env";

// Resolve the UTC instant that displays as `datePart` (YYYY-MM-DD) + `timePart`
// (HH:mm:ss) wall-clock time in `timeZone`. DST-safe via a two-pass offset
// correction: start from the wall-clock treated as UTC, find the zone offset at
// that instant, then re-correct once (enough because offset changes slowly).
export function getZonedInstant(
  datePart: string,
  timePart: string,
  timeZone: string,
): Date {
  const wallAsUtc = Date.parse(`${datePart}T${timePart}Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const offsetAt = (instant: number) => {
    const map: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(instant))) map[p.type] = p.value;
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return asUtc - instant;
  };
  const offset = offsetAt(wallAsUtc - offsetAt(wallAsUtc));
  return new Date(wallAsUtc - offset);
}

type ZonedTimeKey = "today" | "week" | "month" | "year";

// Start of the current period (today/week/month/year) in `timeZone`, as a UTC
// instant. Used to build sargable SQL `createdAt >= <instant>` bounds that are
// independent of the Postgres server timezone.
export function getZonedPeriodStart(
  timeKey: ZonedTimeKey,
  timeZone: string = env.TIME_ZONE,
): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const today = new Date(
    `${get("year")}-${get("month")}-${get("day")}T00:00:00`,
  );

  let target = new Date(today);
  if (timeKey === "week") {
    const dow = (today.getDay() + 6) % 7; // Monday = 0
    target.setDate(today.getDate() - dow);
  } else if (timeKey === "month") {
    target = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (timeKey === "year") {
    target = new Date(today.getFullYear(), 0, 1);
  }

  const datePart = `${target.getFullYear()}-${String(
    target.getMonth() + 1,
  ).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  return getZonedInstant(datePart, "00:00:00", timeZone);
}
