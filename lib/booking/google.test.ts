import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildEvent,
  eventBusyInterval,
  formatDescription,
  mailOptions,
  markerProperty,
  readReservation,
  type CalendarEvent,
} from "./google.ts";
import type { ReservationInput } from "./provider.ts";
import { dayRange, warsawDate } from "./slots.ts";

function at(day: string, hour: number): Date {
  const date = warsawDate(day, hour * 60);
  assert.ok(date, `${day} ${hour}:00 exists`);
  return date;
}

const input: ReservationInput = {
  start: at("2026-10-20", 12),
  end: at("2026-10-20", 14),
  duration: 2,
  price: 700,
  locale: "pl",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
  telegram: "@ada",
  sessionType: "business",
  comment: "Outdoor, near the river",
};

const minimal: ReservationInput = {
  start: at("2026-10-20", 12),
  end: at("2026-10-20", 13),
  duration: 1,
  price: 400,
  locale: "en",
  name: "Bob",
  email: "bob@example.com",
  phone: "123456789",
};

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    status: "confirmed",
    created: "2026-10-12T09:00:00.000Z",
    ...buildEvent(input),
    ...overrides,
  };
}

describe("formatDescription", () => {
  test("lays out contacts, session, price, language and the comment", () => {
    assert.equal(
      formatDescription(input),
      [
        "Name: Ada Lovelace",
        "E-mail: ada@example.com",
        "Phone: +48 123 456 789",
        "Telegram: @ada",
        "Session: business",
        "Duration: 2 h",
        "Price: 700 PLN",
        "Language: pl",
        "",
        "Comment:",
        "Outdoor, near the river",
      ].join("\n"),
    );
  });

  test("skips the optional lines when they are absent", () => {
    assert.equal(
      formatDescription(minimal),
      [
        "Name: Bob",
        "E-mail: bob@example.com",
        "Phone: 123456789",
        "Session: —",
        "Duration: 1 h",
        "Price: 400 PLN",
        "Language: en",
      ].join("\n"),
    );
  });
});

describe("buildEvent", () => {
  test("titles the event with the name and the session type", () => {
    assert.equal(buildEvent(input).summary, "Ada Lovelace — business");
    assert.equal(buildEvent(minimal).summary, "Bob — Session");
  });

  test("sets the start and end as instants in the Warsaw time zone", () => {
    const body = buildEvent(input);
    assert.deepEqual(body.start, { dateTime: "2026-10-20T10:00:00.000Z", timeZone: "Europe/Warsaw" });
    assert.deepEqual(body.end, { dateTime: "2026-10-20T12:00:00.000Z", timeZone: "Europe/Warsaw" });
  });

  test("keeps the structured values as private extended properties with the site marker", () => {
    assert.deepEqual(buildEvent(input).extendedProperties, {
      private: {
        [markerProperty]: "1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+48 123 456 789",
        locale: "pl",
        duration: "2",
        price: "700",
        telegram: "@ada",
        sessionType: "business",
        comment: "Outdoor, near the river",
      },
    });
    const properties = buildEvent(minimal).extendedProperties?.private ?? {};
    assert.equal("telegram" in properties, false);
    assert.equal("sessionType" in properties, false);
    assert.equal("comment" in properties, false);
  });

  test("caps the comment property at the Google limit but keeps the full text in the description", () => {
    const long = { ...minimal, comment: "x".repeat(2000) };
    const body = buildEvent(long);
    assert.equal(body.extendedProperties?.private?.comment?.length, 1024);
    assert.ok(body.description?.endsWith("x".repeat(2000)));
  });
});

describe("eventBusyInterval", () => {
  test("maps a timed event to its interval", () => {
    assert.deepEqual(eventBusyInterval(event()), { start: at("2026-10-20", 12), end: at("2026-10-20", 14) });
  });

  test("treats an all-day event as the whole Warsaw day", () => {
    assert.deepEqual(
      eventBusyInterval(event({ start: { date: "2026-10-25" }, end: { date: "2026-10-26" } })),
      dayRange("2026-10-25"),
    );
    assert.deepEqual(
      eventBusyInterval(event({ start: { date: "2026-10-24" }, end: { date: "2026-10-27" } })),
      { start: dayRange("2026-10-24").start, end: dayRange("2026-10-26").end },
    );
  });

  test("skips cancelled events", () => {
    assert.equal(eventBusyInterval(event({ status: "cancelled" })), null);
  });

  test("includes hand-added events as well as site-created ones", () => {
    const handAdded = event({
      summary: "Dentist",
      description: undefined,
      extendedProperties: undefined,
      start: { dateTime: "2026-10-21T10:00:00+02:00" },
      end: { dateTime: "2026-10-21T11:30:00+02:00" },
    });
    assert.deepEqual(eventBusyInterval(handAdded), {
      start: new Date("2026-10-21T08:00:00.000Z"),
      end: new Date("2026-10-21T09:30:00.000Z"),
    });
    assert.ok(eventBusyInterval(event()));
  });

  test("returns null when the event has no usable times", () => {
    assert.equal(eventBusyInterval(event({ start: undefined })), null);
    assert.equal(eventBusyInterval(event({ end: { dateTime: "not a date" } })), null);
  });
});

describe("readReservation", () => {
  test("round-trips a reservation through an event", () => {
    const reservation = readReservation(event());
    assert.deepEqual(reservation, {
      ...input,
      id: "evt-1",
      createdAt: new Date("2026-10-12T09:00:00.000Z"),
    });
  });

  test("ignores events the site did not create", () => {
    assert.equal(readReservation(event({ extendedProperties: { private: {} } })), null);
    assert.equal(readReservation(event({ extendedProperties: undefined })), null);
  });

  test("treats a cancelled event as gone", () => {
    assert.equal(readReservation(event({ status: "cancelled" })), null);
  });

  test("treats an all-day event as the whole Warsaw day", () => {
    const reservation = readReservation(
      event({ start: { date: "2026-10-25" }, end: { date: "2026-10-26" } }),
    );
    assert.ok(reservation);
    assert.deepEqual({ start: reservation.start, end: reservation.end }, dayRange("2026-10-25"));
  });

  test("falls back to the interval length, the default locale and empty contacts", () => {
    const reservation = readReservation(
      event({
        extendedProperties: { private: { [markerProperty]: "1", locale: "de", duration: "9" } },
      }),
    );
    assert.ok(reservation);
    assert.equal(reservation.duration, 2);
    assert.equal(reservation.locale, "en");
    assert.equal(reservation.price, 0);
    assert.equal(reservation.name, "");
    assert.equal(reservation.telegram, undefined);
  });

  test("returns null when the event has no usable times", () => {
    assert.equal(readReservation(event({ start: undefined })), null);
    assert.equal(readReservation(event({ end: { dateTime: "not a date" } })), null);
  });
});

describe("mailOptions", () => {
  test("sends from the Gmail address under the site name with reply-to and the attachment", () => {
    const attachment = { filename: "session.ics", contentType: "text/calendar; method=PUBLISH", content: "ICS" };
    assert.deepEqual(
      mailOptions("viktor@gmail.com", {
        fromName: "Viktor Rowan",
        to: "viktor@example.com",
        subject: "New reservation",
        text: "Body",
        html: "<p>Body</p>",
        replyTo: "ada@example.com",
        attachment,
      }),
      {
        from: { name: "Viktor Rowan", address: "viktor@gmail.com" },
        to: "viktor@example.com",
        subject: "New reservation",
        text: "Body",
        html: "<p>Body</p>",
        replyTo: "ada@example.com",
        attachments: [attachment],
      },
    );
  });

  test("leaves out the optional parts", () => {
    assert.deepEqual(mailOptions("viktor@gmail.com", { to: "a@example.com", subject: "S", text: "T" }), {
      from: "viktor@gmail.com",
      to: "a@example.com",
      subject: "S",
      text: "T",
    });
  });
});
