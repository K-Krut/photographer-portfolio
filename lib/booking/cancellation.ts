import type { BookingProvider, Reservation } from "./provider";
import { verifyCancelToken, type CancelKind } from "./tokens.ts";

export const visitorCutoffMs = 24 * 60 * 60 * 1000;

export function cancelDeadline(start: Date, kind: CancelKind): Date {
  return kind === "visitor" ? new Date(start.getTime() - visitorCutoffMs) : start;
}

export function canCancel(start: Date, kind: CancelKind, now: Date): boolean {
  return now < cancelDeadline(start, kind);
}

export type CancelLookup =
  | { status: "invalid" }
  | { status: "alreadyCancelled" }
  | { status: "tooLate" | "open"; kind: CancelKind; reservation: Reservation };

export async function lookUpCancellation(
  token: unknown,
  secret: string,
  provider: Pick<BookingProvider, "getReservation" | "now">,
): Promise<CancelLookup> {
  const payload = typeof token === "string" ? verifyCancelToken(token, secret) : null;
  if (!payload) return { status: "invalid" };
  const reservation = await provider.getReservation(payload.id);
  if (!reservation) return { status: "alreadyCancelled" };
  const status = canCancel(reservation.start, payload.kind, provider.now()) ? "open" : "tooLate";
  return { status, kind: payload.kind, reservation };
}
