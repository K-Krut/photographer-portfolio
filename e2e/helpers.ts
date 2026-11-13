import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { getCategories, site, texts, type CategorySlug } from "../lib/content";
import type { Locale } from "../lib/i18n";

export function category(slug: CategorySlug) {
  return getCategories().find((item) => item.slug === slug)!;
}

export function absolute(path: string) {
  return new URL(path, site.url).toString();
}

export function headLinks(page: Page, selector: string, attribute: string) {
  return page
    .locator(`head ${selector}`)
    .evaluateAll(
      (elements, name) =>
        elements.map((element) => [element.getAttribute(name), element.getAttribute("href")]),
      attribute,
    );
}

export function meta(page: Page, selector: string) {
  return page.locator(`head meta[${selector}]`).getAttribute("content");
}

export function languageAlternates(path: string) {
  return [
    ["en", absolute(`/en${path}`)],
    ["pl", absolute(`/pl${path}`)],
    ["x-default", absolute(`/en${path}`)],
  ];
}

function pageScroller() {
  return matchMedia("(hover: none) and (pointer: coarse)").matches
    ? document.body
    : document.documentElement;
}

export function scrollY(page: Page) {
  return page.evaluate(`(${pageScroller})().scrollTop`) as Promise<number>;
}

export function scrollOverflow(page: Page) {
  return page.evaluate(`getComputedStyle((${pageScroller})()).overflow`) as Promise<string>;
}

export function scrollPageTo(page: Page, top: number | "bottom") {
  return page.evaluate(
    `(() => { const element = (${pageScroller})(); element.scrollTo({ top: ${JSON.stringify(top)} === "bottom" ? element.scrollHeight : ${JSON.stringify(top)}, behavior: "instant" }); })()`,
  );
}

export async function settledScroll(page: Page) {
  await expect
    .poll(async () => {
      const before = await scrollY(page);
      await page.waitForTimeout(150);
      return before === (await scrollY(page));
    })
    .toBe(true);
  return scrollY(page);
}

export async function expectJustBelowHeader(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const header = (await page.locator("header").boundingBox())!;
      const offset = (await target.boundingBox())!.y - (header.y + header.height);
      const atBottom = (await page.evaluate(
        `(() => { const element = (${pageScroller})(); return Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight; })()`,
      )) as boolean;
      return offset >= -1 && (offset <= 120 || atBottom);
    })
    .toBe(true);
}

export function sourcePath(src: string) {
  const url = new URL(src, "http://localhost");
  return url.searchParams.get("url") ?? url.pathname;
}

export function landingCard(page: Page, slug: CategorySlug, locale: Locale = "en") {
  return page.locator(`#portfolio a[href="/${locale}/portfolio/${slug}"]`);
}

export function collectionsCard(page: Page, slug: CategorySlug, locale: Locale = "en") {
  return page.locator(`#collections a[href="/${locale}/portfolio/${slug}"]`);
}

export function galleryHeading(page: Page, slug: CategorySlug, locale: Locale = "en") {
  return page.getByRole("heading", { level: 1, name: category(slug).name[locale], exact: true });
}

export function backLink(page: Page) {
  return page.locator("[data-back-link]").filter({ visible: true });
}

export function currentMain(page: Page) {
  return page.locator("main").filter({ visible: true });
}

export async function transitionsDone(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          !(animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
            "::view-transition",
          ),
      ),
  );
}

export async function openFromCard(page: Page, link: Locator, slug: CategorySlug) {
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport({ ratio: 0.95 });
  const before = await settledScroll(page);
  await link.click();
  await expect(page).toHaveURL(`/en/portfolio/${slug}`);
  await expect(galleryHeading(page, slug)).toBeVisible();
  await expect(currentMain(page).getByRole("listitem").first()).toBeVisible();
  await transitionsDone(page);
  return { scrollY: before };
}

export function viewer(page: Page, locale: Locale = "en") {
  return page.getByRole("dialog", { name: texts[locale].viewer.label });
}

export function currentPhoto(page: Page) {
  return page.locator(".yarl__slide_current img").filter({ visible: true });
}

export function photoButton(
  scope: Page | Locator,
  slug: CategorySlug,
  index: number,
  locale: Locale = "en",
) {
  return scope.getByRole("button", { name: category(slug).photos[index].alt[locale], exact: true });
}

export async function expectPhoto(page: Page, slug: CategorySlug, index: number) {
  const { photos } = category(slug);
  await expect(page.locator(".yarl__counter")).toHaveText(`${index + 1} / ${photos.length}`);
  await expect(currentPhoto(page)).toHaveAttribute("alt", photos[index].alt.en);
}

export async function openPhoto(page: Page, slug: CategorySlug, index: number) {
  await page.goto(`/en/portfolio/${slug}`);
  await photoButton(page, slug, index).click();
  await expect(viewer(page)).toBeVisible();
  await expect(currentPhoto(page)).toBeVisible();
}

export async function settledPhotoWidth(page: Page) {
  const image = currentPhoto(page);
  await expect(image).toHaveJSProperty("complete", true);
  let previous = -1;
  await expect
    .poll(
      async () => {
        const width = (await image.boundingBox())!.width;
        const stable = width === previous;
        previous = width;
        return stable;
      },
      { intervals: [200] },
    )
    .toBe(true);
  return previous;
}

export async function expectZoomedIn(page: Page, initial: number) {
  await expect
    .poll(async () => (await currentPhoto(page).boundingBox())!.width)
    .toBeGreaterThan(initial * 1.2);
}

export async function expectZoomedOut(page: Page, initial: number) {
  await expect
    .poll(async () => Math.abs((await currentPhoto(page).boundingBox())!.width - initial))
    .toBeLessThan(1);
}

export async function photoCenter(page: Page) {
  const box = (await currentPhoto(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function holdImages(
  page: Page,
  matches: (src: string | null) => boolean = () => true,
) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === "/_next/image" && matches(url.searchParams.get("url")),
    async (route) => {
      await released;
      await route.continue().catch(() => {});
    },
  );
  return release;
}

export function menuButton(page: Page) {
  return page.locator("header").locator('button[aria-controls="site-menu"]');
}

export async function openMenu(page: Page) {
  const toggle = menuButton(page);
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass();
}

export async function headerLink(page: Page, name: string) {
  if (await menuButton(page).isVisible()) await openMenu(page);
  return page.locator("header").getByRole("link", { name, exact: true });
}

export async function fakeBooking(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post("/api/booking/fake", { data: body });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

export function hours(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, "0")}:00`);
}

export function daysOf(month: string, keep: (day: string, weekday: number) => boolean): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(
    (day) => keep(day, new Date(`${day}T00:00:00Z`).getUTCDay()),
  );
}

export function picker(page: Page) {
  return page.locator("[data-booking-picker]");
}

export function calendar(page: Page) {
  return page.locator("[data-calendar]");
}

export function timePicker(page: Page) {
  return page.locator("[data-time-picker]");
}

export function dayButton(page: Page, day: string) {
  return page.locator(`button[data-day="${day}"]`);
}

export function durationButton(page: Page, duration: number) {
  return page.locator(`button[data-duration-option="${duration}"]`);
}

export function startButtons(page: Page) {
  return page.locator("ul[data-starts] button[data-start]");
}

export function monthLabel(page: Page, month: string) {
  return page.locator(`p[data-month="${month}"]`);
}

export function monthButton(page: Page, direction: "previousMonth" | "nextMonth", locale: Locale = "en") {
  return calendar(page).getByRole("button", {
    name: texts[locale].booking.calendar[direction],
    exact: true,
  });
}

export function enabledDays(page: Page) {
  return page
    .locator("button[data-day]:enabled")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-day")));
}

export async function openBooking(page: Page, locale: Locale = "en") {
  await page.goto(`/${locale}/booking`);
  await expect(picker(page)).toBeVisible();
}

export async function daysLoaded(page: Page) {
  await expect(page.locator("[data-days]")).toHaveAttribute("aria-busy", "false");
}

export async function chooseDay(page: Page, day: string) {
  await dayButton(page, day).click();
  await expect(dayButton(page, day)).toHaveAttribute("aria-pressed", "true");
  await expect(picker(page)).toHaveAttribute("data-selected-day", day);
}

export async function chooseDuration(page: Page, duration: number) {
  await durationButton(page, duration).click();
  await expect(durationButton(page, duration)).toHaveAttribute("aria-pressed", "true");
  await expect(picker(page)).toHaveAttribute("data-duration", String(duration));
}

export async function chooseSessionType(page: Page, slug: string) {
  const combobox = page.locator("#booking-sessionType");
  await combobox.click();
  await expect(combobox).toHaveAttribute("aria-expanded", "true");
  await page.locator(`#booking-sessionType-listbox [role="option"][data-value="${slug}"]`).click();
  await expect(combobox).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('input[type="hidden"][name="sessionType"]')).toHaveValue(slug);
}
