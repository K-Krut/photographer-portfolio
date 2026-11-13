import { isLocale } from "../i18n.ts";
import type { Reservation, ReservationInput } from "./provider";
import { durations, warsawTime, type Duration } from "./slots.ts";
import { contactError, normaliseTelegram, type ContactErrorKey } from "./validation.ts";

export { isPlausibleEmail, isPlausibleName, isPlausiblePhone, normaliseTelegram } from "./validation.ts";

export type ReservationField = "name" | "email" | "phone" | "telegram" | "sessionType" | "comment";

export type ReservationErrorKey = ContactErrorKey | "sessionType" | "comment";

export type FieldErrors = Partial<Record<ReservationField, ReservationErrorKey>>;

export type ParsedReservation =
  | { kind: "failed" }
  | { kind: "invalid"; fields: FieldErrors }
  | { kind: "valid"; input: Omit<ReservationInput, "price"> };

export const minimumFillMs = 3000;
export const reservationLimit = { count: 5, windowMs: 60 * 60 * 1000 };

const hourMs = 60 * 60 * 1000;

type Body = Record<string, unknown>;

function trimmed(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}

function startOf(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime()) || start.getTime() % 60000 !== 0) return null;
  return warsawTime(start).minutes % 60 === 0 ? start : null;
}

export function parseReservation(
  body: unknown,
  sessionTypes: readonly string[],
): ParsedReservation {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { kind: "failed" };
  const data = body as Body;

  const website = trimmed(data.website);
  if (website !== "") return { kind: "failed" };
  const { elapsedMs } = data;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < minimumFillMs) {
    return { kind: "failed" };
  }

  const start = startOf(data.start);
  const duration = durations.find((candidate) => candidate === data.duration);
  const locale = data.locale;
  if (!start || !duration || typeof locale !== "string" || !isLocale(locale)) return { kind: "failed" };

  const fields: FieldErrors = {};
  const name = trimmed(data.name);
  const email = trimmed(data.email);
  const phone = trimmed(data.phone);
  const telegramText = trimmed(data.telegram);
  const contact = { name, email, phone, telegram: telegramText };
  for (const field of ["name", "email", "phone", "telegram"] as const) {
    const value = contact[field];
    const error = value === null ? field : contactError(field, value);
    if (error) fields[field] = error;
  }
  const telegram = telegramText ? normaliseTelegram(telegramText) : undefined;

  const sessionType = trimmed(data.sessionType);
  if (sessionType === null || (sessionType && !sessionTypes.includes(sessionType))) {
    fields.sessionType = "sessionType";
  }

  const comment = trimmed(data.comment);
  if (comment === null || comment.length > 1000) fields.comment = "comment";

  if (Object.keys(fields).length > 0) return { kind: "invalid", fields };

  return {
    kind: "valid",
    input: {
      start,
      end: new Date(start.getTime() + duration * hourMs),
      duration: duration as Duration,
      locale,
      name: name as string,
      email: email as string,
      phone: phone as string,
      ...(telegram ? { telegram } : {}),
      ...(sessionType ? { sessionType } : {}),
      ...(comment ? { comment } : {}),
    },
  };
}

type Ranked = Pick<Reservation, "id" | "start" | "end" | "createdAt">;

function ranksBefore(a: Ranked, b: Ranked): boolean {
  const difference = a.createdAt.getTime() - b.createdAt.getTime();
  return difference < 0 || (difference === 0 && a.id < b.id);
}

export function losesConflict(ours: Ranked, existing: readonly Ranked[]): boolean {
  return existing.some(
    (other) =>
      other.id !== ours.id &&
      other.start < ours.end &&
      ours.start < other.end &&
      ranksBefore(other, ours),
  );
}

export function createReservationLimiter(limit = reservationLimit) {
  const history = new Map<string, number[]>();

  function recent(key: string, nowMs: number): number[] {
    const kept = (history.get(key) ?? []).filter((at) => nowMs - at < limit.windowMs);
    if (kept.length) history.set(key, kept);
    else history.delete(key);
    return kept;
  }

  return {
    isOverLimit: (key: string, nowMs: number) => recent(key, nowMs).length >= limit.count,
    record: (key: string, nowMs: number) => history.set(key, [...recent(key, nowMs), nowMs]),
    reset: () => history.clear(),
  };
}

const limiterKey = Symbol.for("revich.booking.limiter");

export function reservationLimiter(): ReturnType<typeof createReservationLimiter> {
  const holder = globalThis as unknown as Record<symbol, ReturnType<typeof createReservationLimiter>>;
  return (holder[limiterKey] ??= createReservationLimiter());
}
