import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { minimumFillMs } from "../lib/booking/reservation";
import { getCategories, texts } from "../lib/content";
import type { Locale } from "../lib/i18n";
import {
  chooseDay,
  chooseDuration,
  chooseSessionType,
  daysLoaded,
  expectJustBelowHeader,
  fakeBooking,
  openBooking,
  picker,
  scrollY,
} from "./helpers";

const categories = getCategories();

function selection(page: Page) {
  return page.locator("section[data-booking-selection]");
}

function form(page: Page) {
  return page.locator("form[data-booking-form]");
}

function startButton(page: Page, start: string) {
  return page.locator(`ul[data-starts] button[data-start="${start}"]`);
}

function combobox(page: Page) {
  return page.locator("#booking-sessionType");
}

function listbox(page: Page) {
  return page.locator("#booking-sessionType-listbox");
}

function hiddenSessionType(page: Page) {
  return page.locator('input[type="hidden"][name="sessionType"]');
}

function fieldError(page: Page, field: string) {
  return page.locator(`p#booking-${field}-error[data-field-error]`);
}

async function openForm(page: Page, locale: Locale = "en", start = "2026-10-20T11:00:00.000Z") {
  await openBooking(page, locale);
  await daysLoaded(page);
  await chooseDay(page, start.slice(0, 10));
  await startButton(page, start).click();
  await expect(picker(page)).toHaveAttribute("data-selected-start", start);
  await expect(form(page)).toBeVisible();
}

async function fillValid(page: Page) {
  await page.locator("#booking-name").fill("Ada Lovelace");
  await page.locator("#booking-email").fill("ada@example.com");
  await page.locator("#booking-phone").fill("+48 123 456 789");
}

async function submit(page: Page, locale: Locale = "en") {
  await form(page).getByRole("button", { name: texts[locale].booking.form.submit, exact: true }).click();
}

function reserve(request: APIRequestContext, overrides: Record<string, unknown>) {
  return request.post("/api/booking/reserve", {
    data: {
      start: "2026-10-20T16:00:00.000Z",
      duration: 1,
      locale: "en",
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+48 123 456 789",
      website: "",
      elapsedMs: 5000,
      ...overrides,
    },
  });
}

test.describe("the booking form with the fake calendar", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  for (const duration of [2, 3]) {
    test(`a ${duration}-hour session marks every hour it covers and the summary shows the end`, async ({
      page,
    }) => {
      await openBooking(page);
      await daysLoaded(page);
      await chooseDuration(page, duration);
      await chooseDay(page, "2026-10-20");
      await startButton(page, "2026-10-20T11:00:00.000Z").click();

      const chosen = startButton(page, "2026-10-20T11:00:00.000Z");
      await expect(chosen).toHaveAttribute("aria-pressed", "true");
      await expect(chosen).not.toHaveAttribute("data-in-selection");
      await expect(page.locator('button[data-start][aria-pressed="true"]')).toHaveCount(1);
      const covered = page.locator("ul[data-starts] button[data-in-selection]");
      await expect(covered).toHaveText(duration === 2 ? ["14:00"] : ["14:00", "15:00"]);
      for (const button of await covered.all()) {
        await expect(button).not.toHaveAttribute("aria-pressed", "true");
        await expect
          .poll(() => button.evaluate((element) => getComputedStyle(element).color))
          .toBe("rgb(0, 0, 0)");
        expect(await button.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
          "rgba(0, 0, 0, 0)",
        );
      }
      await expect(selection(page).locator('[data-detail="time"] dd')).toHaveText(
        duration === 2 ? "13:00–15:00" : "13:00–16:00",
      );

      await startButton(page, "2026-10-20T17:00:00.000Z").click();
      await expect(covered).toHaveText(duration === 2 ? ["20:00"] : ["20:00", "21:00"]);
      await expect(selection(page).locator('[data-detail="time"] dd')).toHaveText(
        duration === 2 ? "19:00–21:00" : "19:00–22:00",
      );

      await chooseDuration(page, 1);
      await expect(covered).toHaveCount(0);
    });
  }

  test("free hours that cannot start the chosen duration are listed disabled and still marked", async ({
    page,
  }) => {
    await openBooking(page);
    await daysLoaded(page);
    await chooseDuration(page, 3);
    await chooseDay(page, "2026-10-19");
    const hourButtons = page.locator("ul[data-starts] button[data-hour]");
    await expect(hourButtons).toHaveText(["17:00", "18:00", "19:00", "20:00", "21:00"]);
    await expect(page.locator("ul[data-starts] button[data-hour]:enabled")).toHaveText([
      "17:00",
      "18:00",
      "19:00",
    ]);
    for (const time of ["20:00", "21:00"]) {
      const button = hourButtons.filter({ hasText: time });
      await expect(button).toBeDisabled();
      await expect(button).not.toHaveAttribute("data-start");
      await expect(button).not.toHaveAttribute("aria-pressed");
    }
    const opacity = (time: string) =>
      hourButtons.filter({ hasText: time }).evaluate((element) => getComputedStyle(element).opacity);
    await expect.poll(() => opacity("21:00")).toBe("0.3");

    const covered = page.locator("ul[data-starts] button[data-in-selection]");
    const summary = selection(page).locator('[data-detail="time"] dd');
    await startButton(page, "2026-10-19T16:00:00.000Z").click();
    await expect(startButton(page, "2026-10-19T16:00:00.000Z")).toHaveAttribute("aria-pressed", "true");
    await expect(covered).toHaveText(["19:00", "20:00"]);
    await expect(summary).toHaveText("18:00–21:00");
    await expect.poll(() => opacity("20:00")).toBe("1");

    await startButton(page, "2026-10-19T17:00:00.000Z").click();
    await expect(page.locator('ul[data-starts] button[aria-pressed="true"]')).toHaveText(["19:00"]);
    await expect(covered).toHaveText(["20:00", "21:00"]);
    await expect(summary).toHaveText("19:00–22:00");

    await hourButtons.filter({ hasText: "21:00" }).click({ force: true });
    await expect(picker(page)).toHaveAttribute("data-selected-start", "2026-10-19T17:00:00.000Z");

    await chooseDuration(page, 1);
    await expect(page.locator("ul[data-starts] button[data-hour]:disabled")).toHaveCount(0);
    await expect(hourButtons).toHaveText(["17:00", "18:00", "19:00", "20:00", "21:00"]);
  });

  test("picking a time glides the form into view and moves focus to its heading", async ({ page }) => {
    await openBooking(page);
    await daysLoaded(page);
    await chooseDay(page, "2026-10-20");
    const before = await scrollY(page);
    await startButton(page, "2026-10-20T11:00:00.000Z").click();
    await expectJustBelowHeader(page, selection(page));
    await expect(selection(page).getByRole("heading", { level: 2 })).toBeInViewport();
    await expect(page.locator("#booking-form-heading")).toBeFocused();
    expect(await scrollY(page)).toBeGreaterThan(before);

    await page.keyboard.press("Tab");
    await expect(page.locator("#booking-name")).toBeFocused();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("picking a time jumps to the form", async ({ page }) => {
      await openBooking(page);
      await daysLoaded(page);
      await chooseDay(page, "2026-10-20");
      await startButton(page, "2026-10-20T11:00:00.000Z").click();
      await expectJustBelowHeader(page, selection(page));
      await expect(page.locator("#booking-form-heading")).toBeFocused();
    });
  });

  test("the confirmation and the slot-taken message are scrolled into view", async ({ page, request }) => {
    await openForm(page);
    await page.waitForTimeout(minimumFillMs + 300);
    await fillValid(page);
    await submit(page);
    const confirmation = page.locator("section[data-booking-confirmation]");
    await expect(confirmation).toBeVisible();
    await expectJustBelowHeader(page, confirmation);
    await expect(page.locator("#booking-confirmation-heading")).toBeFocused();

    await fakeBooking(request, { action: "reset" });
    await openForm(page);
    await fakeBooking(request, { action: "reserve", day: "2026-10-20", start: "13:00" });
    await page.waitForTimeout(minimumFillMs + 300);
    await fillValid(page);
    await submit(page);
    const taken = page.locator('p[role="alert"][data-booking-error="slotTaken"]');
    await expect(taken).toBeVisible();
    await expect(taken).toBeInViewport();
    await expect(taken).toBeFocused();
  });

  test("the Telegram field shows a fixed @ and drops a typed or pasted one", async ({ page, request }) => {
    await openForm(page);
    const prefix = page.locator("[data-telegram-prefix]");
    const input = page.locator("#booking-telegram");
    await expect(prefix).toHaveText("@");
    await expect(prefix).toBeVisible();
    const prefixBox = (await prefix.boundingBox())!;
    const inputBox = (await input.boundingBox())!;
    expect(prefixBox.x).toBeGreaterThan(inputBox.x);
    expect(prefixBox.x + prefixBox.width).toBeLessThan(inputBox.x + inputBox.width);
    expect(
      Math.abs(prefixBox.y + prefixBox.height / 2 - (inputBox.y + inputBox.height / 2)),
    ).toBeLessThanOrEqual(2);

    await input.fill("@ada_photo");
    await expect(input).toHaveValue("ada_photo");
    await input.fill("");
    await input.pressSequentially("@@ada");
    await expect(input).toHaveValue("ada");
    await input.fill("");
    await input.focus();
    await page.keyboard.insertText(" @ada_photo");
    await expect(input).toHaveValue("ada_photo");

    await page.waitForTimeout(minimumFillMs + 300);
    await fillValid(page);
    await submit(page);
    await expect(page.locator("section[data-booking-confirmation]")).toBeVisible();
    const stored = (await (await request.get("/api/booking/fake")).json()).reservations;
    expect(stored.map((reservation: { telegram: string }) => reservation.telegram)).toEqual(["@ada_photo"]);
  });

  for (const locale of ["en", "pl"] as const) {
    test(`/${locale}/booking checks each contact field on blur and on submit before sending`, async ({
      page,
    }) => {
      const { errors } = texts[locale].booking;
      const sent: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/booking/reserve")) sent.push(request.url());
      });
      await openForm(page, locale);

      const cases = [
        { field: "name", empty: "name", bad: ["1", "12345", "A"], good: "Ada" },
        {
          field: "email",
          empty: "email",
          bad: ["ada", "ada@example", "a..b@example.com", ".ada@example.com", "ada@example.c", "a da@example.com"],
          good: "ada@example.com",
        },
        {
          field: "phone",
          empty: "phone",
          bad: ["123456", "48+123456789", "1234567890123456", "123.456.789"],
          good: "+48 123 456 789",
        },
        { field: "telegram", empty: null, bad: ["ada", "5ada_photo", "_ada_photo", "ada_photo_"], good: "ada_photo" },
      ] as const;

      for (const { field, empty, bad, good } of cases) {
        const input = page.locator(`#booking-${field}`);
        const error = fieldError(page, field);
        await input.focus();
        await input.blur();
        if (empty) {
          await expect(error).toHaveText(errors[empty]);
          await expect(input).toHaveAttribute("aria-invalid", "true");
          await expect(input).toHaveAttribute("aria-describedby", `booking-${field}-error`);
        } else {
          await expect(error).toHaveCount(0);
        }
        for (const value of bad) {
          await input.fill(value);
          await input.blur();
          const key = field === "name" ? "nameInvalid" : field === "telegram" ? "telegram" : `${field}Invalid`;
          await expect(error, value).toHaveText(errors[key as keyof typeof errors]);
          await expect(input).toHaveAttribute("aria-invalid", "true");
        }
        await input.fill(good);
        await expect(error).toHaveCount(0);
        await expect(input).not.toHaveAttribute("aria-invalid");
        await expect(input).not.toHaveAttribute("aria-describedby");
        await input.fill("");
        await input.blur();
      }

      await page.locator("#booking-email").fill("ada@example");
      await page.locator("#booking-telegram").fill("ada-photo");
      await submit(page, locale);
      await expect(fieldError(page, "name")).toHaveText(errors.name);
      await expect(fieldError(page, "email")).toHaveText(errors.emailInvalid);
      await expect(fieldError(page, "phone")).toHaveText(errors.phone);
      await expect(fieldError(page, "telegram")).toHaveText(errors.telegram);
      await expect(page.locator("[data-field-error]")).toHaveCount(4);
      await expect(page.locator("#booking-name")).toBeFocused();
      expect(sent).toEqual([]);
    });
  }

  test("the server rejects the same malformed contact details", async ({ request }) => {
    const cases: [string, unknown, string][] = [
      ["name", "12345", "nameInvalid"],
      ["name", "A", "nameInvalid"],
      ["email", "a..b@example.com", "emailInvalid"],
      ["email", "ada.@example.com", "emailInvalid"],
      ["email", "ada@example", "emailInvalid"],
      ["email", "ada @example.com", "emailInvalid"],
      ["phone", "48+123456789", "phoneInvalid"],
      ["phone", "1234567890123456", "phoneInvalid"],
      ["telegram", "5ada_photo", "telegram"],
      ["telegram", "ada_photo_", "telegram"],
    ];
    for (const [field, value, key] of cases) {
      const response = await reserve(request, { [field]: value });
      expect(response.status(), `${field} ${value}`).toBe(400);
      expect(await response.json()).toEqual({ error: "validation", fields: { [field]: key } });
    }
    expect((await (await request.get("/api/booking/fake")).json()).reservations).toEqual([]);
  });

  test("the session type list works from the keyboard", async ({ page }) => {
    await openForm(page);
    const box = combobox(page);
    const options = listbox(page).getByRole("option");
    const labels = [texts.en.booking.form.sessionTypeNone, ...categories.map((category) => category.name.en)];

    await expect(box).toHaveAttribute("role", "combobox");
    await expect(box).toHaveAttribute("aria-labelledby", "booking-sessionType-label");
    await expect(form(page).getByRole("combobox", { name: texts.en.booking.form.sessionType })).toHaveCount(1);
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(listbox(page)).toHaveCount(0);

    await page.locator("#booking-telegram").focus();
    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(options).toHaveText(labels);
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(box).toHaveAttribute("aria-activedescendant", "booking-sessionType-option-0");

    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "booking-sessionType-option-1");
    await page.keyboard.press("End");
    await expect(box).toHaveAttribute("aria-activedescendant", `booking-sessionType-option-${labels.length - 1}`);
    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", `booking-sessionType-option-${labels.length - 1}`);
    await page.keyboard.press("Home");
    await expect(box).toHaveAttribute("aria-activedescendant", "booking-sessionType-option-0");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(box).toBeFocused();
    await expect(hiddenSessionType(page)).toHaveValue("");

    await page.keyboard.press("Enter");
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(box).toBeFocused();
    await expect(hiddenSessionType(page)).toHaveValue(categories[0].slug);
    await expect(box).toHaveText(categories[0].name.en);

    await page.keyboard.press(" ");
    await expect(box).toHaveAttribute("aria-activedescendant", "booking-sessionType-option-1");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await page.keyboard.press(" ");
    await expect(hiddenSessionType(page)).toHaveValue("");

    const target = categories[categories.length - 1];
    const letter = target.name.en[0].toLowerCase();
    const expected = labels.findIndex((label, index) => index > 0 && label.toLowerCase().startsWith(letter));
    await page.keyboard.press(letter);
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(box).toHaveAttribute("aria-activedescendant", `booking-sessionType-option-${expected}`);
    await page.keyboard.press("Tab");
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#booking-comment")).toBeFocused();
    await expect(hiddenSessionType(page)).toHaveValue(categories[expected - 1].slug);
  });

  test("the session type list works with the pointer and closes on an outside click", async ({ page }) => {
    await openForm(page);
    const box = combobox(page);
    await box.click();
    await expect(listbox(page)).toBeVisible();
    const colors = await listbox(page).evaluate((element) => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, color: computed.color };
    });
    expect(colors).toEqual({ background: "rgb(0, 0, 0)", color: "rgb(255, 255, 255)" });

    await page.locator("#booking-form-heading").click();
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(listbox(page)).toHaveCount(0);

    await page.locator("#booking-sessionType-label").click();
    await expect(box).toBeFocused();

    const last = categories[categories.length - 1];
    await chooseSessionType(page, last.slug);
    await expect(box).toHaveText(last.name.en);
    await box.click();
    await expect(listbox(page).locator(`[role="option"][data-value="${last.slug}"]`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await box.click();
    await expect(listbox(page)).toHaveCount(0);
    await expect(hiddenSessionType(page)).toHaveValue(last.slug);
  });
});

test.describe("the session type list on every device", () => {
  test("it opens and picks an option by tap or click in Polish", async ({ page, isMobile }) => {
    await openForm(page, "pl");
    const box = combobox(page);
    const option = listbox(page).locator(`[role="option"][data-value="${categories[0].slug}"]`);
    if (isMobile) await box.tap();
    else await box.click();
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(listbox(page).getByRole("option")).toHaveText([
      texts.pl.booking.form.sessionTypeNone,
      ...categories.map((category) => category.name.pl),
    ]);
    if (isMobile) await option.tap();
    else await option.click();
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await expect(box).toHaveText(categories[0].name.pl);
    await expect(hiddenSessionType(page)).toHaveValue(categories[0].slug);
  });

  test("the Telegram @ stays put on every device", async ({ page }) => {
    await openForm(page);
    await expect(page.locator("[data-telegram-prefix]")).toBeVisible();
    await page.locator("#booking-telegram").fill("@ada_photo");
    await expect(page.locator("#booking-telegram")).toHaveValue("ada_photo");
  });
});
