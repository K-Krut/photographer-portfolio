import { connection, type NextRequest } from "next/server";
import { isBookingFake } from "@/lib/booking/config";
import {
  addFakeBlock,
  addFakeReservation,
  fakeBookingState,
  fakeOperations,
  failNextFakeCalls,
  removeFakeReservation,
  resetFakeBooking,
  type FakeOperation,
} from "@/lib/booking/fake";
import type { ReservationInput } from "@/lib/booking/provider";
import { reservationLimiter } from "@/lib/booking/reservation";
import { dayRange, durations, warsawDate, type Duration } from "@/lib/booking/slots";
import { isLocale } from "@/lib/i18n";

type Body = Record<string, unknown>;

const hourMs = 60 * 60 * 1000;

function text(body: Body, key: string, fallback: string): string {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalText(body: Body, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function timeOf(body: Body, key: string): number | null {
  const value = body[key];
  const match = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value) : null;
  if (!match || Number(match[2]) >= 60) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function bad(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function reservationFrom(body: Body): ReservationInput | string {
  const day = text(body, "day", "");
  const minutes = timeOf(body, "start");
  const start = minutes === null ? null : warsawDate(day, minutes);
  if (!start) return "day (YYYY-MM-DD) and start (HH:MM) are required";
  const duration = typeof body.duration === "number" ? body.duration : 1;
  if (!durations.includes(duration as Duration)) return "duration must be 1, 2 or 3";
  const locale = text(body, "locale", "en");
  if (!isLocale(locale)) return "locale must be en or pl";
  return {
    start,
    end: new Date(start.getTime() + duration * hourMs),
    duration: duration as Duration,
    price: typeof body.price === "number" ? body.price : 0,
    locale,
    name: text(body, "name", "Test Visitor"),
    email: text(body, "email", "visitor@example.com"),
    phone: text(body, "phone", "+48 123 456 789"),
    telegram: optionalText(body, "telegram"),
    sessionType: optionalText(body, "sessionType"),
    comment: optionalText(body, "comment"),
  };
}

function blockFrom(body: Body): { start: Date; end: Date } | string {
  const day = text(body, "day", "");
  if (body.from === undefined && body.to === undefined) {
    return warsawDate(day, 0) ? dayRange(day) : "day (YYYY-MM-DD) is required";
  }
  const from = timeOf(body, "from");
  const to = timeOf(body, "to");
  const start = from === null ? null : warsawDate(day, from);
  const end = to === null ? null : warsawDate(day, to);
  if (!start || !end || start >= end) return "day (YYYY-MM-DD), from (HH:MM) and to (HH:MM) are required";
  return { start, end };
}

export async function GET() {
  await connection();
  if (!isBookingFake()) return new Response(null, { status: 404 });
  return Response.json(fakeBookingState());
}

export async function POST(request: NextRequest) {
  if (!isBookingFake()) return new Response(null, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("JSON object body expected");
  const { action } = body as Body;

  switch (action) {
    case "reset":
      resetFakeBooking();
      reservationLimiter().reset();
      break;
    case "block": {
      const block = blockFrom(body as Body);
      if (typeof block === "string") return bad(block);
      addFakeBlock(block);
      break;
    }
    case "reserve": {
      const input = reservationFrom(body as Body);
      if (typeof input === "string") return bad(input);
      return Response.json(addFakeReservation(input), { status: 201 });
    }
    case "unreserve": {
      const { id } = body as Body;
      if (typeof id !== "string") return bad("id is required");
      removeFakeReservation(id);
      break;
    }
    case "fail": {
      const { operation, times } = body as Body;
      if (!fakeOperations.includes(operation as FakeOperation)) {
        return bad(`operation must be one of ${fakeOperations.join(", ")}`);
      }
      failNextFakeCalls(operation as FakeOperation, typeof times === "number" ? times : 1);
      break;
    }
    default:
      return bad("action must be reset, block, reserve, unreserve or fail");
  }
  return Response.json(fakeBookingState());
}
