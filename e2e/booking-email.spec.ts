import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { minimumFillMs } from "../lib/booking/reservation";
import { currency, getCategories, site, texts } from "../lib/content";
import { sessionPrice } from "../lib/booking/price";
import { chooseDay, daysLoaded, fakeBooking, openBooking, picker } from "./helpers";

type Attachment = { filename: string; contentType: string; content: string };

type Email = {
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: Attachment;
};

type FakeState = { reservations: { id: string; email: string }[]; emails: Email[] };

const sessionType = getCategories()[0];

const visitor = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
  telegram: "ada_photo",
  sessionType: sessionType.slug,
  comment: "Golden hour by the river, please.",
};

const bookings = [
  {
    locale: "en" as const,
    start: "2026-10-20T16:00:00.000Z",
    duration: 2,
    dtstart: "20261020T160000Z",
    dtend: "20261020T180000Z",
    visitorSubject: "Your photo session is reserved: Tuesday, October 20, 2026, 18:00",
    photographerSubject: "New reservation: Ada Lovelace, Tuesday, October 20, 2026, 18:00",
    details: [
      "Day: Tuesday, October 20, 2026",
      "Start: 18:00 (Warsaw time)",
      "Duration: 2 hours",
      `Price: ${sessionPrice(2)} ${currency}`,
      `Session type: ${sessionType.name.en}`,
    ],
    contactNote: "I will contact you shortly to confirm the details.",
    questions: `If you have any questions, write to ${site.email}.`,
    contacts: [
      "Name: Ada Lovelace",
      "E-mail: ada@example.com",
      "Phone: +48 123 456 789",
      "Telegram: @ada_photo",
      "Comment: Golden hour by the river, please.",
    ],
    summary: `SUMMARY:Photo session — ${site.name}`,
  },
  {
    locale: "pl" as const,
    start: "2026-10-22T08:00:00.000Z",
    duration: 1,
    dtstart: "20261022T080000Z",
    dtend: "20261022T090000Z",
    visitorSubject: "Sesja zdjęciowa zarezerwowana: czwartek, 22 października 2026, 10:00",
    photographerSubject: "Nowa rezerwacja: Ada Lovelace, czwartek, 22 października 2026, 10:00",
    details: [
      "Dzień: czwartek, 22 października 2026",
      "Początek: 10:00 (czasu warszawskiego)",
      "Czas trwania: 1 godzina",
      `Cena: ${sessionPrice(1)} ${currency}`,
      `Rodzaj sesji: ${sessionType.name.pl}`,
    ],
    contactNote: "Wkrótce skontaktuję się z Tobą, aby potwierdzić szczegóły.",
    questions: `W razie pytań napisz na ${site.email}.`,
    contacts: [
      "Imię: Ada Lovelace",
      "E-mail: ada@example.com",
      "Telefon: +48 123 456 789",
      "Telegram: @ada_photo",
      "Komentarz: Golden hour by the river, please.",
    ],
    summary: `SUMMARY:Sesja zdjęciowa — ${site.name}`,
  },
];

function reserve(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  return request.post("/api/booking/reserve", {
    data: {
      start: "2026-10-20T16:00:00.000Z",
      duration: 1,
      locale: "en",
      ...visitor,
      website: "",
      elapsedMs: 5000,
      ...overrides,
    },
  });
}

async function state(request: APIRequestContext): Promise<FakeState> {
  const response = await request.get("/api/booking/fake");
  expect(response.status()).toBe(200);
  return response.json();
}

function linksIn(text: string): URL[] {
  return (text.match(/https?:\/\/\S+/g) ?? []).map((link) => new URL(link));
}

function cancelLinkIn(text: string): URL {
  const links = linksIn(text).filter((link) => link.pathname.endsWith("/booking/cancel"));
  expect(links).toHaveLength(1);
  return links[0];
}

function tokenPayload(link: URL): unknown {
  const token = link.searchParams.get("token")!;
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

function calendarLines(attachment: Attachment): string[] {
  expect(attachment.content.endsWith("\r\n")).toBe(true);
  return attachment.content.trimEnd().split("\r\n");
}

function confirmation(page: Page) {
  return page.locator("[data-booking-picker][data-confirmed] section[data-booking-confirmation]");
}

async function reserveInForm(page: Page) {
  await openBooking(page, "en");
  await daysLoaded(page);
  await chooseDay(page, "2026-10-20");
  await page.locator('ul[data-starts] button[data-start="2026-10-20T16:00:00.000Z"]').click();
  await expect(picker(page)).toHaveAttribute("data-selected-start", "2026-10-20T16:00:00.000Z");
  await page.waitForTimeout(minimumFillMs + 300);
  await page.locator("#booking-name").fill(visitor.name);
  await page.locator("#booking-email").fill(visitor.email);
  await page.locator("#booking-phone").fill(visitor.phone);
  await page
    .locator("form[data-booking-form]")
    .getByRole("button", { name: texts.en.booking.form.submit, exact: true })
    .click();
  const confirmed = confirmation(page);
  await expect(confirmed).toBeVisible();
  const link = new URL((await confirmed.locator("a[data-cancel-link]").getAttribute("href"))!);
  expect(link.pathname).toBe("/en/booking/cancel");
  expect(link.searchParams.get("token")).toBeTruthy();
  return { id: (await confirmed.getAttribute("data-reservation-id"))!, link };
}

test.describe("reservation e-mails from the fake", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  for (const booking of bookings) {
    test(`a ${booking.locale} reservation sends a ${booking.locale} e-mail to each side`, async ({
      request,
    }) => {
      const response = await reserve(request, {
        locale: booking.locale,
        start: booking.start,
        duration: booking.duration,
      });
      expect(response.status()).toBe(201);
      const { reservation, cancelUrl } = await response.json();
      const visitorLink = new URL(cancelUrl);

      const { emails } = await state(request);
      expect(emails).toHaveLength(2);
      const [toVisitor, toPhotographer] = emails;

      expect(toVisitor.to).toBe(visitor.email);
      expect(toVisitor.fromName).toBe(site.name);
      expect(toVisitor.replyTo).toBeUndefined();
      expect(toVisitor.subject).toBe(booking.visitorSubject);
      const visitorLines = toVisitor.text.split("\n");
      for (const line of [...booking.details, booking.contactNote, booking.questions]) {
        expect(visitorLines).toContain(line);
      }

      expect(toPhotographer.to).toMatch(/^[^\s@]+@[^\s@]+$/);
      expect(toPhotographer.to).not.toBe(visitor.email);
      expect(toPhotographer.fromName).toBe(site.name);
      expect(toPhotographer.replyTo).toBe(visitor.email);
      expect(toPhotographer.subject).toBe(booking.photographerSubject);
      expect(toPhotographer.attachment).toBeUndefined();
      const photographerLines = toPhotographer.text.split("\n");
      for (const line of [...booking.details, ...booking.contacts]) {
        expect(photographerLines).toContain(line);
      }

      const fromVisitorEmail = cancelLinkIn(toVisitor.text);
      const fromPhotographerEmail = cancelLinkIn(toPhotographer.text);
      expect(fromVisitorEmail.href).toBe(visitorLink.href);
      for (const link of [fromVisitorEmail, fromPhotographerEmail]) {
        expect(link.pathname).toBe(`/${booking.locale}/booking/cancel`);
        expect(link.searchParams.get("token")).toBeTruthy();
        expect(link.origin).toBe(visitorLink.origin);
      }
      expect(fromPhotographerEmail.href).not.toBe(fromVisitorEmail.href);
      expect(tokenPayload(fromVisitorEmail)).toEqual({ id: reservation.id, kind: "visitor" });
      expect(tokenPayload(fromPhotographerEmail)).toEqual({ id: reservation.id, kind: "photographer" });

      const attachment = toVisitor.attachment!;
      expect(attachment.filename).toBe("session.ics");
      expect(attachment.contentType).toBe("text/calendar; charset=utf-8; method=PUBLISH");
      const lines = calendarLines(attachment);
      expect(lines[0]).toBe("BEGIN:VCALENDAR");
      expect(lines.at(-1)).toBe("END:VCALENDAR");
      expect(lines).toContain("BEGIN:VEVENT");
      expect(lines).toContain("END:VEVENT");
      expect(lines).toContain(`DTSTART:${booking.dtstart}`);
      expect(lines).toContain(`DTEND:${booking.dtend}`);
      expect(lines).toContain(`UID:${reservation.id}@${visitorLink.hostname}`);
      expect(lines).toContain(booking.summary);
    });
  }

  test("the visitor e-mail carries none of the photographer-only data", async ({ request }) => {
    expect((await reserve(request)).status()).toBe(201);
    const [toVisitor, toPhotographer] = (await state(request)).emails;
    const photographerLink = cancelLinkIn(toPhotographer.text);

    for (const content of [toVisitor.text, toVisitor.subject, toVisitor.attachment!.content]) {
      for (const secret of [
        visitor.phone,
        "@ada_photo",
        visitor.comment,
        photographerLink.searchParams.get("token")!,
        encodeURIComponent(photographerLink.searchParams.get("token")!),
        toPhotographer.to,
        "Page language",
      ]) {
        expect(content).not.toContain(secret);
      }
    }
    expect(toVisitor.attachment!.content).not.toContain(visitor.email);
    expect(toVisitor.attachment!.content).not.toContain(visitor.name);
  });

  test("empty optional fields are left out of both e-mails", async ({ request }) => {
    const response = await reserve(request, { telegram: "", sessionType: "", comment: "  " });
    expect(response.status()).toBe(201);
    const [toVisitor, toPhotographer] = (await state(request)).emails;

    for (const label of ["Session type", "Telegram", "Comment"]) {
      expect(toVisitor.text).not.toMatch(new RegExp(`^${label}:`, "m"));
      expect(toPhotographer.text).not.toMatch(new RegExp(`^${label}:`, "m"));
    }
    expect(toVisitor.text).not.toContain("undefined");
    expect(toPhotographer.text).not.toContain("undefined");
    expect(toPhotographer.text.split("\n")).toEqual(
      expect.arrayContaining([
        "Name: Ada Lovelace",
        "E-mail: ada@example.com",
        "Phone: +48 123 456 789",
        "Duration: 1 hour",
        `Price: ${sessionPrice(1)} ${currency}`,
      ]),
    );
  });

  test("the calendar file and the times follow winter time after the clock change", async ({
    request,
  }) => {
    const response = await reserve(request, { start: "2026-10-27T17:00:00.000Z", duration: 3 });
    expect(response.status()).toBe(201);
    const [toVisitor, toPhotographer] = (await state(request)).emails;
    expect(toVisitor.subject).toBe("Your photo session is reserved: Tuesday, October 27, 2026, 18:00");
    expect(toPhotographer.subject).toBe("New reservation: Ada Lovelace, Tuesday, October 27, 2026, 18:00");
    for (const text of [toVisitor.text, toPhotographer.text]) {
      expect(text.split("\n")).toEqual(
        expect.arrayContaining([
          "Start: 18:00 (Warsaw time)",
          "Duration: 3 hours",
          `Price: ${sessionPrice(3)} ${currency}`,
        ]),
      );
    }
    const lines = calendarLines(toVisitor.attachment!);
    expect(lines).toContain("DTSTART:20261027T170000Z");
    expect(lines).toContain("DTEND:20261027T200000Z");
  });

  test("each reservation gets its own e-mails and cancel links", async ({ request }) => {
    expect((await reserve(request, { start: "2026-10-20T06:00:00.000Z" })).status()).toBe(201);
    expect(
      (
        await reserve(request, {
          start: "2026-10-20T07:00:00.000Z",
          name: "Grace Hopper",
          email: "grace@example.com",
        })
      ).status(),
    ).toBe(201);
    const { emails, reservations } = await state(request);
    expect(emails.map(({ to, replyTo }) => [to === emails[1].to ? "photographer" : to, replyTo])).toEqual([
      ["ada@example.com", undefined],
      ["photographer", "ada@example.com"],
      ["grace@example.com", undefined],
      ["photographer", "grace@example.com"],
    ]);
    expect(emails[3].to).toBe(emails[1].to);
    const ids = emails.map((email) => (tokenPayload(cancelLinkIn(email.text)) as { id: string }).id);
    expect(ids).toEqual([reservations[0].id, reservations[0].id, reservations[1].id, reservations[1].id]);
    expect(new Set(emails.map((email) => cancelLinkIn(email.text).href)).size).toBe(4);
  });

  test("nothing is sent when the reservation is refused or the calendar fails", async ({ request }) => {
    await fakeBooking(request, { action: "reserve", day: "2026-10-20", start: "18:00" });
    expect((await reserve(request)).status()).toBe(409);
    expect((await reserve(request, { name: "" })).status()).toBe(400);
    await fakeBooking(request, { action: "fail", operation: "createReservation" });
    expect((await reserve(request, { start: "2026-10-20T10:00:00.000Z" })).status()).toBe(503);
    expect((await state(request)).emails).toEqual([]);
  });

  test("when the first e-mail fails the reservation stands and the photographer is still notified", async ({
    page,
    request,
  }) => {
    await fakeBooking(request, { action: "fail", operation: "sendEmail", times: 1 });
    const { id } = await reserveInForm(page);

    const { reservations, emails } = await state(request);
    expect(reservations.map((reservation) => reservation.id)).toEqual([id]);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).not.toBe(visitor.email);
    expect(emails[0].replyTo).toBe(visitor.email);
    expect(emails[0].attachment).toBeUndefined();
    expect(tokenPayload(cancelLinkIn(emails[0].text))).toEqual({ id, kind: "photographer" });
  });

  test("when every e-mail fails the reservation stands and the confirmation keeps the cancel link", async ({
    page,
    request,
  }) => {
    await fakeBooking(request, { action: "fail", operation: "sendEmail", times: 2 });
    const { id, link } = await reserveInForm(page);
    expect(tokenPayload(link)).toEqual({ id, kind: "visitor" });

    const { reservations, emails } = await state(request);
    expect(reservations.map((reservation) => reservation.id)).toEqual([id]);
    expect(emails).toEqual([]);

    expect((await reserve(request, { start: "2026-10-20T10:00:00.000Z" })).status()).toBe(201);
    expect((await state(request)).emails).toHaveLength(2);
  });
});
