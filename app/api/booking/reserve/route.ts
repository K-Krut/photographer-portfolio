import type { NextRequest } from "next/server";
import { readBookingConfig, type BookingConfig } from "@/lib/booking/config";
import { sessionPrice } from "@/lib/booking/price";
import { photographerReservationEmail, visitorReservationEmail } from "@/lib/booking/messages";
import {
  getBookingProvider,
  type BookingProvider,
  type EmailMessage,
  type Reservation,
  type ReservationInput,
} from "@/lib/booking/provider";
import { losesConflict, parseReservation, reservationLimiter } from "@/lib/booking/reservation";
import { dayRange, isBookable, warsawDay } from "@/lib/booking/slots";
import { cancelUrl } from "@/lib/booking/tokens";
import { currency, getCategories, site } from "@/lib/content";
import { json, loadAvailability } from "../availability";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function unavailable(error: unknown): Response {
  console.error("Booking provider failed", error);
  return json(503, { error: "failed" });
}

async function isBookableNow(config: BookingConfig, input: ReservationInput): Promise<boolean> {
  const availability = await loadAvailability(config, dayRange(warsawDay(input.start)));
  return isBookable(input.start, input.duration, availability);
}

async function notifyReservation(
  config: BookingConfig,
  provider: BookingProvider,
  reservation: Reservation,
  visitorCancelUrl: string,
): Promise<void> {
  const sessionTypeName = getCategories().find((category) => category.slug === reservation.sessionType)
    ?.name[reservation.locale];
  const context = { site, currency, sessionTypeName };
  const photographerCancelUrl = cancelUrl(
    site.url,
    reservation.locale,
    { id: reservation.id, kind: "photographer" },
    config.tokenSecret,
  );
  const messages: [string, () => EmailMessage][] = [
    ["visitor", () => visitorReservationEmail(reservation, { ...context, cancelUrl: visitorCancelUrl })],
    [
      "photographer",
      () =>
        photographerReservationEmail(
          reservation,
          { ...context, cancelUrl: photographerCancelUrl },
          config.notifyEmail,
        ),
    ],
  ];
  const results = await Promise.allSettled(
    messages.map(async ([, build]) => provider.sendEmail(build())),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Booking ${messages[index][0]} e-mail failed`, reservation.id, result.reason);
    }
  });
}

function publicReservation(reservation: Reservation) {
  const { id, start, end, duration, price, locale, name, email, phone, telegram, sessionType, comment } =
    reservation;
  return { id, start, end, duration, price, locale, name, email, phone, telegram, sessionType, comment };
}

export async function POST(request: NextRequest) {
  const config = readBookingConfig();
  if (!config) return json(404, { error: "not_configured" });

  const body: unknown = await request.json().catch(() => null);
  const slugs = getCategories().map((category) => category.slug);
  const parsed = parseReservation(body, slugs);
  if (parsed.kind === "failed") return json(400, { error: "failed" });
  if (parsed.kind === "invalid") return json(400, { error: "validation", fields: parsed.fields });

  const ip = clientIp(request);
  const limiter = reservationLimiter();
  if (limiter.isOverLimit(ip, Date.now())) return json(429, { error: "tooMany" });

  const input: ReservationInput = { ...parsed.input, price: sessionPrice(parsed.input.duration) };
  const provider = getBookingProvider(config);

  let reservation: Reservation;
  try {
    if (!(await isBookableNow(config, input))) return json(409, { error: "slotTaken" });
    reservation = await provider.createReservation(input);
  } catch (error) {
    return unavailable(error);
  }

  try {
    const existing = await provider.reservations({ start: reservation.start, end: reservation.end });
    if (losesConflict(reservation, existing)) {
      await provider.deleteReservation(reservation.id);
      return json(409, { error: "slotTaken" });
    }
  } catch (error) {
    await provider
      .deleteReservation(reservation.id)
      .catch((rollbackError) => console.error("Booking rollback failed", reservation.id, rollbackError));
    return unavailable(error);
  }

  limiter.record(ip, Date.now());
  const link = cancelUrl(site.url, input.locale, { id: reservation.id, kind: "visitor" }, config.tokenSecret);
  await notifyReservation(config, provider, reservation, link);
  return json(201, { reservation: publicReservation(reservation), cancelUrl: link });
}
