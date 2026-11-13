import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { minimumFillMs, reservationLimit } from "../lib/booking/reservation";
import { currency, getCategories, texts } from "../lib/content";
import { sessionPrice } from "../lib/booking/price";
import type { Locale } from "../lib/i18n";
import {
  chooseDay,
  chooseDuration,
  chooseSessionType,
  daysLoaded,
  fakeBooking,
  hours,
  openBooking,
  picker,
  startButtons,
} from "./helpers";

type Visitor = {
  name: string;
  email: string;
  phone: string;
  telegram?: string;
  sessionType?: string;
  comment?: string;
};

type StoredReservation = Record<string, unknown> & { id: string; email: string; name: string };

const ada: Visitor = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+48 123 456 789",
};

const sessionType = getCategories()[0];

function selection(page: Page) {
  return page.locator("section[data-booking-selection]");
}

function form(page: Page) {
  return page.locator("form[data-booking-form]");
}

function confirmation(page: Page) {
  return page.locator("[data-booking-picker][data-confirmed] section[data-booking-confirmation]");
}

function detail(scope: ReturnType<typeof selection>, key: string) {
  return scope.locator(`[data-detail="${key}"] dd`);
}

function bookingError(page: Page, key: string) {
  return page.locator(`p[role="alert"][data-booking-error="${key}"]`);
}

function startButton(page: Page, start: string) {
  return page.locator(`ul[data-starts] button[data-start="${start}"]`);
}

async function stored(request: APIRequestContext): Promise<StoredReservation[]> {
  const response = await request.get("/api/booking/fake");
  expect(response.status()).toBe(200);
  return (await response.json()).reservations;
}

async function openForm(page: Page, locale: Locale, day: string, start: string, duration = 1) {
  await openBooking(page, locale);
  await daysLoaded(page);
  if (duration !== 1) await chooseDuration(page, duration);
  await chooseDay(page, day);
  await startButton(page, start).click();
  await expect(picker(page)).toHaveAttribute("data-selected-start", start);
  await expect(form(page)).toBeVisible();
}

async function fillForm(page: Page, visitor: Visitor) {
  await page.locator("#booking-name").fill(visitor.name);
  await page.locator("#booking-email").fill(visitor.email);
  await page.locator("#booking-phone").fill(visitor.phone);
  if (visitor.telegram !== undefined) await page.locator("#booking-telegram").fill(visitor.telegram);
  if (visitor.sessionType !== undefined) await chooseSessionType(page, visitor.sessionType);
  if (visitor.comment !== undefined) await page.locator("#booking-comment").fill(visitor.comment);
}

async function waitPastMinimumFill(page: Page) {
  await page.waitForTimeout(minimumFillMs + 300);
}

async function submit(page: Page, locale: Locale) {
  await form(page).getByRole("button", { name: texts[locale].booking.form.submit, exact: true }).click();
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    start: "2026-10-20T16:00:00.000Z",
    duration: 1,
    locale: "en",
    ...ada,
    website: "",
    elapsedMs: 5000,
    ...overrides,
  };
}

function reserve(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return request.post("/api/booking/reserve", { data: payload(overrides), headers });
}

test.describe("reserving with the fake calendar", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test("the form appears only once a start is chosen and repeats the selection", async ({ page }) => {
    const { booking } = texts.en;
    await openBooking(page);
    await daysLoaded(page);
    await expect(selection(page)).toHaveCount(0);

    await chooseDay(page, "2026-10-20");
    await expect(startButtons(page)).toHaveText(hours(8, 21));
    await expect(selection(page)).toHaveCount(0);
    await expect(form(page)).toHaveCount(0);

    await startButton(page, "2026-10-20T16:00:00.000Z").click();
    await expect(selection(page)).toBeVisible();
    await expect(
      selection(page).getByRole("heading", { level: 2, name: booking.form.heading }),
    ).toBeVisible();
    await expect(detail(selection(page), "day")).toHaveText("Tuesday, October 20, 2026");
    await expect(detail(selection(page), "time")).toHaveText("18:00–19:00");
    await expect(detail(selection(page), "duration")).toHaveText(booking.duration.hours(1));
    await expect(detail(selection(page), "price")).toHaveText(`${sessionPrice(1)} ${currency}`);
    for (const field of ["name", "email", "phone", "telegram", "sessionType", "comment"] as const) {
      await expect(form(page).getByLabel(booking.form[field])).toHaveAttribute("id", `booking-${field}`);
    }
    await expect(page.locator('input[type="hidden"][name="sessionType"]')).toHaveValue("");
    await expect(page.locator("#booking-sessionType")).toHaveText(booking.form.sessionTypeNone);

    await chooseDuration(page, 3);
    await expect(selection(page)).toHaveCount(0);
    await startButton(page, "2026-10-20T16:00:00.000Z").click();
    await expect(detail(selection(page), "time")).toHaveText("18:00–21:00");
    await expect(detail(selection(page), "duration")).toHaveText(booking.duration.hours(3));
    await expect(detail(selection(page), "price")).toHaveText(`${sessionPrice(3)} ${currency}`);

    await chooseDay(page, "2026-10-22");
    await expect(selection(page)).toHaveCount(0);
  });

  const happyPaths = [
    {
      locale: "en" as const,
      day: "2026-10-20",
      start: "2026-10-20T16:00:00.000Z",
      end: "2026-10-20T18:00:00.000Z",
      duration: 2,
      price: sessionPrice(2),
      dayText: "Tuesday, October 20, 2026",
      timeText: "18:00–20:00",
      left: [...hours(8, 17), "20:00", "21:00"],
      telegram: "@ada_photo",
    },
    {
      locale: "pl" as const,
      day: "2026-10-22",
      start: "2026-10-22T08:00:00.000Z",
      end: "2026-10-22T09:00:00.000Z",
      duration: 1,
      price: sessionPrice(1),
      dayText: "czwartek, 22 października 2026",
      timeText: "10:00–11:00",
      left: ["08:00", "09:00", ...hours(11, 21)],
      telegram: "ada_photo",
    },
  ];

  for (const path of happyPaths) {
    test(`a visitor on /${path.locale}/booking reserves a session and sees the confirmation`, async ({
      page,
      request,
    }) => {
      const { booking } = texts[path.locale];
      const visitor: Visitor = {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+48 123 456 789",
        telegram: path.telegram,
        sessionType: sessionType.slug,
        comment: "Golden hour by the river, please.",
      };
      await openForm(page, path.locale, path.day, path.start, path.duration);
      await waitPastMinimumFill(page);
      await fillForm(page, visitor);
      await submit(page, path.locale);

      const confirmed = confirmation(page);
      await expect(confirmed).toBeVisible();
      await expect(form(page)).toHaveCount(0);
      await expect(
        confirmed.getByRole("heading", { level: 2, name: booking.confirmation.heading }),
      ).toBeFocused();
      await expect(detail(confirmed, "day")).toHaveText(path.dayText);
      await expect(detail(confirmed, "time")).toHaveText(path.timeText);
      await expect(detail(confirmed, "duration")).toHaveText(booking.duration.hours(path.duration));
      await expect(detail(confirmed, "price")).toHaveText(`${path.price} ${currency}`);
      await expect(detail(confirmed, "sessionType")).toHaveText(sessionType.name[path.locale]);
      await expect(detail(confirmed, "name")).toHaveText(visitor.name);
      await expect(detail(confirmed, "email")).toHaveText(visitor.email);
      await expect(detail(confirmed, "phone")).toHaveText(visitor.phone);
      await expect(detail(confirmed, "telegram")).toHaveText("@ada_photo");

      const link = confirmed.locator("a[data-cancel-link]");
      await expect(link).toHaveText(booking.confirmation.cancel);
      const href = new URL((await link.getAttribute("href"))!);
      expect(href.pathname).toBe(`/${path.locale}/booking/cancel`);
      expect(href.searchParams.get("token")).toBeTruthy();

      const reservations = await stored(request);
      expect(reservations).toHaveLength(1);
      expect(reservations[0]).toMatchObject({
        id: await confirmed.getAttribute("data-reservation-id"),
        start: path.start,
        end: path.end,
        duration: path.duration,
        price: path.price,
        locale: path.locale,
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone,
        telegram: "@ada_photo",
        sessionType: sessionType.slug,
        comment: visitor.comment,
      });

      await page.reload();
      await expect(picker(page)).not.toHaveAttribute("data-confirmed");
      await daysLoaded(page);
      await chooseDay(page, path.day);
      await expect(startButtons(page)).toHaveText(path.left);
    });
  }

  for (const locale of ["en", "pl"] as const) {
    test(`invalid fields on /${locale}/booking are reported inline and nothing is created`, async ({
      page,
      request,
    }) => {
      const { errors } = texts[locale].booking;
      for (const { keys, ...invalid } of [
        { name: "", email: "ada", phone: "", keys: { name: "name", email: "emailInvalid", phone: "phone" } },
        {
          name: "   ",
          email: "ada@example",
          phone: "12-34-5",
          keys: { name: "name", email: "emailInvalid", phone: "phoneInvalid" },
        },
      ] as const) {
        await openForm(page, locale, "2026-10-20", "2026-10-20T16:00:00.000Z");
        await waitPastMinimumFill(page);
        await fillForm(page, invalid);
        await submit(page, locale);

        for (const field of ["name", "email", "phone"] as const) {
          const message = page.locator(`p#booking-${field}-error[data-field-error]`);
          await expect(message).toHaveText(errors[keys[field]]);
          await expect(page.locator(`#booking-${field}`)).toHaveAttribute("aria-invalid", "true");
          await expect(page.locator(`#booking-${field}`)).toHaveAttribute(
            "aria-describedby",
            `booking-${field}-error`,
          );
        }
        await expect(page.locator("[data-field-error]")).toHaveCount(3);
        await expect(page.locator("#booking-telegram")).not.toHaveAttribute("aria-invalid", "true");
        await expect(form(page)).toBeVisible();
        await expect(confirmation(page)).toHaveCount(0);
        expect(await stored(request)).toEqual([]);

        const direct = await reserve(request, { ...invalid, locale });
        expect(direct.status()).toBe(400);
        expect(await direct.json()).toEqual({ error: "validation", fields: keys });
        expect(await stored(request)).toEqual([]);
      }

      await fillForm(page, ada);
      await submit(page, locale);
      await expect(confirmation(page)).toBeVisible();
      expect(await stored(request)).toHaveLength(1);
    });
  }

  test("the server reports every invalid optional field and rejects unknown session types", async ({
    request,
  }) => {
    const response = await reserve(request, {
      telegram: "ada",
      sessionType: "not-a-session",
      comment: "x".repeat(1001),
      email: "ada example.com",
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: "validation",
      fields: {
        email: "emailInvalid",
        telegram: "telegram",
        sessionType: "sessionType",
        comment: "comment",
      },
    });
    expect(await stored(request)).toEqual([]);
  });

  test("a Telegram handle is stored as @handle with or without the @ and empty optionals are omitted", async ({
    request,
  }) => {
    const cases = [
      { start: "2026-10-20T06:00:00.000Z", telegram: "ada_photo" },
      { start: "2026-10-20T07:00:00.000Z", telegram: "@ada_photo" },
      { start: "2026-10-20T08:00:00.000Z", telegram: "  @Ada_Photo_2026  " },
    ];
    for (const { start, telegram } of cases) {
      const response = await reserve(request, { start, telegram });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.reservation.telegram).toBe(`@${telegram.trim().replace(/^@/, "")}`);
    }
    const handles = (await stored(request)).map((reservation) => reservation.telegram);
    expect(handles).toEqual(["@ada_photo", "@ada_photo", "@Ada_Photo_2026"]);

    const bare = await reserve(request, {
      start: "2026-10-20T09:00:00.000Z",
      telegram: "",
      sessionType: "",
      comment: "  ",
    });
    expect(bare.status()).toBe(201);
    const { reservation, cancelUrl } = await bare.json();
    expect(reservation).not.toHaveProperty("telegram");
    expect(reservation).not.toHaveProperty("sessionType");
    expect(reservation).not.toHaveProperty("comment");
    const link = new URL(cancelUrl);
    expect(link.pathname).toBe("/en/booking/cancel");
    expect(link.searchParams.get("token")).toBeTruthy();
  });

  test("invalid Telegram handles are rejected", async ({ request }) => {
    for (const telegram of ["ada", "@ada", "ada photo", "@@ada_photo", "ada-photo", "a".repeat(33)]) {
      const response = await reserve(request, { telegram });
      expect(response.status(), telegram).toBe(400);
      expect(await response.json()).toEqual({ error: "validation", fields: { telegram: "telegram" } });
    }
    expect(await stored(request)).toEqual([]);
  });

  test("an invalid Telegram handle in the form is reported under the field", async ({ page, request }) => {
    await openForm(page, "pl", "2026-10-20", "2026-10-20T16:00:00.000Z");
    await waitPastMinimumFill(page);
    await fillForm(page, { ...ada, telegram: "@ada photo" });
    await submit(page, "pl");
    await expect(page.locator("p#booking-telegram-error")).toHaveText(texts.pl.booking.errors.telegram);
    await expect(page.locator("#booking-telegram")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("[data-field-error]")).toHaveCount(1);
    expect(await stored(request)).toEqual([]);
  });

  test("a start reserved by someone else after the form opened is reported as taken", async ({
    page,
    request,
  }) => {
    const { booking } = texts.en;
    await openForm(page, "en", "2026-10-20", "2026-10-20T16:00:00.000Z");
    const other = await fakeBooking(request, {
      action: "reserve",
      day: "2026-10-20",
      start: "18:00",
      name: "Someone Else",
      email: "someone@example.com",
    });
    const visitor: Visitor = {
      ...ada,
      telegram: "@ada_photo",
      sessionType: sessionType.slug,
      comment: "Golden hour by the river, please.",
    };
    await waitPastMinimumFill(page);
    await fillForm(page, visitor);
    await submit(page, "en");

    await expect(bookingError(page, "slotTaken")).toHaveText(booking.errors.slotTaken);
    await expect(selection(page)).toHaveCount(0);
    await expect(confirmation(page)).toHaveCount(0);
    await expect(picker(page)).not.toHaveAttribute("data-selected-start");
    await expect(picker(page)).toHaveAttribute("data-selected-day", "2026-10-20");
    await expect(startButtons(page)).toHaveText([...hours(8, 17), ...hours(19, 21)]);

    const reservations = await stored(request);
    expect(reservations.map(({ id }) => id)).toEqual([other.id]);

    await startButton(page, "2026-10-20T17:00:00.000Z").click();
    await expect(bookingError(page, "slotTaken")).toHaveCount(0);
    await expect(detail(selection(page), "time")).toHaveText("19:00–20:00");
    for (const field of ["name", "email", "phone", "comment"] as const) {
      await expect(page.locator(`#booking-${field}`)).toHaveValue(visitor[field]!);
    }
    await expect(page.locator('input[type="hidden"][name="sessionType"]')).toHaveValue(
      visitor.sessionType!,
    );
    await expect(page.locator("#booking-sessionType")).toHaveText(sessionType.name.en);
    await expect(page.locator("#booking-telegram")).toHaveValue("ada_photo");

    await waitPastMinimumFill(page);
    await submit(page, "en");
    await expect(confirmation(page)).toBeVisible();
    const after = await stored(request);
    expect(after).toHaveLength(2);
    expect(after.find(({ id }) => id !== other.id)).toMatchObject({
      start: "2026-10-20T17:00:00.000Z",
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone,
      telegram: visitor.telegram,
      sessionType: visitor.sessionType,
      comment: visitor.comment,
    });
  });

  for (const skewMs of [2 * 60 * 60 * 1000, -24 * 60 * 60 * 1000]) {
    test(`a visitor whose device clock is off by ${skewMs / 3_600_000} h still reserves`, async ({
      page,
      request,
    }) => {
      await page.addInitScript((offset: number) => {
        const RealDate = Date;
        class SkewedDate extends RealDate {
          constructor(...args: ConstructorParameters<DateConstructor> | []) {
            if (args.length === 0) super(RealDate.now() + offset);
            else super(...(args as ConstructorParameters<DateConstructor>));
          }
          static now() {
            return RealDate.now() + offset;
          }
        }
        globalThis.Date = SkewedDate as DateConstructor;
      }, skewMs);
      await openForm(page, "en", "2026-10-20", "2026-10-20T16:00:00.000Z");
      expect(Math.abs((await page.evaluate(() => Date.now())) - Date.now() - skewMs)).toBeLessThan(60_000);
      await waitPastMinimumFill(page);
      await fillForm(page, ada);
      await submit(page, "en");
      await expect(confirmation(page)).toBeVisible();
      expect(await stored(request)).toHaveLength(1);
    });
  }

  test("the server refuses starts that overlap a reservation or are not bookable", async ({ request }) => {
    await fakeBooking(request, { action: "reserve", day: "2026-10-20", start: "17:00", duration: 2 });
    for (const overrides of [
      { start: "2026-10-20T16:00:00.000Z" },
      { start: "2026-10-20T14:00:00.000Z", duration: 2 },
      { start: "2026-10-18T10:00:00.000Z" },
      { start: "2026-10-19T08:00:00.000Z" },
      { start: "2026-10-12T16:00:00.000Z" },
      { start: "2027-10-13T15:00:00.000Z" },
    ]) {
      const response = await reserve(request, overrides);
      expect(response.status(), overrides.start).toBe(409);
      expect(await response.json()).toEqual({ error: "slotTaken" });
    }
    expect(await stored(request)).toHaveLength(1);
  });

  test("two simultaneous submissions for the same start leave exactly one reservation", async ({
    request,
  }) => {
    const [first, second] = await Promise.all([
      reserve(request, { name: "First Visitor", email: "first@example.com" }),
      reserve(request, { name: "Second Visitor", email: "second@example.com" }),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([201, 409]);
    const [winner, loser] = first.status() === 201 ? [first, second] : [second, first];
    const { reservation } = await winner.json();
    expect(await loser.json()).toEqual({ error: "slotTaken" });

    const reservations = await stored(request);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({ id: reservation.id, name: reservation.name });
  });

  test("a filled honeypot, a rapid submit or a malformed request is rejected without a reservation", async ({
    request,
  }) => {
    for (const overrides of [
      { website: "https://spam.example" },
      { website: "  x  " },
      { elapsedMs: 0 },
      { elapsedMs: minimumFillMs - 1 },
      { elapsedMs: -60_000 },
      { elapsedMs: undefined },
      { elapsedMs: "5000" },
      { elapsedMs: undefined, shownAt: Date.now() - 60_000 },
      { start: "2026-10-20T16:30:00.000Z" },
      { start: "not a date" },
      { duration: 4 },
      { duration: "1" },
      { locale: "de" },
    ]) {
      const response = await reserve(request, overrides);
      expect(response.status(), JSON.stringify(overrides)).toBe(400);
      expect(await response.json()).toEqual({ error: "failed" });
    }
    const malformed = await request.post("/api/booking/reserve", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    expect(malformed.status()).toBe(400);
    expect(await malformed.json()).toEqual({ error: "failed" });
    expect(await stored(request)).toEqual([]);
  });

  test("a rapid submit from the form shows the general error and creates nothing", async ({
    page,
    request,
  }) => {
    await openForm(page, "en", "2026-10-20", "2026-10-20T16:00:00.000Z");
    await page.locator("#booking-name").fill(ada.name);
    await page.locator("#booking-email").fill(ada.email);
    await page.locator("#booking-phone").fill(ada.phone);
    await submit(page, "en");
    await expect(bookingError(page, "failed")).toHaveText(texts.en.booking.errors.failed);
    await expect(confirmation(page)).toHaveCount(0);
    expect(await stored(request)).toEqual([]);
  });

  test("a filled honeypot in the form shows the general error and creates nothing", async ({
    page,
    request,
  }) => {
    await openForm(page, "pl", "2026-10-20", "2026-10-20T16:00:00.000Z");
    await waitPastMinimumFill(page);
    await fillForm(page, ada);
    await page.locator('input[name="website"]').evaluate((input: HTMLInputElement) => {
      input.value = "https://spam.example";
    });
    await submit(page, "pl");
    await expect(bookingError(page, "failed")).toHaveText(texts.pl.booking.errors.failed);
    await expect(confirmation(page)).toHaveCount(0);
    expect(await stored(request)).toEqual([]);
  });

  test("a calendar failure on submit shows the general error and a retry can succeed", async ({
    page,
    request,
  }) => {
    await openForm(page, "en", "2026-10-20", "2026-10-20T16:00:00.000Z");
    await fakeBooking(request, { action: "fail", operation: "createReservation" });
    await waitPastMinimumFill(page);
    await fillForm(page, ada);
    await submit(page, "en");

    await expect(bookingError(page, "failed")).toHaveText(texts.en.booking.errors.failed);
    await expect(form(page)).toBeVisible();
    await expect(confirmation(page)).toHaveCount(0);
    expect(await stored(request)).toEqual([]);

    await fakeBooking(request, { action: "fail", operation: "busyIntervals" });
    await submit(page, "en");
    await expect(bookingError(page, "failed")).toBeVisible();
    await expect(confirmation(page)).toHaveCount(0);
    expect(await stored(request)).toEqual([]);

    await submit(page, "en");
    await expect(confirmation(page)).toBeVisible();
    expect(await stored(request)).toHaveLength(1);
  });

  for (const operation of ["busyIntervals", "createReservation", "reservations"]) {
    test(`the server answers 503 and keeps no event when ${operation} fails`, async ({ request }) => {
      await fakeBooking(request, { action: "fail", operation });
      const response = await reserve(request);
      expect(response.status()).toBe(503);
      expect(await response.json()).toEqual({ error: "failed" });
      expect(await stored(request)).toEqual([]);
    });
  }

  test("after five reservations from one address the next one is refused", async ({ page, request }) => {
    const ip = { "X-Forwarded-For": "203.0.113.7" };
    const failed = await reserve(request, { start: "2026-10-18T10:00:00.000Z" }, ip);
    expect(failed.status()).toBe(409);
    for (let index = 0; index < reservationLimit.count; index++) {
      const start = new Date(Date.UTC(2026, 9, 20, 6 + index)).toISOString();
      const response = await reserve(request, { start }, ip);
      expect(response.status(), start).toBe(201);
    }
    const sixth = await reserve(request, { start: "2026-10-20T12:00:00.000Z" }, ip);
    expect(sixth.status()).toBe(429);
    expect(await sixth.json()).toEqual({ error: "tooMany" });
    expect(await stored(request)).toHaveLength(reservationLimit.count);

    const elsewhere = await reserve(
      request,
      { start: "2026-10-20T12:00:00.000Z" },
      { "X-Forwarded-For": "203.0.113.8" },
    );
    expect(elsewhere.status()).toBe(201);

    for (let index = 0; index < reservationLimit.count; index++) {
      const start = new Date(Date.UTC(2026, 9, 22, 6 + index)).toISOString();
      expect((await reserve(request, { start })).status()).toBe(201);
    }
    await openForm(page, "en", "2026-10-23", "2026-10-23T16:00:00.000Z");
    await waitPastMinimumFill(page);
    await fillForm(page, ada);
    await submit(page, "en");
    await expect(bookingError(page, "tooMany")).toHaveText(texts.en.booking.errors.tooMany);
    await expect(confirmation(page)).toHaveCount(0);
    expect(await stored(request)).toHaveLength(2 * reservationLimit.count + 1);
  });
});
