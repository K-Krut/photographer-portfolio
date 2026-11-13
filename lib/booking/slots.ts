import type { BookingWindow } from "./config";

export const timeZone = "Europe/Warsaw";

export type Interval = { start: Date; end: Date };

export type Duration = 1 | 2 | 3;

export const durations: readonly Duration[] = [1, 2, 3];

export const leadTimeMs = 24 * 60 * 60 * 1000;

export const horizonDays = 365;

export type Availability = { window: BookingWindow; busy: Interval[]; now: Date };

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const dayPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function localFields(date: Date) {
  const fields: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(date)) fields[part.type] = Number(part.value);
  return fields;
}

function localAsUtc(date: Date): number {
  const f = localFields(date);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
}

function offsetMs(date: Date): number {
  const whole = new Date(Math.floor(date.getTime() / 1000) * 1000);
  return localAsUtc(whole) - whole.getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayOf(utc: number): string {
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function warsawTime(date: Date): { day: string; minutes: number } {
  const f = localFields(date);
  return { day: `${f.year}-${pad(f.month)}-${pad(f.day)}`, minutes: f.hour * 60 + f.minute };
}

export function warsawDay(date: Date): string {
  return warsawTime(date).day;
}

export function warsawDate(day: string, minutes: number): Date | null {
  if (!dayPattern.test(day)) return null;
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, dayOfMonth, 0, minutes);
  const offsets = new Set([offsetMs(new Date(wanted - dayMs)), offsetMs(new Date(wanted + dayMs))]);
  const instants = [...offsets]
    .map((offset) => wanted - offset)
    .filter((instant) => localAsUtc(new Date(instant)) === wanted);
  return instants.length ? new Date(Math.min(...instants)) : null;
}

export function addDays(day: string, count: number): string {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return dayOf(Date.UTC(year, month - 1, dayOfMonth + count));
}

function startOfDay(day: string): Date {
  const date = warsawDate(day, 0);
  if (!date) throw new Error(`Invalid day: ${day}`);
  return date;
}

export function dayRange(day: string): Interval {
  return { start: startOfDay(day), end: startOfDay(addDays(day, 1)) };
}

export function monthRange(month: string): Interval {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: startOfDay(`${month}-01`), end: startOfDay(dayOf(Date.UTC(year, monthNumber, 1))) };
}

export function horizonDay(now: Date): string {
  return addDays(warsawDay(now), horizonDays);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function dayStarts(day: string, duration: Duration, availability: Availability): Date[] {
  if (!dayPattern.test(day) || !durations.includes(duration)) return [];
  const { window, busy, now } = availability;
  if (day > horizonDay(now)) return [];
  const earliest = now.getTime() + leadTimeMs;
  const starts: Date[] = [];
  for (let hour = Math.ceil(window.start / 60); (hour + duration) * 60 <= window.end; hour++) {
    const start = warsawDate(day, hour * 60);
    if (!start || start.getTime() < earliest) continue;
    const slot = { start, end: new Date(start.getTime() + duration * hourMs) };
    if (busy.some((interval) => overlaps(interval, slot))) continue;
    starts.push(start);
  }
  return starts;
}

export function monthDays(month: string, duration: Duration, availability: Availability): string[] {
  if (!monthPattern.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days: string[] = [];
  for (let dayOfMonth = 1; dayOfMonth <= count; dayOfMonth++) {
    const day = `${month}-${pad(dayOfMonth)}`;
    if (dayStarts(day, duration, availability).length > 0) days.push(day);
  }
  return days;
}

export function isBookable(start: Date, duration: Duration, availability: Availability): boolean {
  if (Number.isNaN(start.getTime())) return false;
  return dayStarts(warsawDay(start), duration, availability).some(
    (candidate) => candidate.getTime() === start.getTime(),
  );
}
