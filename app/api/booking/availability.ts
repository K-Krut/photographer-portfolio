import type { BookingConfig } from "@/lib/booking/config";
import { getBookingProvider } from "@/lib/booking/provider";
import { durations, type Availability, type Duration, type Interval } from "@/lib/booking/slots";

export const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export const dayPattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseDuration(value: string | null): Duration | null {
  return durations.find((duration) => String(duration) === value) ?? null;
}

export async function loadAvailability(config: BookingConfig, range: Interval): Promise<Availability> {
  const provider = getBookingProvider(config);
  const [busy, reservations] = await Promise.all([
    provider.busyIntervals(range),
    provider.reservations(range),
  ]);
  return { window: config.window, busy: [...busy, ...reservations], now: provider.now() };
}

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function providerError(error: unknown): Response {
  console.error("Booking provider failed", error);
  return json(503, { error: "provider_unavailable" });
}
