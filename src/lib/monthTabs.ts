export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parses a "YYYY-M" or "YYYY-MM" sheet tab title into its year/month, or null if it doesn't match. */
export function parseMonthTitle(title: string): { year: number; month: number } | null {
  const match = title.trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;

  return { year, month };
}

/** Formats a "YYYY-M"/"YYYY-MM" tab title as "Month 'YY", falling back to the raw title otherwise. */
export function formatMonthTitle(title: string): string {
  const parsed = parseMonthTitle(title);
  if (!parsed) return title;
  return `${MONTH_NAMES[parsed.month - 1]} '${String(parsed.year).slice(2)}`;
}
