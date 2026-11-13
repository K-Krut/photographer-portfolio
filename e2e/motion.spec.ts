import { expect, test, type Page } from "@playwright/test";
import { texts } from "../lib/content";
import {
  backLink,
  expectJustBelowHeader,
  headerLink,
  landingCard,
  openFromCard,
  photoButton,
  scrollPageTo,
  scrollY,
  settledScroll,
  viewer,
} from "./helpers";

function lenisActive(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("lenis"));
}

function lenisStopped(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("lenis-stopped"));
}

async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

test.describe("smooth scrolling on desktop", () => {
  test.skip(({ hasTouch }) => hasTouch, "smooth scrolling is for mouse and trackpad");

  test("the wheel scrolls the page smoothly", async ({ page }) => {
    await page.goto("/en");
    await expect.poll(() => lenisActive(page)).toBe(true);
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500);
  });

  test("a header anchor from another page lands below the header", async ({ page }) => {
    await page.goto("/en/portfolio/events");
    await expect.poll(() => lenisActive(page)).toBe(true);
    await scrollPageTo(page, 600);
    await settledScroll(page);
    await page.locator("header").getByRole("link", { name: texts.en.nav.price }).click();
    await expect(page).toHaveURL("/en#price");
    await expectJustBelowHeader(
      page,
      page.getByRole("heading", { level: 2, name: texts.en.headings.price }),
    );
  });

  test("the wheel scrolls a gallery page and the landing again after the arrow", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect.poll(() => lenisActive(page)).toBe(true);
    const { scrollY: before } = await openFromCard(page, landingCard(page, "personal"), "personal");
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(300);

    await backLink(page).click();
    await expect(page).toHaveURL("/en");
    expect(await settledScroll(page)).toBe(before);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(before);
  });

  test("the photo viewer stops smooth scrolling and leaves the page alone", async ({ page }) => {
    await page.goto("/en/portfolio/personal");
    await expect.poll(() => lenisActive(page)).toBe(true);
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 400);
    const before = await settledScroll(page);
    expect(before).toBeGreaterThan(0);
    const photo = photoButton(page, "personal", 3);
    await photo.scrollIntoViewIfNeeded();
    const opened = await settledScroll(page);
    await photo.click();
    await expect(viewer(page)).toBeVisible();
    await expect.poll(() => lenisStopped(page)).toBe(true);
    await page.mouse.move(20, 300);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await scrollY(page)).toBe(opened);

    await page.keyboard.press("Escape");
    await expect(viewer(page)).toHaveCount(0);
    await expect.poll(() => lenisStopped(page)).toBe(false);
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollY(page)).not.toBe(opened);
  });
});

test("touch devices keep native scrolling", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch-only behavior");
  await page.goto("/en");
  await hydrated(page);
  expect(await lenisActive(page)).toBe(false);
});

test("galleries open and return repeatedly", async ({ page }) => {
  await page.goto("/en");
  for (const slug of ["personal", "events", "personal"] as const) {
    const link = landingCard(page, slug);
    await openFromCard(page, link, slug);
    await backLink(page).click();
    await expect(page).toHaveURL("/en");
    await expect(link).toBeFocused();
  }
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("smooth scrolling is off and the page still scrolls", async ({ page, hasTouch }) => {
    await page.goto("/en");
    await hydrated(page);
    expect(await lenisActive(page)).toBe(false);
    if (!hasTouch) {
      await page.mouse.move(200, 400);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
    }
  });

  test("anchors, gallery pages and the viewer still work", async ({ page }) => {
    await page.goto("/en");
    await (await headerLink(page, texts.en.nav.price)).click();
    await expect(page).toHaveURL("/en#price");
    await expectJustBelowHeader(
      page,
      page.getByRole("heading", { level: 2, name: texts.en.headings.price }),
    );

    const link = landingCard(page, "personal");
    await openFromCard(page, link, "personal");
    await photoButton(page, "personal", 0).click();
    await expect(viewer(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer(page)).toHaveCount(0);
    await backLink(page).click();
    await expect(page).toHaveURL("/en#price");
    await expect(link).toBeFocused();
  });
});
