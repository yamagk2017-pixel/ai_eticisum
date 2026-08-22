export const NEWS_DISPLAY_TIME_ZONE = "Asia/Tokyo";

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_WITHOUT_ZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * News timestamps are instants. Legacy WordPress values without an offset are
 * Japan-local wall-clock values, so make that assumption explicit instead of
 * letting the server's local time zone decide how to parse them.
 */
export function parseNewsDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = ISO_DATE_ONLY_PATTERN.test(trimmed)
    ? `${trimmed}T00:00:00+09:00`
    : ISO_DATE_TIME_WITHOUT_ZONE_PATTERN.test(trimmed)
      ? `${trimmed}+09:00`
      : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNewsDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  emptyValue = "-"
): string {
  if (!value) return emptyValue;
  const date = parseNewsDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    ...options,
    timeZone: NEWS_DISPLAY_TIME_ZONE,
  }).format(date);
}
