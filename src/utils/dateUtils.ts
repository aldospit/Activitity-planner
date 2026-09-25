/**
 * Date and Week calculations according to international ISO-8601 standards.
 */

export function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday behave as day number 7
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

export function getISOWeekYear(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  return date.getUTCFullYear();
}

export function getWeekDates(year: number, week: number): Date[] {
  // ISO week 1 always contains the first Thursday of the year, which is equivalent to Jan 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  // Monday of week 1
  const mondayOfWeek1 = new Date(jan4.getTime() - (dayNum - 1) * 24 * 60 * 60 * 1000);
  // Monday of target week
  const targetMonday = new Date(mondayOfWeek1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    // Return standard timezone Date for local display
    const d = new Date(targetMonday.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return dates;
}

export function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isDateInRange(targetStr: string, startStr: string, endStr: string | null): boolean {
  const target = new Date(targetStr).getTime();
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : start;
  return target >= start && target <= end;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}
