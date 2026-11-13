import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { getCategories, site, texts } from "../lib/content";
import type { Locale } from "../lib/i18n";
import { notConfiguredBaseURL } from "../playwright.config";
import { fakeBooking, meta } from "./helpers";

type Email = { to: string; subject: string; text: string; replyTo?: string };

type StoredReservation = { id: string; start: string; end: string };

type FakeState = { reservations: StoredReservation[]; emails: Email[] };

type Links = { id: string; visitor: URL; photographer: URL; photographerEmail: string };

const sessionType = getCategories()[0];

const visitor = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
  telegram: "ada_photo",
  sessionType: sessionType.slug,
};

const inThreeDays = "2026-10-15T08:00:00.000Z";

function reserve(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  return request.post("/api/booking/reserve", {
    data: {
      start: inThreeDays,
      duration: 1,
      locale: "en",
      ...visitor,
      comment: "",
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

function cancelLinkIn(text: string): URL {
  const links = (text.match(/https?:\/\/\S+/g) ?? [])
    .map((link) => new URL(link))
    .filter((link) => link.pathname.endsWith("/booking/cancel"));
  expect(links).toHaveLength(1);
  return links[0];
}

async function book(
  request: APIRequestContext,
  locale: Locale = "en",
  start = inThreeDays,
  duration = 1,
): Promise<Links> {
  const response = await reserve(request, { locale, start, duration });
  expect(response.status(), await response.text()).toBe(201);
  const { reservation, cancelUrl } = await response.json();
  const { emails } = await state(request);
  const toPhotographer = emails.find((email) => email.replyTo === visitor.email)!;
  return {
    id: reservation.id,
    visitor: new URL(cancelUrl),
    photographer: cancelLinkIn(toPhotographer.text),
    photographerEmail: toPhotographer.to,
  };
}

async function bookAt(
  request: APIRequestContext,
  day: string,
  start: string,
  duration = 1,
  locale: Locale = "en",
): Promise<Links> {
  const links = await book(request, locale);
  await fakeBooking(request, { action: "reset" });
  const placed = await fakeBooking(request, {
    action: "reserve",
    day,
    start,
    duration,
    locale,
    ...visitor,
  });
  expect(placed.id).toBe(links.id);
  return links;
}

function path(link: URL): string {
  return link.pathname + link.search;
}

function tokenOf(link: URL): string {
  return link.searchParams.get("token")!;
}

function cancel(request: APIRequestContext, token: unknown) {
  return request.post("/api/booking/cancel", { data: { token } });
}

function cancelState(page: Page) {
  return page.locator("#booking-cancel [data-cancel-state]");
}

function confirmButton(page: Page) {
  return page.locator("button[data-cancel-confirm]");
}

function outcome(page: Page, value: string) {
  return page.locator(`p[role="status"][data-cancel-state="${value}"]`);
}

async function openCancel(page: Page, link: URL | string) {
  await page.goto(typeof link === "string" ? link : path(link));
  await expect(page.locator("a[data-back-to-booking]")).toBeVisible();
}

async function starts(request: APIRequestContext, day: string): Promise<string[]> {
  const response = await request.get(`/api/booking/starts?day=${day}&duration=1`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { starts: { start: string }[] };
  return body.starts.map((entry) => entry.start);
}

function withPayload(token: string, payload: unknown): string {
  const [, signature] = token.split(".");
  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

function flipLast(value: string): string {
  return value.slice(0, -1) + (value.endsWith("A") ? "B" : "A");
}

const confirmations = [
  {
    locale: "en" as const,
    day: "Thursday, October 15, 2026",
    visitorSubject: "Your photo session is cancelled: Thursday, October 15, 2026, 10:00",
    photographerSubject: "Reservation cancelled by the client: Ada Lovelace, Thursday, October 15, 2026, 10:00",
    visitorLine: "your reservation is cancelled as you requested.",
    photographerLines: ["Name: Ada Lovelace", "E-mail: ada@example.com", "Phone: +48 123 456 789", "Telegram: @ada_photo"],
  },
  {
    locale: "pl" as const,
    day: "czwartek, 15 października 2026",
    visitorSubject: "Sesja zdjęciowa anulowana: czwartek, 15 października 2026, 10:00",
    photographerSubject: "Klient anulował rezerwację: Ada Lovelace, czwartek, 15 października 2026, 10:00",
    visitorLine: "Twoja rezerwacja została anulowana zgodnie z prośbą.",
    photographerLines: ["Imię: Ada Lovelace", "E-mail: ada@example.com", "Telefon: +48 123 456 789", "Telegram: @ada_photo"],
  },
];

const photographerCancellations = [
  {
    locale: "en" as const,
    visitorSubject: "Your photo session is cancelled: Monday, October 12, 2026, 12:00",
    photographerSubject: "You cancelled the reservation: Ada Lovelace, Monday, October 12, 2026, 12:00",
    apology: "unfortunately I have to cancel your photo session. I am sorry for the inconvenience.",
    rebook: "You can choose another time on the booking page:",
  },
  {
    locale: "pl" as const,
    visitorSubject: "Sesja zdjęciowa anulowana: poniedziałek, 12 października 2026, 12:00",
    photographerSubject: "Anulowano rezerwację: Ada Lovelace, poniedziałek, 12 października 2026, 12:00",
    apology: "niestety muszę odwołać Twoją sesję zdjęciową. Przepraszam za kłopot.",
    rebook: "Możesz wybrać inny termin na stronie rezerwacji:",
  },
];

test.describe("cancellation with the fake", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  for (const expected of confirmations) {
    test(`the visitor cancels in time on the ${expected.locale} page`, async ({ page, request }) => {
      const { locale } = expected;
      const { booking } = texts[locale];
      const links = await book(request, locale);
      expect(links.visitor.pathname).toBe(`/${locale}/booking/cancel`);
      expect(await starts(request, "2026-10-15")).not.toContain(inThreeDays);

      await openCancel(page, links.visitor);
      const details = page.locator(`dl[data-cancel-details][data-reservation-id="${links.id}"]`);
      await expect(details).toBeVisible();
      await expect(details.locator('[data-detail="day"] dd')).toHaveText(expected.day);
      await expect(details.locator('[data-detail="time"] dd')).toHaveText("10:00–11:00");
      await expect(details.locator('[data-detail="duration"] dd')).toHaveText(booking.duration.hours(1));
      await expect(details.locator('[data-detail="sessionType"] dd')).toHaveText(sessionType.name[locale]);
      await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "confirm");
      await expect(confirmButton(page)).toHaveText(booking.cancel.confirm);
      expect(await meta(page, 'name="robots"')).toContain("noindex");
      await expect(page).toHaveTitle(texts[locale].meta.bookingCancelTitle);
      await expect(page.locator("a[data-back-to-booking]")).toHaveAttribute("href", `/${locale}/booking`);

      await confirmButton(page).click();
      await expect(outcome(page, "cancelled")).toHaveText(booking.cancel.cancelled);
      await expect(confirmButton(page)).toHaveCount(0);

      const { reservations, emails } = await state(request);
      expect(reservations).toEqual([]);
      expect(await starts(request, "2026-10-15")).toContain(inThreeDays);
      expect(emails).toHaveLength(4);
      const toVisitor = emails.slice(2).find((email) => email.to === visitor.email)!;
      const toPhotographer = emails.slice(2).find((email) => email.to === links.photographerEmail)!;
      expect(toVisitor.subject).toBe(expected.visitorSubject);
      expect(toVisitor.replyTo).toBeUndefined();
      expect(toVisitor.text.split("\n")).toContain(expected.visitorLine);
      expect(toVisitor.text).not.toContain(visitor.phone);
      expect(toPhotographer.subject).toBe(expected.photographerSubject);
      expect(toPhotographer.replyTo).toBe(visitor.email);
      expect(toPhotographer.text.split("\n")).toEqual(expect.arrayContaining(expected.photographerLines));
      for (const email of [toVisitor, toPhotographer]) {
        expect(email.text).not.toContain("/booking/cancel");
      }
    });
  }

  test("a reservation exactly 24 hours ahead is too late for the visitor", async ({ page, request }) => {
    const links = await book(request, "en", "2026-10-13T08:00:00.000Z");

    await openCancel(page, links.visitor);
    await expect(page.locator("dl[data-cancel-details]")).toBeVisible();
    await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "tooLate");
    await expect(confirmButton(page)).toHaveCount(0);

    const response = await cancel(request, tokenOf(links.visitor));
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "tooLate" });
    expect((await state(request)).reservations.map((reservation) => reservation.id)).toEqual([links.id]);
  });

  for (const locale of ["en", "pl"] as const) {
    test(`the visitor link 20 hours ahead points to the photographer on the ${locale} page`, async ({
      page,
      request,
    }) => {
      const { cancel: labels } = texts[locale].booking;
      const links = await bookAt(request, "2026-10-13", "06:00", 1, locale);

      await openCancel(page, links.visitor);
      await expect(page.locator(`dl[data-cancel-details][data-reservation-id="${links.id}"]`)).toBeVisible();
      const message = cancelState(page);
      await expect(message).toHaveAttribute("data-cancel-state", "tooLate");
      await expect(message).toContainText(labels.tooLate);
      const contact = message.locator("a[data-contact-email]");
      await expect(contact).toHaveText(site.email);
      await expect(contact).toHaveAttribute("href", `mailto:${site.email}`);
      await expect(confirmButton(page)).toHaveCount(0);
      await expect(page.locator("a[data-back-to-booking]")).toHaveAttribute("href", `/${locale}/booking`);

      const response = await cancel(request, tokenOf(links.visitor));
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "tooLate" });
      const { reservations, emails } = await state(request);
      expect(reservations.map((reservation) => reservation.id)).toEqual([links.id]);
      expect(emails).toEqual([]);
    });
  }

  for (const expected of photographerCancellations) {
    test(`the photographer cancels two hours before the start in ${expected.locale}`, async ({
      page,
      request,
    }) => {
      const { locale } = expected;
      const links = await bookAt(request, "2026-10-12", "12:00", 1, locale);

      await openCancel(page, links.photographer);
      await expect(page.locator(`dl[data-cancel-details][data-reservation-id="${links.id}"]`)).toBeVisible();
      await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "confirm");
      await confirmButton(page).click();
      await expect(outcome(page, "cancelled")).toHaveText(texts[locale].booking.cancel.cancelled);

      const { reservations, emails } = await state(request);
      expect(reservations).toEqual([]);
      expect(emails).toHaveLength(2);
      const toVisitor = emails.find((email) => email.to === visitor.email)!;
      const toPhotographer = emails.find((email) => email.to === links.photographerEmail)!;
      expect(toVisitor.subject).toBe(expected.visitorSubject);
      const lines = toVisitor.text.split("\n");
      expect(lines).toContain(expected.apology);
      expect(lines).toContain(expected.rebook);
      expect(lines).toContain(`${links.visitor.origin}/${locale}/booking`);
      expect(toVisitor.text).toContain(site.email);
      expect(toVisitor.text).not.toContain("/booking/cancel");
      expect(toPhotographer.subject).toBe(expected.photographerSubject);
      expect(toPhotographer.replyTo).toBe(visitor.email);
    });
  }

  test("the visitor link is too late while the photographer link still works", async ({ page, request }) => {
    const links = await bookAt(request, "2026-10-12", "12:00");

    await openCancel(page, links.visitor);
    await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "tooLate");
    expect((await cancel(request, tokenOf(links.visitor))).status()).toBe(403);
    expect((await state(request)).reservations).toHaveLength(1);

    const response = await cancel(request, tokenOf(links.photographer));
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "cancelled" });
    expect((await state(request)).reservations).toEqual([]);
  });

  test("the photographer link no longer works once the session has started", async ({ page, request }) => {
    const { cancel: labels } = texts.en.booking;
    const links = await bookAt(request, "2026-10-12", "09:00", 2);

    for (const link of [links.photographer, links.visitor]) {
      await openCancel(page, link);
      await expect(page.locator("dl[data-cancel-details]")).toBeVisible();
      await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "tooLate");
      await expect(confirmButton(page)).toHaveCount(0);
    }
    await openCancel(page, links.photographer);
    await expect(cancelState(page)).toHaveText(labels.started);
    await expect(page.locator("a[data-contact-email]")).toHaveCount(0);

    for (const link of [links.photographer, links.visitor]) {
      const response = await cancel(request, tokenOf(link));
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "tooLate" });
    }
    const { reservations, emails } = await state(request);
    expect(reservations.map((reservation) => reservation.id)).toEqual([links.id]);
    expect(emails).toEqual([]);
  });

  test("the photographer link works up to the last minute before the start", async ({ request }) => {
    const links = await bookAt(request, "2026-10-12", "10:00");
    expect((await cancel(request, tokenOf(links.photographer))).status()).toBe(403);

    await fakeBooking(request, { action: "reset" });
    const later = await bookAt(request, "2026-10-12", "10:30");
    const response = await cancel(request, tokenOf(later.photographer));
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "cancelled" });
  });

  test("visiting the links without confirming deletes and sends nothing", async ({ page, request }) => {
    const links = await book(request);
    const before = await state(request);

    for (const link of [links.visitor, links.photographer]) {
      for (let visit = 0; visit < 2; visit++) {
        await openCancel(page, link);
        await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "confirm");
      }
      const prefetch = await request.get(path(link));
      expect(prefetch.status()).toBe(200);
      const head = await request.head(path(link));
      expect(head.status()).toBe(200);
    }

    const after = await state(request);
    expect(after.reservations).toEqual(before.reservations);
    expect(after.emails).toEqual(before.emails);
  });

  test("the page never shows the visitor's name or contacts", async ({ page, request }) => {
    const links = await book(request);

    for (const link of [links.visitor, links.photographer]) {
      await openCancel(page, link);
      await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "confirm");
      const html = await page.content();
      for (const secret of [visitor.name, visitor.email, visitor.phone, visitor.telegram]) {
        expect(html).not.toContain(secret);
      }
    }
    await confirmButton(page).click();
    await expect(outcome(page, "cancelled")).toBeVisible();
    const html = await page.content();
    for (const secret of [visitor.name, visitor.email, visitor.phone, visitor.telegram]) {
      expect(html).not.toContain(secret);
    }
  });

  test("tampered tokens show an invalid link and cancel nothing", async ({ page, request }) => {
    const links = await book(request);
    const token = tokenOf(links.visitor);
    const [data, signature] = token.split(".");
    const tampered = [
      `${data}.${flipLast(signature)}`,
      `${flipLast(data)}.${signature}`,
      withPayload(token, { id: links.id, kind: "photographer" }),
      withPayload(token, { id: "fake-2", kind: "visitor" }),
      data,
      `${token}.extra`,
      "not-a-token",
    ];
    const before = await state(request);

    for (const value of tampered) {
      await openCancel(page, `/en/booking/cancel?token=${encodeURIComponent(value)}`);
      await expect(cancelState(page), value).toHaveAttribute("data-cancel-state", "invalid");
      await expect(cancelState(page)).toHaveText(texts.en.booking.cancel.invalid);
      await expect(page.locator("dl[data-cancel-details]")).toHaveCount(0);
      await expect(confirmButton(page)).toHaveCount(0);

      const response = await cancel(request, value);
      expect(response.status(), value).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid" });
    }

    for (const query of ["", "?token=", "?token=a&token=b"]) {
      await openCancel(page, `/pl/booking/cancel${query}`);
      await expect(cancelState(page), query).toHaveAttribute("data-cancel-state", "invalid");
      await expect(cancelState(page)).toHaveText(texts.pl.booking.cancel.invalid);
    }

    for (const body of [{}, { token: 42 }, { token: null }]) {
      const response = await request.post("/api/booking/cancel", { data: body });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid" });
    }
    const malformed = await request.post("/api/booking/cancel", {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(malformed.status()).toBe(400);

    const after = await state(request);
    expect(after.reservations).toEqual(before.reservations);
    expect(after.emails).toEqual(before.emails);
  });

  test("a stale link shows the reservation as already cancelled and sends nothing", async ({
    page,
    request,
  }) => {
    const links = await book(request, "pl");
    await fakeBooking(request, { action: "unreserve", id: links.id });
    const before = await state(request);

    for (const link of [links.visitor, links.photographer]) {
      await openCancel(page, link);
      await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "alreadyCancelled");
      await expect(cancelState(page)).toHaveText(texts.pl.booking.cancel.alreadyCancelled);
      await expect(confirmButton(page)).toHaveCount(0);

      const response = await cancel(request, tokenOf(link));
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ status: "alreadyCancelled" });
    }
    expect((await state(request)).emails).toEqual(before.emails);
  });

  test("a second confirmation finds the reservation already cancelled", async ({ page, request }) => {
    const links = await book(request);

    await openCancel(page, links.photographer);
    await expect(confirmButton(page)).toBeVisible();

    const first = await cancel(request, tokenOf(links.visitor));
    expect(await first.json()).toEqual({ status: "cancelled" });
    expect((await state(request)).emails).toHaveLength(4);

    const second = await cancel(request, tokenOf(links.visitor));
    expect(second.status()).toBe(200);
    expect(await second.json()).toEqual({ status: "alreadyCancelled" });

    await confirmButton(page).click();
    await expect(outcome(page, "alreadyCancelled")).toHaveText(texts.en.booking.cancel.alreadyCancelled);
    expect((await state(request)).emails).toHaveLength(4);
  });

  test("a provider failure keeps the button and a retry cancels", async ({ page, request }) => {
    const links = await book(request);

    await openCancel(page, links.visitor);
    await fakeBooking(request, { action: "fail", operation: "deleteReservation" });
    await confirmButton(page).click();
    await expect(page.locator('p[role="alert"][data-cancel-error]')).toHaveText(
      texts.en.booking.cancel.failed,
    );
    await expect(confirmButton(page)).toBeEnabled();
    expect((await state(request)).reservations).toHaveLength(1);
    expect((await state(request)).emails).toHaveLength(2);

    await confirmButton(page).click();
    await expect(outcome(page, "cancelled")).toBeVisible();
    await expect(page.locator("[data-cancel-error]")).toHaveCount(0);
    const { reservations, emails } = await state(request);
    expect(reservations).toEqual([]);
    expect(emails).toHaveLength(4);
  });

  test("a failing calendar read shows the failure page and answers 503", async ({ page, request }) => {
    const links = await book(request);

    await fakeBooking(request, { action: "fail", operation: "getReservation" });
    await openCancel(page, links.visitor);
    await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "failed");
    await expect(cancelState(page)).toHaveText(texts.en.booking.cancel.failed);
    await expect(confirmButton(page)).toHaveCount(0);

    await fakeBooking(request, { action: "fail", operation: "getReservation" });
    const response = await cancel(request, tokenOf(links.visitor));
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "failed" });
    expect((await state(request)).reservations).toHaveLength(1);
  });

  test("the cancellation stands when both e-mails fail", async ({ page, request }) => {
    const links = await book(request);

    await openCancel(page, links.visitor);
    await fakeBooking(request, { action: "fail", operation: "sendEmail", times: 2 });
    await confirmButton(page).click();
    await expect(outcome(page, "cancelled")).toBeVisible();

    const { reservations, emails } = await state(request);
    expect(reservations).toEqual([]);
    expect(emails).toHaveLength(2);
  });

  test("a busy block over a reservation leaves it cancellable", async ({ page, request }) => {
    const links = await book(request, "en", "2026-10-20T08:00:00.000Z");
    await fakeBooking(request, { action: "block", day: "2026-10-20", from: "09:00", to: "13:00" });
    expect((await state(request)).reservations.map((reservation) => reservation.id)).toEqual([links.id]);

    await openCancel(page, links.visitor);
    await expect(cancelState(page)).toHaveAttribute("data-cancel-state", "confirm");
    await confirmButton(page).click();
    await expect(outcome(page, "cancelled")).toBeVisible();

    const { reservations, emails } = await state(request);
    expect(reservations).toEqual([]);
    expect(emails).toHaveLength(4);
    const offered = await starts(request, "2026-10-20");
    for (const start of ["2026-10-20T07:00:00.000Z", "2026-10-20T08:00:00.000Z", "2026-10-20T10:00:00.000Z"]) {
      expect(offered).not.toContain(start);
    }
    expect(offered).toContain("2026-10-20T11:00:00.000Z");
  });
});

test.describe("cancellation without configuration", () => {
  test.use({ baseURL: notConfiguredBaseURL });

  test("the cancel endpoint answers 404", async ({ request }) => {
    const response = await request.post("/api/booking/cancel", { data: { token: "anything" } });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "not_configured" });
  });

  for (const locale of ["en", "pl"] as const) {
    test(`/${locale}/booking/cancel shows the contact e-mail`, async ({ page }) => {
      await page.goto(`/${locale}/booking/cancel?token=anything`);
      const message = page.locator('#booking-cancel [data-cancel-state="notConfigured"]');
      await expect(message).toContainText(texts[locale].booking.notConfigured);
      await expect(message.locator("a[data-contact-email]")).toHaveText(site.email);
      await expect(page.locator("button[data-cancel-confirm]")).toHaveCount(0);
      await expect(page.locator("a[data-back-to-booking]")).toHaveAttribute("href", `/${locale}/booking`);
      expect(await meta(page, 'name="robots"')).toContain("noindex");
    });
  }
});
