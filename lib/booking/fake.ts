import type { BookingProvider, EmailMessage, Reservation, ReservationInput } from "./provider";
import { addDays, dayRange, horizonDays, warsawDate, warsawDay, type Interval } from "./slots.ts";

export const fakeNow = new Date("2026-10-12T08:00:00Z");

export const fakeOperations = [
  "busyIntervals",
  "reservations",
  "getReservation",
  "createReservation",
  "deleteReservation",
  "sendEmail",
  "sendTelegram",
] as const;

export type FakeOperation = (typeof fakeOperations)[number];

export type FakeBookingState = {
  now: Date;
  blocks: Interval[];
  reservations: Reservation[];
  emails: EmailMessage[];
  telegrams: string[];
};

type Store = FakeBookingState & { failing: Map<FakeOperation, number>; sequence: number };

const storeKey = Symbol.for("revich.booking.fake");

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function at(day: string, minutes: number): Date {
  const date = warsawDate(day, minutes);
  if (!date) throw new Error(`No ${minutes} minutes on ${day}`);
  return date;
}

function seededBlocks(): Interval[] {
  const blocks: Interval[] = [];
  let day = addDays(warsawDay(fakeNow), -7);
  for (let count = 0; count < horizonDays + 70; count++, day = addDays(day, 1)) {
    if (weekday(day) === 0) blocks.push(dayRange(day));
    if (weekday(day) === 1 || weekday(day) === 3) {
      blocks.push({ start: at(day, 8 * 60), end: at(day, 17 * 60) });
    }
  }
  return blocks;
}

function freshStore(): Store {
  return {
    now: fakeNow,
    blocks: seededBlocks(),
    reservations: [],
    emails: [],
    telegrams: [],
    failing: new Map(),
    sequence: 0,
  };
}

function store(): Store {
  const holder = globalThis as unknown as Record<symbol, Store | undefined>;
  return (holder[storeKey] ??= freshStore());
}

function guard(operation: FakeOperation): void {
  const failing = store().failing;
  const left = failing.get(operation) ?? 0;
  if (left === 0) return;
  if (left === 1) failing.delete(operation);
  else failing.set(operation, left - 1);
  throw new Error(`Fake booking provider: ${operation} failed on purpose`);
}

function overlapping<T extends Interval>(items: T[], range: Interval): T[] {
  return items.filter((item) => item.start < range.end && range.start < item.end);
}

export function addFakeReservation(input: ReservationInput): Reservation {
  const current = store();
  const sequence = ++current.sequence;
  const reservation: Reservation = {
    ...input,
    id: `fake-${sequence}`,
    createdAt: new Date(fakeNow.getTime() + sequence),
  };
  current.reservations.push(reservation);
  return reservation;
}

export function resetFakeBooking(): void {
  const holder = globalThis as unknown as Record<symbol, Store | undefined>;
  holder[storeKey] = freshStore();
}

export function fakeBookingState(): FakeBookingState {
  const { now, blocks, reservations, emails, telegrams } = store();
  return { now, blocks, reservations, emails, telegrams };
}

export function addFakeBlock(interval: Interval): void {
  store().blocks.push(interval);
}

export function removeFakeReservation(id: string): void {
  const current = store();
  current.reservations = current.reservations.filter((reservation) => reservation.id !== id);
}

export function failNextFakeCalls(operation: FakeOperation, times = 1): void {
  store().failing.set(operation, times);
}

export const fakeBookingProvider: BookingProvider = {
  now: () => fakeNow,

  async busyIntervals(range) {
    guard("busyIntervals");
    const { blocks, reservations } = store();
    const booked = reservations.map(({ start, end }) => ({ start, end }));
    return overlapping([...blocks, ...booked], range);
  },

  async reservations(range) {
    guard("reservations");
    return overlapping(store().reservations, range);
  },

  async getReservation(id) {
    guard("getReservation");
    return store().reservations.find((reservation) => reservation.id === id) ?? null;
  },

  async createReservation(input) {
    guard("createReservation");
    return addFakeReservation(input);
  },

  async deleteReservation(id) {
    guard("deleteReservation");
    removeFakeReservation(id);
  },

  async sendEmail(message) {
    guard("sendEmail");
    store().emails.push(message);
  },

  async sendTelegram(text) {
    guard("sendTelegram");
    store().telegrams.push(text);
  },
};
