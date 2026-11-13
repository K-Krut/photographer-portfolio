import { expect, test, type Locator } from "@playwright/test";
import { getCategories, getFeaturedCategories, selectFeatured, texts } from "../lib/content";
import { collectionsCard, landingCard, sourcePath } from "./helpers";

const categories = getCategories();
const featuredCategories = getFeaturedCategories();

function fanOpacities(link: Locator) {
  return link
    .locator("[data-fan-photo]")
    .evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity)));
}

async function columnCount(list: Locator) {
  const lefts = await list
    .getByRole("listitem")
    .evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().x)));
  return new Set(lefts).size;
}

for (const locale of ["en", "pl"] as const) {
  test(`/${locale} shows the featured collections with name, count and link`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const items = page.locator("#portfolio").getByRole("listitem");
    await expect(items).toHaveCount(featuredCategories.length);
    for (const [index, item] of featuredCategories.entries()) {
      const link = items.nth(index).getByRole("link");
      await expect(link).toHaveAttribute("href", `/${locale}/portfolio/${item.slug}`);
      await expect(link.getByRole("heading", { name: item.name[locale], exact: true })).toBeVisible();
      await expect(link).toContainText(texts[locale].photoCount(item.photos.length));
      const cover = link.getByAltText(item.cover.alt[locale]);
      await link.scrollIntoViewIfNeeded();
      await expect(cover).toBeVisible();
      expect(sourcePath((await cover.getAttribute("src"))!)).toBe(item.cover.src);
    }
  });
}

test("View all opens the all collections page", async ({ page }) => {
  await page.goto("/en");
  await page.locator("#portfolio").getByRole("link", { name: texts.en.viewAll }).click();
  await expect(page).toHaveURL("/en/portfolio");
  await expect(
    page.getByRole("heading", { level: 1, name: texts.en.headings.portfolio }),
  ).toBeVisible();
});

test("the all collections page lists every collection", async ({ page }) => {
  await page.goto("/pl/portfolio");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  const items = page.locator("#collections").getByRole("listitem");
  await expect(items).toHaveCount(categories.length);
  for (const [index, item] of categories.entries()) {
    const link = items.nth(index).getByRole("link");
    await expect(link).toHaveAttribute("href", `/pl/portfolio/${item.slug}`);
    await expect(link.getByRole("heading", { name: item.name.pl, exact: true })).toBeVisible();
    await expect(link).toContainText(texts.pl.photoCount(item.photos.length));
  }
});

test("the all collections grid has one column on phones and two on desktop", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en/portfolio");
  expect(await columnCount(page.locator("#collections"))).toBe(isMobile ? 1 : 2);
});

test("a keyboard-focused card shows a white square outline", async ({ page }) => {
  await page.goto("/en");
  const link = landingCard(page, "personal");
  await expect
    .poll(async () => {
      await page.keyboard.press("Tab");
      return page.evaluate(() => document.documentElement.hasAttribute("data-keyboard"));
    })
    .toBe(true);
  await link.focus();
  await expect.poll(() => link.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  expect(
    await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.outlineStyle, style.outlineColor, style.borderTopLeftRadius];
    }),
  ).toEqual(["solid", "rgb(255, 255, 255)", "0px"]);
});

test("hovering a card fans out more photos on desktop", async ({ page, hasTouch }) => {
  test.skip(hasTouch, "the fan needs a hover-capable pointer");
  await page.goto("/en");
  const link = landingCard(page, "personal");
  await link.scrollIntoViewIfNeeded();
  expect((await fanOpacities(link)).length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => fanOpacities(link)).toEqual([0, 0, 0]);
  await link.hover();
  await expect.poll(() => fanOpacities(link)).toEqual([1, 1, 1]);
  await expect.poll(() => fanOpacities(landingCard(page, "events"))).toEqual([0, 0, 0]);
  await page.mouse.move(0, 0);
  await expect.poll(() => fanOpacities(link)).toEqual([0, 0, 0]);

  await page.goto("/en/portfolio");
  const business = collectionsCard(page, "business");
  await business.scrollIntoViewIfNeeded();
  await business.hover();
  await expect.poll(() => fanOpacities(business)).toEqual([1, 1, 1]);
});

test("touch devices show cards without a fan", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch-only behavior");
  await page.goto("/en");
  for (const fan of await page.locator("#portfolio [data-fan]").all()) {
    await expect(fan).toBeHidden();
  }
  const link = landingCard(page, "personal");
  await link.scrollIntoViewIfNeeded();
  await link.tap();
  await expect(page).toHaveURL("/en/portfolio/personal");
});

test("featured selection falls back to the first collections", () => {
  const list = (flags: (boolean | undefined)[]) =>
    flags.map((featured, id) => ({ id, featured }));
  const ids = (items: { id: number }[]) => items.map((item) => item.id);

  expect(featuredCategories.map((item) => item.slug)).toEqual(["personal", "business", "events"]);
  expect(ids(selectFeatured(list([undefined, false, undefined, false, undefined])))).toEqual([0, 1, 2, 3]);
  expect(ids(selectFeatured(list([false, true, true, false, true, true, true])))).toEqual([1, 2, 4, 5]);
  expect(ids(selectFeatured(list([false, true, false, true, false])))).toEqual([1, 3]);
  expect(ids(selectFeatured(list([undefined, undefined])))).toEqual([0, 1]);
});
