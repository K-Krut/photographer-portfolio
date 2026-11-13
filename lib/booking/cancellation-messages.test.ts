import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  photographerCancellationEmail,
  visitorCancellationEmail,
  type CancellationMessageContext,
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
  comment: "Outdoor, please.",
};

const context: CancellationMessageContext = {
  site: { name: "Viktor Rowan", email: "hello@example.com", url: "https://rowan.example/" },
  currency: "PLN",
  sessionTypeName: "Portraits",
};

function assertIncludes(text: string, parts: string[]) {
  for (const part of parts) assert.ok(text.includes(part), part);
}

describe("visitor cancels", () => {
  test("the visitor gets a short confirmation", () => {
    const email = visitorCancellationEmail(reservation, "visitor", context);
    assert.equal(email.to, "ada@example.com");
    assert.equal(email.fromName, "Viktor Rowan");
    assert.equal(email.subject, "Your photo session is cancelled: Thursday, October 15, 2026, 10:00");
    assertIncludes(email.text, [
      "Hello Ada Lovelace,",
      "cancelled as you requested",
      "Day: Thursday, October 15, 2026",
      "Start: 10:00 (Warsaw time)",
      "hello@example.com",
    ]);
    assert.ok(!email.text.includes("I am sorry"));
    assert.ok(!email.text.includes("/booking"));
  });

  test("the photographer learns which reservation and who cancelled, with reply-to the visitor", () => {
    const email = photographerCancellationEmail(reservation, "visitor", context, "viktor@example.com");
    assert.equal(email.to, "viktor@example.com");
    assert.equal(email.replyTo, "ada@example.com");
    assert.equal(
      email.subject,
      "Reservation cancelled by the client: Ada Lovelace, Thursday, October 15, 2026, 10:00",
    );
    assertIncludes(email.text, [
      "The client has cancelled this reservation",
      "Day: Thursday, October 15, 2026",
      "Session type: Portraits",
      "Name: Ada Lovelace",
      "E-mail: ada@example.com",
      "Phone: +48 123 456 789",
      "Telegram: @ada_l",
    ]);
  });
});

describe("photographer cancels", () => {
  test("the visitor gets an apology, the contact e-mail and a link back to booking", () => {
    const email = visitorCancellationEmail(reservation, "photographer", context);
    assert.equal(email.to, "ada@example.com");
    assertIncludes(email.text, [
      "I have to cancel your photo session",
      "I am sorry",
      "hello@example.com",
      "https://rowan.example/en/booking",
    ]);
  });

  test("the photographer gets a short confirmation", () => {
    const email = photographerCancellationEmail(reservation, "photographer", context, "viktor@example.com");
    assert.equal(email.to, "viktor@example.com");
    assert.equal(email.subject, "You cancelled the reservation: Ada Lovelace, Thursday, October 15, 2026, 10:00");
    assertIncludes(email.text, ["You have cancelled this reservation", "Name: Ada Lovelace"]);
  });

  test("a Polish reservation produces Polish messages and a Polish booking link", () => {
    const polish = { ...reservation, locale: "pl" as const };
    const visitor = visitorCancellationEmail(polish, "photographer", context);
    assert.ok(visitor.subject.startsWith("Sesja zdjęciowa anulowana: czwartek, 15 października 2026"));
    assertIncludes(visitor.text, ["Przepraszam", "https://rowan.example/pl/booking"]);
    const photographer = photographerCancellationEmail(polish, "visitor", context, "viktor@example.com");
    assert.ok(photographer.subject.startsWith("Klient anulował rezerwację: Ada Lovelace"));
    assertIncludes(photographer.text, ["Imię: Ada Lovelace", "Telefon: +48 123 456 789"]);
  });
});

describe("cancellation e-mail html", () => {
  test("each message carries the session details and only the right link", () => {
    const byVisitor = visitorCancellationEmail(reservation, "visitor", context).html!;
    assertIncludes(byVisitor, ["Hello Ada Lovelace,", "cancelled as you requested", "10:00–12:00 (Warsaw time)"]);
    assert.ok(!byVisitor.includes("/booking"));

    const byPhotographer = visitorCancellationEmail(reservation, "photographer", context).html!;
    assertIncludes(byPhotographer, ["I am sorry", 'href="https://rowan.example/en/booking"', "Book a session"]);

    for (const kind of ["visitor", "photographer"] as const) {
      const html = photographerCancellationEmail(reservation, kind, context, "viktor@example.com").html!;
      assertIncludes(html, ["Thursday, October 15, 2026", "Ada Lovelace", 'href="tel:+48123456789"']);
      assert.ok(!html.includes("/booking/cancel"));
      assert.ok(!html.includes("Outdoor"));
    }
  });

  test("escapes the visitor name", () => {
    const tricky = { ...reservation, name: "<script>Ada</script>" };
    for (const html of [
      visitorCancellationEmail(tricky, "photographer", context).html!,
      photographerCancellationEmail(tricky, "visitor", context, "viktor@example.com").html!,
    ]) {
      assert.ok(html.includes("&lt;script&gt;Ada&lt;/script&gt;"));
      assert.ok(!html.includes("<script>"));
    }
  });
});
