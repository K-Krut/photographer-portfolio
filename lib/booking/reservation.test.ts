import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createReservationLimiter,
  losesConflict,
  normaliseTelegram,
  parseReservation,
} from "./reservation.ts";

const now = Date.parse("2026-10-12T08:00:00Z");
const slugs = ["portrait", "couple"];

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    start: "2026-10-14T16:00:00.000Z",
    duration: 2,
    locale: "en",
    name: "  Anna Nowak ",
    email: "anna@example.com",
    phone: "+48 (12) 345-67-89",
    telegram: "anna_nowak",
    sessionType: "portrait",
    comment: "Outdoor, please",
    website: "",
    elapsedMs: 10_000,
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}) {
  return parseReservation(body(overrides), slugs);
}

describe("parseReservation", () => {
  test("accepts a complete request and normalises it", () => {
    const result = parse();
    assert.equal(result.kind, "valid");
    if (result.kind !== "valid") return;
    assert.deepEqual(result.input, {
      start: new Date("2026-10-14T16:00:00.000Z"),
      end: new Date("2026-10-14T18:00:00.000Z"),
      duration: 2,
      locale: "en",
      name: "Anna Nowak",
      email: "anna@example.com",
      phone: "+48 (12) 345-67-89",
      telegram: "@anna_nowak",
      sessionType: "portrait",
      comment: "Outdoor, please",
    });
  });

  test("treats empty optional fields as absent", () => {
    const result = parse({ telegram: "", sessionType: "", comment: "  ", website: undefined });
    assert.equal(result.kind, "valid");
    if (result.kind !== "valid") return;
    assert.equal("telegram" in result.input, false);
    assert.equal("sessionType" in result.input, false);
    assert.equal("comment" in result.input, false);
  });

  test("reports keyed errors for every offending field", () => {
    const result = parse({
      name: "   ",
      email: "anna@example",
      phone: "12 34 56",
      telegram: "@ab",
      sessionType: "weddings",
      comment: "x".repeat(1001),
    });
    assert.deepEqual(result, {
      kind: "invalid",
      fields: {
        name: "name",
        email: "emailInvalid",
        phone: "phoneInvalid",
        telegram: "telegram",
        sessionType: "sessionType",
        comment: "comment",
      },
    });
  });

  test("validates the name", () => {
    for (const name of ["x".repeat(200), "Jo", "Łukasz Żółć", "O'Brien-Smith", "Anna 2"]) {
      assert.equal(parse({ name }).kind, "valid", name);
    }
    for (const name of ["", "   ", undefined, 42]) {
      assert.deepEqual(parse({ name }), { kind: "invalid", fields: { name: "name" } }, String(name));
    }
    for (const name of ["x".repeat(201), "A", "12345", "A1", "--", "1 2 3"]) {
      assert.deepEqual(parse({ name }), { kind: "invalid", fields: { name: "nameInvalid" } }, name);
    }
  });

  test("validates the e-mail shape", () => {
    for (const email of ["a@b.co", "first.last+tag@sub.example.pl", "o'neil@my-site.com", "anna@żółw.pl"]) {
      assert.equal(parse({ email }).kind, "valid", email);
    }
    assert.deepEqual(parse({ email: "  " }), { kind: "invalid", fields: { email: "email" } });
    for (const email of [
      "plain",
      "a@b",
      "a b@c.de",
      "@b.de",
      "a@.",
      "a@b.c",
      "a@b.c0",
      "a..b@c.de",
      ".a@c.de",
      "a.@c.de",
      "a@c..de",
      "a@.c.de",
      "a@c.de.",
      "a@-c.de",
      "a@c-.de",
      "a@@c.de",
      "a@b@c.de",
      `${"a".repeat(250)}@b.de`,
    ]) {
      assert.deepEqual(parse({ email }), { kind: "invalid", fields: { email: "emailInvalid" } }, email);
    }
  });

  test("validates the phone", () => {
    for (const phone of ["1234567", "+48 123 456 789", "(012) 345-6789", "+123456789012345"]) {
      assert.equal(parse({ phone }).kind, "valid", phone);
    }
    assert.deepEqual(parse({ phone: "" }), { kind: "invalid", fields: { phone: "phone" } });
    for (const phone of [
      "123456",
      "+48 12-34",
      "123 456 789 ext",
      "123.456.789",
      "phone",
      "48+123456789",
      "++48123456789",
      "+48 123 +456 789",
      "1234567890123456",
    ]) {
      assert.deepEqual(parse({ phone }), { kind: "invalid", fields: { phone: "phoneInvalid" } }, phone);
    }
  });

  test("validates the Telegram username", () => {
    for (const telegram of ["ada_photo", "@Ada55", "a1_b2"]) {
      assert.equal(parse({ telegram }).kind, "valid", telegram);
    }
    for (const telegram of ["ada", "5anna", "_anna", "anna_", "@anna_", "anna.n", 7]) {
      assert.deepEqual(
        parse({ telegram }),
        { kind: "invalid", fields: { telegram: "telegram" } },
        String(telegram),
      );
    }
  });

  test("validates the session type and comment", () => {
    assert.equal(parse({ sessionType: "couple" }).kind, "valid");
    assert.equal(parse({ sessionType: 3 }).kind, "invalid");
    assert.equal(parse({ comment: "x".repeat(1000) }).kind, "valid");
    assert.equal(parse({ comment: ["x"] }).kind, "invalid");
  });

  test("rejects a malformed body as failed", () => {
    for (const value of [null, "text", [], 42]) {
      assert.deepEqual(parseReservation(value, slugs), { kind: "failed" });
    }
  });

  test("rejects a bad start, duration or locale as failed", () => {
    for (const overrides of [
      { start: "tomorrow" },
      { start: undefined },
      { start: Date.parse("2026-10-14T16:00:00Z") },
      { start: "2026-10-14T16:30:00Z" },
      { start: "2026-10-14T16:00:30Z" },
      { duration: 0 },
      { duration: 4 },
      { duration: "1" },
      { locale: "de" },
      { locale: undefined },
    ]) {
      assert.deepEqual(parse(overrides), { kind: "failed" }, JSON.stringify(overrides));
    }
  });

  test("accepts any whole Warsaw hour, including across DST", () => {
    assert.equal(parse({ start: "2026-10-25T01:00:00Z" }).kind, "valid");
    assert.equal(parse({ start: "2026-10-25T02:00:00+01:00" }).kind, "valid");
  });

  test("rejects a filled honeypot as failed", () => {
    assert.deepEqual(parse({ website: "http://spam.example" }), { kind: "failed" });
    assert.deepEqual(parse({ website: 1 }), { kind: "failed" });
  });

  test("rejects a submission sooner than three seconds after the form was shown", () => {
    assert.deepEqual(parse({ elapsedMs: 0 }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: 2999 }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: -60_000 }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: Number.NaN }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: Number.POSITIVE_INFINITY }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: undefined }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: "5000" }), { kind: "failed" });
    assert.deepEqual(parse({ elapsedMs: undefined, shownAt: now - 10_000 }), { kind: "failed" });
    assert.equal(parse({ elapsedMs: 3000 }).kind, "valid");
    assert.equal(parse({ elapsedMs: 3_600_000 }).kind, "valid");
  });

  test("the honeypot wins over field errors", () => {
    assert.deepEqual(parse({ website: "x", name: "" }), { kind: "failed" });
  });
});

describe("normaliseTelegram", () => {
  test("normalises handles with or without @ to one form", () => {
    assert.equal(normaliseTelegram("anna_nowak"), "@anna_nowak");
    assert.equal(normaliseTelegram("@anna_nowak"), "@anna_nowak");
    assert.equal(normaliseTelegram("  @Anna5 "), "@Anna5");
    assert.equal(normaliseTelegram("a".repeat(32)), `@${"a".repeat(32)}`);
  });

  test("rejects handles outside the allowed shape", () => {
    for (const value of [
      "",
      "@",
      "abcd",
      "@@anna_nowak",
      "anna nowak",
      "anna-nowak",
      "a".repeat(33),
      "t.me/anna",
      "1anna",
      "_anna",
      "anna_",
      "anną_nowak",
    ]) {
      assert.equal(normaliseTelegram(value), null, value);
    }
  });
});

describe("losesConflict", () => {
  const start = new Date("2026-10-14T16:00:00Z");
  const end = new Date("2026-10-14T18:00:00Z");
  const created = new Date("2026-10-12T08:00:00Z");

  function reservation(id: string, createdMs: number, from = start, to = end) {
    return { id, start: from, end: to, createdAt: new Date(created.getTime() + createdMs) };
  }

  test("keeps a reservation that is alone", () => {
    const ours = reservation("b", 0);
    assert.equal(losesConflict(ours, [ours]), false);
  });

  test("loses to an earlier overlapping reservation", () => {
    const ours = reservation("b", 1000);
    const earlier = reservation("z", 0, new Date("2026-10-14T17:00:00Z"), new Date("2026-10-14T18:00:00Z"));
    assert.equal(losesConflict(ours, [ours, earlier]), true);
    assert.equal(losesConflict(earlier, [ours, earlier]), false);
  });

  test("breaks a createdAt tie by id so exactly one side loses", () => {
    const first = reservation("a", 0);
    const second = reservation("b", 0);
    assert.equal(losesConflict(first, [first, second]), false);
    assert.equal(losesConflict(second, [first, second]), true);
  });

  test("ignores reservations that only touch the interval", () => {
    const ours = reservation("b", 1000);
    const before = reservation("a", 0, new Date("2026-10-14T15:00:00Z"), start);
    const after = reservation("c", 0, end, new Date("2026-10-14T19:00:00Z"));
    assert.equal(losesConflict(ours, [before, ours, after]), false);
  });
});

describe("reservation limiter", () => {
  const hour = 60 * 60 * 1000;

  test("allows five reservations per hour per key", () => {
    const limiter = createReservationLimiter();
    for (let index = 0; index < 5; index++) {
      assert.equal(limiter.isOverLimit("1.2.3.4", now + index), false);
      limiter.record("1.2.3.4", now + index);
    }
    assert.equal(limiter.isOverLimit("1.2.3.4", now + 10), true);
    assert.equal(limiter.isOverLimit("5.6.7.8", now + 10), false);
    assert.equal(limiter.isOverLimit("1.2.3.4", now + hour), false);
  });

  test("reset clears the history", () => {
    const limiter = createReservationLimiter({ count: 1, windowMs: hour });
    limiter.record("ip", now);
    assert.equal(limiter.isOverLimit("ip", now), true);
    limiter.reset();
    assert.equal(limiter.isOverLimit("ip", now), false);
  });
});
