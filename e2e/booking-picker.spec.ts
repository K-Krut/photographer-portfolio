import { expect, test, type Page } from "@playwright/test";
import { currency, texts } from "../lib/content";
import { sessionPrice } from "../lib/booking/price";
import { locales } from "../lib/i18n";
import {
  calendar,
  chooseDay,
  chooseDuration,
  dayButton,
  daysLoaded,
  daysOf,
  durationButton,
  enabledDays,
  fakeBooking,
  hours,
  monthButton,
  monthLabel,
  openBooking,
  picker,
  startButtons,
  timePicker,
} from "./helpers";

const octoberDays = daysOf("2026-10", (day, weekday) => day >= "2026-10-13" && weekday !== 0);
const horizonDays = daysOf("2027-10", (day, weekday) => day <= "2027-10-12" && weekday !== 0);

const monthNames = {
  en: {
    "2026-10": "October 2026",
    "2026-11": "November 2026",
    "2026-12": "December 2026",
    "2027-10": "October 2027",
  },
  pl: {
    "2026-10": "październik 2026",
    "2026-11": "listopad 2026",
    "2026-12": "grudzień 2026",
    "2027-10": "październik 2027",
  },
};

const monthsToHorizon = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 10 + index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
});

async function goToMonth(page: Page, month: string) {
  const next = monthButton(page, "nextMonth");
  for (const step of monthsToHorizon) {
    await next.click();
    await expect(monthLabel(page, step)).toBeVisible();
    if (step === month) return;
  }
}

const weekdayNames = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  pl: ["pon.", "wt.", "śr.", "czw.", "pt.", "sob.", "niedz."],
};

const dayNames = {
  en: "Tuesday, October 13, 2026",
  pl: "wtorek, 13 października 2026",
};

function price(page: Page) {
  return timePicker(page).locator("span[data-price]");
}

function pressedDays(page: Page) {
  return page.locator('button[data-day][aria-pressed="true"]');
}

function pressedStarts(page: Page) {
  return page.locator('button[data-start][aria-pressed="true"]');
}

function calendarAlert(page: Page) {
  return calendar(page).getByRole("alert");
}

function timesAlert(page: Page) {
  return timePicker(page).getByRole("alert");
}

for (const locale of locales) {
  const { booking } = texts[locale];

  test(`/${locale}/booking opens on the current month with 1 hour chosen and the Warsaw note once`, async ({
    page,
  }) => {
    await openBooking(page, locale);
    const section = page.locator("#booking");
    await expect(
      calendar(page).getByRole("heading", { level: 2, name: booking.calendar.label }),
    ).toBeVisible();
    await expect(monthLabel(page, "2026-10")).toHaveText(monthNames[locale]["2026-10"]);
    await expect(page.locator("p[data-month]")).toHaveCount(1);

    await expect(
      section.getByRole("heading", { level: 2, name: booking.duration.label }),
    ).toBeVisible();
    for (const duration of [1, 2, 3]) {
      await expect(durationButton(page, duration)).toHaveText(booking.duration.hours(duration));
      await expect(durationButton(page, duration)).toHaveAttribute(
        "aria-pressed",
        duration === 1 ? "true" : "false",
      );
    }
    await expect(picker(page)).toHaveAttribute("data-duration", "1");
    await expect(section.getByText(booking.price, { exact: true })).toBeVisible();
    await expect(price(page)).toHaveText(`${sessionPrice(1)} ${currency}`);

    await expect(section.getByRole("heading", { level: 2, name: booking.times.label })).toBeVisible();
    await expect(section.getByText(booking.timeZoneNote, { exact: true })).toHaveCount(1);
    await expect(timePicker(page).getByText(booking.times.chooseDay, { exact: true })).toBeVisible();
    await expect(startButtons(page)).toHaveCount(0);
    await expect(picker(page)).not.toHaveAttribute("data-selected-day", /./);
    await expect(picker(page)).not.toHaveAttribute("data-selected-start", /./);
  });

  test(`/${locale}/booking lays the weeks out from Monday and names the days in full`, async ({
    page,
  }) => {
    await openBooking(page, locale);
    const cells = page.locator("[data-days] > *");
    await expect(cells.nth(0)).toHaveText(weekdayNames[locale][0]);
    await expect(cells.nth(6)).toHaveText(weekdayNames[locale][6]);
    expect(await cells.evaluateAll((items) => items.slice(0, 7).map((item) => item.textContent))).toEqual(
      weekdayNames[locale],
    );
    await expect(cells.nth(7 + 3).locator("button")).toHaveAttribute("data-day", "2026-10-01");
    await expect(cells.nth(7 + 3 + 30).locator("button")).toHaveAttribute("data-day", "2026-10-31");
    await expect(page.locator("button[data-day]")).toHaveCount(31);
    await expect(page.locator("button[data-day]").nth(12)).toHaveText("13");
    await expect(calendar(page).getByRole("button", { name: dayNames[locale], exact: true })).toHaveAttribute(
      "data-day",
      "2026-10-13",
    );
  });

  test(`/${locale}/booking moves between the current month and the horizon month only`, async ({
    page,
  }) => {
    await openBooking(page, locale);
    const previous = monthButton(page, "previousMonth", locale);
    const next = monthButton(page, "nextMonth", locale);
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    await next.click();
    await expect(monthLabel(page, "2026-11")).toHaveText(monthNames[locale]["2026-11"]);
    await expect(previous).toBeEnabled();
    await expect(next).toBeEnabled();
    await expect(page.locator("button[data-day]")).toHaveCount(30);

    await next.click();
    await expect(monthLabel(page, "2026-12")).toHaveText(monthNames[locale]["2026-12"]);
    await expect(next).toBeEnabled();

    for (const month of monthsToHorizon.slice(2)) {
      await next.click();
      await expect(monthLabel(page, month)).toBeVisible();
    }
    await expect(monthLabel(page, "2027-10")).toHaveText(monthNames[locale]["2027-10"]);
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
    await expect(page.locator("button[data-day]")).toHaveCount(31);

    for (const month of monthsToHorizon.slice(0, 11).reverse()) {
      await previous.click();
      await expect(monthLabel(page, month)).toBeVisible();
    }
    await previous.click();
    await expect(monthLabel(page, "2026-10")).toHaveText(monthNames[locale]["2026-10"]);
    await expect(previous).toBeDisabled();
  });
}

test.describe("with the fake calendar", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ browserName }) => browserName !== "chromium", "the fake store is shared by all projects");

  test.beforeEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test.afterEach(async ({ request }) => {
    await fakeBooking(request, { action: "reset" });
  });

  test("days of October follow the weekly pattern and disabled days look like any other", async ({
    page,
  }) => {
    await openBooking(page);
    await daysLoaded(page);
    await expect.poll(() => enabledDays(page)).toEqual(octoberDays);
    await expect(pressedDays(page)).toHaveCount(0);

    const buttons = await page.locator("button[data-day]").evaluateAll((items) =>
      items.map((item) => ({
        day: item.getAttribute("data-day"),
        text: item.textContent,
        disabled: item.hasAttribute("disabled"),
        rest: Array.from(item.attributes)
          .filter((attribute) => !["data-day", "aria-label", "disabled"].includes(attribute.name))
          .map((attribute) => `${attribute.name}=${attribute.value}`)
          .sort()
          .join(" "),
      })),
    );
    expect(buttons.map(({ day, text }) => [day, text])).toEqual(
      daysOf("2026-10", () => true).map((day) => [day, String(Number(day.slice(8)))]),
    );
    expect(buttons.filter(({ disabled }) => disabled).map(({ day }) => day)).toEqual(
      daysOf("2026-10", (day) => !octoberDays.includes(day)),
    );
    expect(new Set(buttons.map(({ rest }) => rest)).size).toBe(1);
  });

  test("a Monday offers 17:00 to 21:00 and a Tuesday 08:00 to 21:00", async ({ page }) => {
    await openBooking(page);
    await chooseDay(page, "2026-10-19");
    await expect(startButtons(page)).toHaveText(hours(17, 21));
    await expect(startButtons(page).first()).toHaveAttribute("data-start", "2026-10-19T15:00:00.000Z");
    await expect(pressedDays(page)).toHaveCount(1);

    await chooseDay(page, "2026-10-20");
    await expect(dayButton(page, "2026-10-19")).toHaveAttribute("aria-pressed", "false");
    await expect(startButtons(page)).toHaveText(hours(8, 21));
    await expect(startButtons(page).first()).toHaveAttribute("data-start", "2026-10-20T06:00:00.000Z");
    await expect(timePicker(page).getByRole("button", { name: "08:00", exact: true })).toBeVisible();
    await expect(pressedStarts(page)).toHaveCount(0);
    await expect(timePicker(page).getByText(texts.en.booking.times.chooseDay)).toHaveCount(0);

    await chooseDay(page, "2026-10-21");
    await expect(startButtons(page)).toHaveText(hours(17, 21));
  });

  test("the duration filters the starts and changes the price", async ({ page, request }) => {
    await fakeBooking(request, { action: "block", day: "2026-10-20", from: "08:00", to: "18:00" });
    await fakeBooking(request, { action: "block", day: "2026-10-20", from: "21:00", to: "22:00" });
    await openBooking(page);
    await chooseDay(page, "2026-10-20");
    await expect(startButtons(page)).toHaveText(["18:00", "19:00", "20:00"]);

    await chooseDuration(page, 3);
    await expect(durationButton(page, 1)).toHaveAttribute("aria-pressed", "false");
    await expect(price(page)).toHaveText(`${sessionPrice(3)} ${currency}`);
    await expect(startButtons(page)).toHaveText(["18:00"]);
    await expect(picker(page)).toHaveAttribute("data-selected-day", "2026-10-20");

    await chooseDuration(page, 2);
    await expect(price(page)).toHaveText(`${sessionPrice(2)} ${currency}`);
    await expect(startButtons(page)).toHaveText(["18:00", "19:00"]);

    await chooseDuration(page, 1);
    await expect(price(page)).toHaveText(`${sessionPrice(1)} ${currency}`);
    await expect(startButtons(page)).toHaveText(["18:00", "19:00", "20:00"]);

    await chooseDuration(page, 3);
    await chooseDay(page, "2026-10-22");
    await expect(startButtons(page)).toHaveText(hours(8, 19));
  });

  test("a reservation hides the overlapping starts without revealing who booked", async ({
    page,
    request,
  }) => {
    const reservation = await fakeBooking(request, {
      action: "reserve",
      day: "2026-10-22",
      start: "10:00",
      duration: 2,
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+48 600 700 800",
    });
    await openBooking(page);
    await chooseDuration(page, 2);
    await chooseDay(page, "2026-10-22");
    await expect(startButtons(page)).toHaveText(["08:00", ...hours(12, 20)]);

    const html = await page.content();
    for (const secret of ["Ada", "Lovelace", "ada@example.com", "600 700 800", reservation.id]) {
      expect(html).not.toContain(secret);
    }

    await chooseDuration(page, 1);
    await expect(startButtons(page)).toHaveText(["08:00", "09:00", ...hours(12, 21)]);
  });

  test("a fully covered day is disabled and the marks follow the duration", async ({
    page,
    request,
  }) => {
    await fakeBooking(request, { action: "block", day: "2026-10-23", from: "08:00", to: "15:00" });
    await fakeBooking(request, { action: "reserve", day: "2026-10-23", start: "15:00", duration: 3 });
    await fakeBooking(request, { action: "reserve", day: "2026-10-23", start: "18:00", duration: 3 });
    await fakeBooking(request, { action: "block", day: "2026-10-30" });
    await openBooking(page);
    await daysLoaded(page);
    await expect(dayButton(page, "2026-10-30")).toBeDisabled();
    await expect.poll(() => enabledDays(page)).toEqual(
      octoberDays.filter((day) => day !== "2026-10-30"),
    );

    await chooseDay(page, "2026-10-23");
    await expect(startButtons(page)).toHaveText(["21:00"]);

    await chooseDuration(page, 2);
    await expect(dayButton(page, "2026-10-23")).toBeDisabled();
    await expect(dayButton(page, "2026-10-23")).toHaveAttribute("aria-pressed", "false");
    await expect(picker(page)).not.toHaveAttribute("data-selected-day", /./);
    await expect(timePicker(page).getByText(texts.en.booking.times.chooseDay)).toBeVisible();
    await expect(startButtons(page)).toHaveCount(0);
    await expect.poll(() => enabledDays(page)).toEqual(
      octoberDays.filter((day) => day !== "2026-10-23" && day !== "2026-10-30"),
    );

    await fakeBooking(request, { action: "reserve", day: "2026-10-23", start: "21:00", duration: 1 });
    await chooseDuration(page, 1);
    await daysLoaded(page);
    await expect(dayButton(page, "2026-10-23")).toBeDisabled();
    await expect.poll(() => enabledDays(page)).toEqual(
      octoberDays.filter((day) => day !== "2026-10-23" && day !== "2026-10-30"),
    );
  });

  test("busy time ending on a half hour leaves the next whole hour as the first start", async ({
    page,
    request,
  }) => {
    await fakeBooking(request, { action: "block", day: "2026-10-19", from: "08:00", to: "18:30" });
    await openBooking(page);
    await chooseDay(page, "2026-10-19");
    await expect(startButtons(page)).toHaveText(["19:00", "20:00", "21:00"]);
    await chooseDuration(page, 2);
    await expect(startButtons(page)).toHaveText(["19:00", "20:00"]);
    await chooseDuration(page, 3);
    await expect(startButtons(page)).toHaveText(["19:00"]);
  });

  test("a block added by hand is cut out of an open day like a reservation", async ({
    page,
    request,
  }) => {
    await fakeBooking(request, { action: "block", day: "2026-10-20", from: "12:00", to: "14:00" });
    await openBooking(page);
    await chooseDay(page, "2026-10-20");
    await expect(startButtons(page)).toHaveText([...hours(8, 11), ...hours(14, 21)]);
    await chooseDuration(page, 2);
    await expect(startButtons(page)).toHaveText([...hours(8, 10), ...hours(14, 20)]);
  });

  test("nothing before the lead time or past the horizon, and the chosen day survives navigation", async ({
    page,
  }) => {
    await openBooking(page);
    await daysLoaded(page);
    await expect(dayButton(page, "2026-10-12")).toBeDisabled();
    await expect(dayButton(page, "2026-10-11")).toBeDisabled();
    await chooseDay(page, "2026-10-13");
    await expect(startButtons(page)).toHaveText(hours(10, 21));

    const next = monthButton(page, "nextMonth");
    const previous = monthButton(page, "previousMonth");
    await goToMonth(page, "2027-10");
    await expect(next).toBeDisabled();
    await daysLoaded(page);
    await expect.poll(() => enabledDays(page)).toEqual(horizonDays);
    await expect(dayButton(page, "2027-10-13")).toBeDisabled();
    await expect(dayButton(page, "2027-10-31")).toBeDisabled();
    await expect(pressedDays(page)).toHaveCount(0);
    await expect(picker(page)).toHaveAttribute("data-selected-day", "2026-10-13");
    await expect(startButtons(page)).toHaveText(hours(10, 21));

    await chooseDay(page, "2027-10-12");
    await expect(startButtons(page)).toHaveText(hours(8, 21));
    await chooseDay(page, "2027-10-11");
    await expect(startButtons(page)).toHaveText(hours(17, 21));

    await previous.click();
    await expect(monthLabel(page, "2027-09")).toBeVisible();
    await daysLoaded(page);
    await expect.poll(() => enabledDays(page)).toEqual(
      daysOf("2027-09", (day, weekday) => weekday !== 0),
    );
    await expect(pressedDays(page)).toHaveCount(0);
    await expect(picker(page)).toHaveAttribute("data-selected-day", "2027-10-11");
    await expect(startButtons(page)).toHaveText(hours(17, 21));

    await next.click();
    await expect(monthLabel(page, "2027-10")).toBeVisible();
    await expect(dayButton(page, "2027-10-11")).toHaveAttribute("aria-pressed", "true");
    await expect(pressedDays(page)).toHaveCount(1);
  });

  test("choosing a start marks it and a change of duration or day clears it", async ({ page }) => {
    await openBooking(page);
    await chooseDay(page, "2026-10-20");
    await timePicker(page).getByRole("button", { name: "10:00", exact: true }).click();
    await expect(page.locator('button[data-start="2026-10-20T08:00:00.000Z"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(pressedStarts(page)).toHaveCount(1);
    await expect(picker(page)).toHaveAttribute("data-selected-start", "2026-10-20T08:00:00.000Z");

    await timePicker(page).getByRole("button", { name: "15:00", exact: true }).click();
    await expect(picker(page)).toHaveAttribute("data-selected-start", "2026-10-20T13:00:00.000Z");
    await expect(pressedStarts(page)).toHaveText("15:00");

    await chooseDuration(page, 2);
    await expect(startButtons(page)).toHaveText(hours(8, 20));
    await expect(pressedStarts(page)).toHaveCount(0);
    await expect(picker(page)).not.toHaveAttribute("data-selected-start", /./);

    await timePicker(page).getByRole("button", { name: "15:00", exact: true }).click();
    await expect(picker(page)).toHaveAttribute("data-selected-start", "2026-10-20T13:00:00.000Z");

    await chooseDay(page, "2026-10-22");
    await expect(startButtons(page)).toHaveText(hours(8, 20));
    await expect(pressedStarts(page)).toHaveCount(0);
    await expect(picker(page)).not.toHaveAttribute("data-selected-start", /./);
  });

  test("an unreachable calendar shows an error with retry in place of the days and the hours", async ({
    page,
    request,
  }) => {
    const { times } = texts.en.booking;
    await fakeBooking(request, { action: "fail", operation: "busyIntervals" });
    await openBooking(page);
    const alert = calendarAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(times.error);
    await expect(page.locator("button[data-day]:enabled")).toHaveCount(0);
    await expect(timesAlert(page)).toHaveCount(0);
    await expect(timePicker(page).getByText(times.chooseDay)).toBeVisible();
    await expect(monthButton(page, "nextMonth")).toBeEnabled();

    await alert.getByRole("button", { name: times.retry, exact: true }).click();
    await expect(calendarAlert(page)).toHaveCount(0);
    await daysLoaded(page);
    await expect.poll(() => enabledDays(page)).toEqual(octoberDays);

    await fakeBooking(request, { action: "fail", operation: "busyIntervals" });
    await chooseDay(page, "2026-10-20");
    const timesError = timesAlert(page);
    await expect(timesError).toBeVisible();
    await expect(timesError).toContainText(times.error);
    await expect(startButtons(page)).toHaveCount(0);
    await expect(calendarAlert(page)).toHaveCount(0);
    await expect.poll(() => enabledDays(page)).toEqual(octoberDays);

    await timesError.getByRole("button", { name: times.retry, exact: true }).click();
    await expect(timesAlert(page)).toHaveCount(0);
    await expect(startButtons(page)).toHaveText(hours(8, 21));
  });
});
