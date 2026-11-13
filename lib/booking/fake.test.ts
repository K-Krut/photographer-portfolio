import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { defaultWindow } from "./config.ts";
import {
  addFakeBlock,
  addFakeReservation,
  fakeBookingProvider as fake,
  fakeBookingState,
  fakeNow,
  failNextFakeCalls,
  removeFakeReservation,
  resetFakeBooking,
} from "./fake.ts";
import { getBookingProvider, type ReservationInput } from "./provider.ts";
import {
  dayRange,
  dayStarts,
  horizonDay,
  monthDays,
  monthRange,
  warsawDate,
  warsawTime,
  type Interval,
} from "./slots.ts";

const monday = "2026-10-12";

function at(day: string, hour: number): Date {
  const date = warsawDate(day, hour * 60);
  assert.ok(date, `${day} ${hour}:00 exists`);
  return date;
}

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function daysOf(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

async function starts(day: string, duration: 1 | 2 | 3 = 1): Promise<number[]> {
  const busy = await fake.busyIntervals(dayRange(day));
  const availability = { window: defaultWindow, busy, now: fake.now() };
  return dayStarts(day, duration, availability).map((start) => warsawTime(start).minutes / 60);
}

function input(day: string, hour: number, duration: 1 | 2 | 3 = 1): ReservationInput {
  return {
    start: at(day, hour),
    end: at(day, hour + duration),
    duration,
    price: 400,
    locale: "en",
    name: "Ada",
    email: "ada@example.com",
    phone: "+48 123 456 789",
  };
}

beforeEach(() => resetFakeBooking());

describe("provider selection", () => {
  const shared = { window: defaultWindow, tokenSecret: "s", notifyEmail: "p@example.com" };

  test("the fake is returned for the fake configuration", () => {
    assert.equal(getBookingProvider({ provider: "fake", ...shared }), fake);
  });

  test("the google provider is returned for the google configuration", () => {
    const provider = getBookingProvider({
      provider: "google",
      ...shared,
      google: { clientEmail: "a", privateKey: "b" },
      bookingsCalendarId: "c",
      blockingCalendarIds: ["d"],
      gmail: { address: "e", appPassword: "f" },
    });
    assert.notEqual(provider, fake);
    assert.ok(Math.abs(provider.now().getTime() - Date.now()) < 1000);
  });
});

describe("fixed clock", () => {
  test("now is Monday 2026-10-12 10:00 Warsaw", () => {
    assert.equal(fake.now(), fakeNow);
    assert.deepEqual(warsawTime(fake.now()), { day: monday, minutes: 600 });
    assert.equal(weekday(monday), 1);
  });
});

describe("seeded weekly pattern", () => {
  test("every day except Sundays is selectable from 24 hours ahead", async () => {
    for (const month of ["2026-10", "2026-11"]) {
      const busy = await fake.busyIntervals(monthRange(month));
      const days = monthDays(month, 1, { window: defaultWindow, busy, now: fake.now() });
      assert.deepEqual(
        days,
        daysOf(month).filter((day) => day > monday && weekday(day) !== 0),
      );
    }
  });

  test("Mondays and Wednesdays offer 17:00 through 21:00, other days 08:00 through 21:00", async () => {
    assert.deepEqual(await starts("2026-10-19"), range(17, 21));
    assert.deepEqual(await starts("2026-10-21"), range(17, 21));
    assert.deepEqual(await starts("2026-10-20"), range(8, 21));
    assert.deepEqual(await starts("2026-10-24"), range(8, 21));
    assert.deepEqual(await starts("2026-10-18"), []);
  });

  test("the pattern covers the whole horizon and the week before today", async () => {
    const last = horizonDay(fake.now());
    assert.equal(last, "2027-10-12");
    assert.equal(weekday(last), 2);
    assert.deepEqual(await starts(last), range(8, 21));
    assert.deepEqual(await starts("2027-10-11"), range(17, 21));
    assert.deepEqual(await starts("2027-10-10"), []);
    const before = await fake.busyIntervals(dayRange("2026-10-05"));
    assert.equal(before.length, 1);
  });

  test("busy intervals outside the asked range are not returned", async () => {
    const busy = await fake.busyIntervals(dayRange("2026-10-20"));
    assert.deepEqual(busy, []);
  });
});

describe("reservations", () => {
  test("a created reservation can be read back, blocks the time and is listed in its range", async () => {
    const created = await fake.createReservation(input("2026-10-22", 10, 2));
    assert.equal(created.id, "fake-1");
    assert.equal(created.name, "Ada");
    assert.deepEqual(await fake.getReservation(created.id), created);
    assert.deepEqual(await fake.reservations(dayRange("2026-10-22")), [created]);
    assert.deepEqual(await fake.reservations(dayRange("2026-10-23")), []);
    assert.deepEqual(await starts("2026-10-22", 2), [8, ...range(12, 20)]);
  });

  test("successive reservations get distinct ids and increasing creation times", async () => {
    const first = await fake.createReservation(input("2026-10-22", 10));
    const second = await fake.createReservation(input("2026-10-22", 10));
    assert.notEqual(first.id, second.id);
    assert.ok(second.createdAt > first.createdAt);
    assert.ok(first.createdAt >= fakeNow);
  });

  test("deleting removes the reservation and deleting again is a no-op", async () => {
    const created = await fake.createReservation(input("2026-10-22", 10));
    await fake.deleteReservation(created.id);
    assert.equal(await fake.getReservation(created.id), null);
    assert.deepEqual(await starts("2026-10-22"), range(8, 21));
    await fake.deleteReservation(created.id);
    await fake.deleteReservation("never-existed");
    assert.deepEqual(await fake.reservations(dayRange("2026-10-22")), []);
  });

  test("unknown ids read as null", async () => {
    assert.equal(await fake.getReservation("nope"), null);
  });
});

describe("test controls", () => {
  test("a block added by hand hides starts like a reservation", async () => {
    addFakeBlock({ start: at("2026-10-20", 8), end: new Date(at("2026-10-20", 18).getTime() + 30 * 60_000) });
    assert.deepEqual(await starts("2026-10-20"), [19, 20, 21]);
  });

  test("reservations added and removed directly skip the provider", async () => {
    failNextFakeCalls("createReservation");
    const added = addFakeReservation(input("2026-10-22", 10));
    assert.deepEqual(await fake.reservations(dayRange("2026-10-22")), [added]);
    removeFakeReservation(added.id);
    assert.deepEqual(await fake.reservations(dayRange("2026-10-22")), []);
    await assert.rejects(fake.createReservation(input("2026-10-22", 10)));
  });

  test("reset returns the store to the seeded state", async () => {
    await fake.createReservation(input("2026-10-22", 10));
    addFakeBlock(dayRange("2026-10-20"));
    await fake.sendEmail({ to: "a@example.com", subject: "s", text: "t" });
    await fake.sendTelegram("hello");
    failNextFakeCalls("busyIntervals");
    resetFakeBooking();
    const state = fakeBookingState();
    assert.deepEqual(state.reservations, []);
    assert.deepEqual(state.emails, []);
    assert.deepEqual(state.telegrams, []);
    assert.deepEqual(await starts("2026-10-20"), range(8, 21));
  });

  test("the state exposes the fixed clock and the seeded blocks", () => {
    const state = fakeBookingState();
    assert.equal(state.now, fakeNow);
    const sunday: Interval = dayRange("2026-10-18");
    assert.ok(state.blocks.some((b) => b.start.getTime() === sunday.start.getTime() && b.end.getTime() === sunday.end.getTime()));
  });
});

describe("message recording", () => {
  test("e-mails and Telegram messages are recorded in order", async () => {
    const first = { to: "visitor@example.com", subject: "Confirmed", text: "See you" };
    const second = { to: "p@example.com", subject: "New", text: "Ada booked", replyTo: "ada@example.com" };
    await fake.sendEmail(first);
    await fake.sendEmail(second);
    await fake.sendTelegram("Ada booked");
    assert.deepEqual(fakeBookingState().emails, [first, second]);
    assert.deepEqual(fakeBookingState().telegrams, ["Ada booked"]);
  });
});

describe("fail switches", () => {
  test("an armed operation fails once and then works again", async () => {
    failNextFakeCalls("busyIntervals");
    await assert.rejects(fake.busyIntervals(dayRange("2026-10-20")));
    assert.deepEqual(await fake.busyIntervals(dayRange("2026-10-20")), []);
  });

  test("a switch can be armed for several calls", async () => {
    failNextFakeCalls("sendEmail", 2);
    const message = { to: "a@example.com", subject: "s", text: "t" };
    await assert.rejects(fake.sendEmail(message));
    await assert.rejects(fake.sendEmail(message));
    await fake.sendEmail(message);
    assert.deepEqual(fakeBookingState().emails, [message]);
  });

  test("each operation has its own switch", async () => {
    failNextFakeCalls("sendTelegram");
    failNextFakeCalls("createReservation");
    await fake.sendEmail({ to: "a@example.com", subject: "s", text: "t" });
    await assert.rejects(fake.sendTelegram("x"));
    await assert.rejects(fake.createReservation(input("2026-10-22", 10)));
    assert.deepEqual(await fake.reservations(dayRange("2026-10-22")), []);
    assert.deepEqual(fakeBookingState().telegrams, []);
    assert.equal(fakeBookingState().emails.length, 1);
  });

  test("the other operations can be armed too", async () => {
    failNextFakeCalls("reservations");
    failNextFakeCalls("getReservation");
    failNextFakeCalls("deleteReservation");
    await assert.rejects(fake.reservations(dayRange("2026-10-22")));
    await assert.rejects(fake.getReservation("x"));
    await assert.rejects(fake.deleteReservation("x"));
  });
});
