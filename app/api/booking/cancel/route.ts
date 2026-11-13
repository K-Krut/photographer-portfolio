import type { NextRequest } from "next/server";
import { lookUpCancellation, type CancelLookup } from "@/lib/booking/cancellation";
import { readBookingConfig, type BookingConfig } from "@/lib/booking/config";
import { photographerCancellationEmail, visitorCancellationEmail } from "@/lib/booking/messages";
import { getBookingProvider, type BookingProvider, type EmailMessage, type Reservation } from "@/lib/booking/provider";
import type { CancelKind } from "@/lib/booking/tokens";
import { currency, getCategories, site } from "@/lib/content";
import { json } from "../availability";

function unavailable(error: unknown): Response {
  console.error("Booking provider failed", error);
  return json(503, { error: "failed" });
}

async function notifyCancellation(
  config: BookingConfig,
  provider: BookingProvider,
  reservation: Reservation,
  kind: CancelKind,
): Promise<void> {
  const sessionTypeName = getCategories().find((category) => category.slug === reservation.sessionType)
    ?.name[reservation.locale];
  const context = { site, currency, sessionTypeName };
  const messages: [string, () => EmailMessage][] = [
    ["visitor", () => visitorCancellationEmail(reservation, kind, context)],
    ["photographer", () => photographerCancellationEmail(reservation, kind, context, config.notifyEmail)],
  ];
  const results = await Promise.allSettled(messages.map(async ([, build]) => provider.sendEmail(build())));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Booking ${messages[index][0]} cancellation e-mail failed`, reservation.id, result.reason);
    }
  });
}

export async function POST(request: NextRequest) {
  const config = readBookingConfig();
  if (!config) return json(404, { error: "not_configured" });

  const body: unknown = await request.json().catch(() => null);
  const token = body && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  const provider = getBookingProvider(config);

  let lookup: CancelLookup;
  try {
    lookup = await lookUpCancellation(token, config.tokenSecret, provider);
  } catch (error) {
    return unavailable(error);
  }
  if (lookup.status === "invalid") return json(400, { error: "invalid" });
  if (lookup.status === "alreadyCancelled") return json(200, { status: "alreadyCancelled" });
  if (lookup.status === "tooLate") return json(403, { error: "tooLate" });

  try {
    await provider.deleteReservation(lookup.reservation.id);
  } catch (error) {
    return unavailable(error);
  }

  await notifyCancellation(config, provider, lookup.reservation, lookup.kind);
  return json(200, { status: "cancelled" });
}
