import { readBookingConfig } from "../lib/booking/config.ts";
import { createGoogleBookingProvider } from "../lib/booking/google.ts";
import type { ReservationInput } from "../lib/booking/provider.ts";
import { addDays, warsawDate, warsawDay, warsawTime } from "../lib/booking/slots.ts";

const config = readBookingConfig();
if (!config || config.provider !== "google") {
  console.error("Booking is not configured for Google Calendar; check the BOOKING_* variables.");
  process.exit(1);
}

const provider = createGoogleBookingProvider(config);

function label(date: Date): string {
  const { day, minutes } = warsawTime(date);
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${day} ${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

function at(day: string, hour: number): Date {
  const date = warsawDate(day, hour * 60);
  if (!date) throw new Error(`${day} ${hour}:00 does not exist in Warsaw`);
  return date;
}

console.log("Service account:", config.google.clientEmail);
console.log("Bookings calendar:", config.bookingsCalendarId);
console.log("Blocking calendars:", config.blockingCalendarIds.join(", "));
console.log("Daily window:", `${config.window.start / 60}:00-${config.window.end / 60}:00`);

const today = warsawDay(provider.now());
const week = { start: at(today, 0), end: at(addDays(today, 7), 0) };

console.log(`\nBusy intervals ${today} .. ${addDays(today, 7)} (Warsaw time):`);
const busy = await provider.busyIntervals(week);
for (const interval of busy) console.log(`  ${label(interval.start)} - ${label(interval.end)}`);
console.log(`  ${busy.length} interval(s)`);

const day = addDays(today, 7);
const input: ReservationInput = {
  start: at(day, 12),
  end: at(day, 13),
  duration: 1,
  price: 400,
  locale: "en",
  name: "Test Visitor (delete me)",
  email: "test.visitor@example.com",
  phone: "+48 000 000 000",
  telegram: "@test_visitor",
  sessionType: "test",
  comment: "Created by scripts/check-booking-calendar.ts; safe to delete.",
};

console.log(`\nCreating a test reservation ${label(input.start)} - ${label(input.end)}...`);
const created = await provider.createReservation(input);
console.log("  created:", created.id, "at", created.createdAt.toISOString());

try {
  const listed = (await provider.reservations({ start: at(day, 0), end: at(addDays(day, 1), 0) })).find(
    (reservation) => reservation.id === created.id,
  );
  console.log("  listed by reservations():", listed ? `yes, "${listed.name}" ${label(listed.start)}` : "NO");

  const fetched = await provider.getReservation(created.id);
  console.log("  found by getReservation():", fetched ? `yes, ${fetched.email}, ${fetched.locale}` : "NO");
} finally {
  await provider.deleteReservation(created.id);
  console.log("  deleted");
}

const gone = await provider.getReservation(created.id);
console.log("  gone after delete:", gone === null ? "yes" : "NO");
await provider.deleteReservation(created.id);
console.log("  deleting again is a no-op: yes");

console.log(`\n${busy.length === 0 ? "No" : busy.length} busy interval(s) read, create/read/delete OK.`);
