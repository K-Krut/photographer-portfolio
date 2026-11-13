import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  photographerReservationEmail,
  photographerReservationMessage,
  reservationCalendarFile,
  visitorReservationEmail,
  type ReservationMessageContext,
} from "./messages.ts";
import type { Reservation } from "./provider.ts";

const reservation: Reservation = {
  id: "event-42",
  createdAt: new Date("2026-10-12T08:00:00Z"),
  start: new Date("2026-10-15T08:00:00Z"),
  end: new Date("2026-10-15T10:00:00Z"),
  duration: 2,
  price: 700,
  locale: "en",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
  telegram: "@ada_l",
  sessionType: "portraits",
  comment: "Outdoor, please.\nNear the river.",
};

const context: ReservationMessageContext = {
  site: { name: "Viktor Rowan", email: "hello@example.com", url: "https://rowan.example" },
  currency: "PLN",
  sessionTypeName: "Portraits",
  cancelUrl: "https://rowan.example/en/booking/cancel?token=abc",
};

const polish: Reservation = { ...reservation, locale: "pl" };
const polishContext = { ...context, sessionTypeName: "Portrety", cancelUrl: "https://rowan.example/pl/booking/cancel?token=xyz" };

describe("visitor reservation e-mail", () => {
  test("goes to the visitor with the details, cancel link and contact e-mail in English", () => {
    const email = visitorReservationEmail(reservation, context);
    assert.equal(email.to, "ada@example.com");
    assert.equal(email.fromName, "Viktor Rowan");
    assert.equal(email.replyTo, undefined);
    assert.equal(email.subject, "Your photo session is reserved: Thursday, October 15, 2026, 10:00");
    for (const part of [
      "Hello Ada Lovelace,",
      "Day: Thursday, October 15, 2026",
      "Start: 10:00 (Warsaw time)",
      "Duration: 2 hours",
      "Price: 700 PLN",
      "Session type: Portraits",
      "I will contact you shortly",
      "until 24 hours before the start",
      context.cancelUrl,
      "hello@example.com",
    ]) {
      assert.ok(email.text.includes(part), part);
    }
    assert.ok(!email.text.includes("+48 123 456 789"));
  });

  test("is written in Polish for the Polish page", () => {
    const email = visitorReservationEmail(polish, polishContext);
    assert.equal(email.subject, "Sesja zdjęciowa zarezerwowana: czwartek, 15 października 2026, 10:00");
    for (const part of [
      "Dzień: czwartek, 15 października 2026",
      "Początek: 10:00 (czasu warszawskiego)",
      "Czas trwania: 2 godziny",
      "Cena: 700 PLN",
      "Rodzaj sesji: Portrety",
      "Wkrótce skontaktuję się",
      polishContext.cancelUrl,
    ]) {
      assert.ok(email.text.includes(part), part);
    }
  });

  test("leaves out the session type when none was chosen", () => {
    const email = visitorReservationEmail({ ...reservation, sessionType: undefined }, { ...context, sessionTypeName: undefined });
    assert.ok(!email.text.includes("Session type"));
  });

  test("attaches the calendar file", () => {
    const email = visitorReservationEmail(reservation, context);
    assert.deepEqual(email.attachment, reservationCalendarFile(reservation, context));
  });
});

describe("photographer reservation e-mail", () => {
  test("goes to the notify address with reply-to set to the visitor and all contacts", () => {
    const email = photographerReservationEmail(reservation, context, "viktor@example.com");
    assert.equal(email.to, "viktor@example.com");
    assert.equal(email.replyTo, "ada@example.com");
    assert.equal(email.attachment, undefined);
    assert.equal(email.subject, "New reservation: Ada Lovelace, Thursday, October 15, 2026, 10:00");
    for (const part of [
      "Day: Thursday, October 15, 2026",
      "Start: 10:00 (Warsaw time)",
      "Duration: 2 hours",
      "Price: 700 PLN",
      "Session type: Portraits",
      "Name: Ada Lovelace",
      "E-mail: ada@example.com",
      "Phone: +48 123 456 789",
      "Telegram: @ada_l",
      "Comment:\nOutdoor, please.\nNear the river.",
      "until the start of the session",
      context.cancelUrl,
    ]) {
      assert.ok(email.text.includes(part), part);
    }
  });

  test("is written in Polish for the Polish page", () => {
    const email = photographerReservationEmail(polish, polishContext, "viktor@example.com");
    assert.ok(email.subject.startsWith("Nowa rezerwacja: Ada Lovelace"));
    for (const part of ["Imię: Ada Lovelace", "Telefon: +48 123 456 789", "Komentarz:"]) {
      assert.ok(email.text.includes(part), part);
    }
  });

  test("omits the optional fields the visitor left empty", () => {
    const bare = { ...reservation, telegram: undefined, comment: undefined, sessionType: undefined };
    const { text } = photographerReservationMessage(bare, { ...context, sessionTypeName: undefined });
    assert.ok(!text.includes("Telegram"));
    assert.ok(!text.includes("Comment"));
    assert.ok(!text.includes("Session type"));
  });
});

describe("reservation calendar file", () => {
  test("describes the session in UTC with the reservation id as UID", () => {
    const file = reservationCalendarFile(reservation, context);
    assert.equal(file.filename, "session.ics");
    assert.match(file.contentType, /^text\/calendar;.*method=PUBLISH/);
    const lines = file.content.split("\r\n");
    assert.equal(lines.at(-1), "");
    for (const line of [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:event-42@rowan.example",
      "DTSTAMP:20261012T080000Z",
      "DTSTART:20261015T080000Z",
      "DTEND:20261015T100000Z",
      "SUMMARY:Photo session — Viktor Rowan",
      "END:VEVENT",
      "END:VCALENDAR",
    ]) {
      assert.ok(lines.includes(line), line);
    }
  });

  test("carries no visitor contacts", () => {
    const { content } = reservationCalendarFile(reservation, context);
    for (const value of ["Ada", "ada@example.com", "+48", "@ada_l", "river"]) {
      assert.ok(!content.includes(value), value);
    }
  });

  test("uses the page language for the summary and escapes special characters", () => {
    const file = reservationCalendarFile(polish, { ...context, site: { ...context.site, name: "Rowan; Studio, Kraków" } });
    assert.ok(file.content.includes("SUMMARY:Sesja zdjęciowa — Rowan\\; Studio\\, Kraków\r\n"));
  });
});

describe("reservation e-mail html", () => {
  const tricky: Reservation = { ...reservation, name: "Ada <b>& Co</b>", comment: "Line <one>\nLine \"two\"" };

  test("the visitor version carries the details and the visitor cancel link", () => {
    const { html } = visitorReservationEmail(reservation, context);
    assert.ok(html);
    for (const part of [
      '<meta name="color-scheme" content="dark">',
      "Hello Ada Lovelace,",
      "Thursday, October 15, 2026",
      "10:00–12:00 (Warsaw time)",
      "2 hours",
      "700 PLN",
      "Portraits",
      `href="${context.cancelUrl}"`,
      "Cancel the reservation",
      'href="mailto:hello@example.com"',
    ]) {
      assert.ok(html.includes(part), part);
    }
    assert.ok(!html.includes("+48 123 456 789"));
  });

  test("the photographer version links the visitor contacts and uses the photographer cancel link", () => {
    const { html } = photographerReservationEmail(polish, polishContext, "viktor@example.com");
    assert.ok(html);
    for (const part of [
      "Na stronie zarezerwowano nową sesję.",
      "10:00–12:00 (czasu warszawskiego)",
      'href="mailto:ada@example.com"',
      'href="tel:+48123456789"',
      'href="https://t.me/ada_l"',
      "Outdoor, please.<br>Near the river.",
      `href="${polishContext.cancelUrl}"`,
      "Anuluj rezerwację",
    ]) {
      assert.ok(html.includes(part), part);
    }
  });

  test("escapes the visitor name and comment", () => {
    const visitor = visitorReservationEmail(tricky, context).html!;
    const photographer = photographerReservationEmail(tricky, context, "viktor@example.com").html!;
    for (const html of [visitor, photographer]) {
      assert.ok(html.includes("Ada &lt;b&gt;&amp; Co&lt;/b&gt;"));
      assert.ok(!html.includes("<b>"));
    }
    assert.ok(photographer.includes("Line &lt;one&gt;<br>Line &quot;two&quot;"));
  });
});
