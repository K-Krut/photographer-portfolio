import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canCancel, lookUpCancellation } from "./cancellation.ts";
import type { Reservation } from "./provider.ts";
import { signCancelToken } from "./tokens.ts";

const secret = "test-secret";
const start = new Date("2026-10-15T08:00:00Z");
const hours = (count: number) => new Date(start.getTime() - count * 60 * 60 * 1000);

const reservation: Reservation = {
  id: "event-1",
  createdAt: new Date("2026-10-12T08:00:00Z"),
  start,
  end: new Date("2026-10-15T10:00:00Z"),
  duration: 2,
  price: 700,
  locale: "en",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
};

function provider(now: Date, stored: Reservation | null = reservation) {
  const calls: string[] = [];
  return {
    calls,
    now: () => now,
    getReservation: async (id: string) => {
      calls.push(id);
      return stored && stored.id === id ? stored : null;
    },
  };
}

describe("cancel deadline", () => {
  test("visitor may cancel until 24 hours before the start", () => {
    assert.equal(canCancel(start, "visitor", hours(72)), true);
    assert.equal(canCancel(start, "visitor", hours(24.01)), true);
    assert.equal(canCancel(start, "visitor", hours(24)), false);
    assert.equal(canCancel(start, "visitor", hours(20)), false);
  });

  test("photographer may cancel until the start", () => {
    assert.equal(canCancel(start, "photographer", hours(2)), true);
    assert.equal(canCancel(start, "photographer", hours(0.01)), true);
    assert.equal(canCancel(start, "photographer", start), false);
    assert.equal(canCancel(start, "photographer", hours(-1)), false);
  });
});

describe("cancel lookup", () => {
  test("rejects tampered, foreign and missing tokens without reading the calendar", async () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, secret);
    for (const value of [`${token}x`, signCancelToken({ id: "event-1", kind: "visitor" }, "other"), "", undefined, 42]) {
      const stub = provider(hours(72));
      assert.deepEqual(await lookUpCancellation(value, secret, stub), { status: "invalid" });
      assert.deepEqual(stub.calls, []);
    }
  });

  test("reports a reservation that is gone as already cancelled", async () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, secret);
    assert.deepEqual(await lookUpCancellation(token, secret, provider(hours(72), null)), {
      status: "alreadyCancelled",
    });
  });

  test("opens a visitor link in time and closes it within 24 hours", async () => {
    const token = signCancelToken({ id: "event-1", kind: "visitor" }, secret);
    assert.deepEqual(await lookUpCancellation(token, secret, provider(hours(72))), {
      status: "open",
      kind: "visitor",
      reservation,
    });
    assert.deepEqual(await lookUpCancellation(token, secret, provider(hours(20))), {
      status: "tooLate",
      kind: "visitor",
      reservation,
    });
  });

  test("opens a photographer link until the start", async () => {
    const token = signCancelToken({ id: "event-1", kind: "photographer" }, secret);
    assert.equal((await lookUpCancellation(token, secret, provider(hours(2)))).status, "open");
    assert.equal((await lookUpCancellation(token, secret, provider(hours(-0.5)))).status, "tooLate");
  });
});
