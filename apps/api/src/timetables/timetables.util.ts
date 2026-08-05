import { BadRequestException } from '@nestjs/common';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Parses "YYYY-MM-DD" as a UTC date, throwing 400 on malformed input. */
export function parseIsoDate(value: string, field = 'date'): Date {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new BadRequestException(`${field} must be formatted as YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid calendar date.`);
  }
  return date;
}

/** ISO weekday (1=Monday .. 7=Sunday) of a "YYYY-MM-DD" string. */
export function isoWeekday(value: string): number {
  const day = parseIsoDate(value).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Adds `days` to a "YYYY-MM-DD" string, returning "YYYY-MM-DD". */
export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Formats a Date (or date-like) back to "YYYY-MM-DD". */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Converts "HH:mm" to minutes since midnight. */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
