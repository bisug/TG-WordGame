// Pure game-day calendar helpers. Kept free of env/db imports so they can be
// unit-tested with any timezone. The game day is defined as starting at 06:00
// wall-clock time in the configured timezone.

export function getDateStringFromDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Constructing an Intl.DateTimeFormat is expensive (~10-100us) and this runs
// on every guess, so cache one formatter per timezone.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

// Returns the "YYYY-MM-DD" game-day string for the given instant in `timeZone`.
// Uses local calendar arithmetic so it is correct regardless of the server's
// own timezone. Instants before 06:00 belong to the previous game day.
export function getGameDateStringForZone(date: Date, timeZone: string): string {
  const formatter = getFormatter(timeZone);

  const parts = formatter.formatToParts(date);
  const get = (t: string) => {
    const value = parts.find((p) => p.type === t)?.value;
    if (!value) throw new Error(`Missing ${t} from formatted game date`);
    return value;
  };

  const dateString = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);

  if (hour < 6) {
    const [yearPart, monthPart, dayPart] = dateString.split("-");
    if (!yearPart || !monthPart || !dayPart) return dateString;

    const shifted = new Date(
      Number(yearPart),
      Number(monthPart) - 1,
      Number(dayPart),
    );
    shifted.setDate(shifted.getDate() - 1);
    return getDateStringFromDate(shifted);
  }

  return dateString;
}

// Build a UTC-midnight Date for a "YYYY-MM-DD" game-day string. Used for both
// inserting and querying dailyWords.date so the two always agree regardless of
// the Postgres session timezone.
export function toUtcMidnight(datePart: string): Date {
  return new Date(`${datePart}T00:00:00Z`);
}
