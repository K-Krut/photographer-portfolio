import { expect, test, type Page } from "@playwright/test";
import { texts, type CategorySlug } from "../lib/content";
import type { Locale } from "../lib/i18n";
import {
  backLink,
  category,
  collectionsCard,
  currentMain,
  galleryHeading,
  headerLink,
  landingCard,
  openFromCard,
  scrollPageTo,
  scrollY,
  settledScroll,
  sourcePath,
} from "./helpers";

async function expectPageTop(page: Page, slug: CategorySlug, locale: Locale = "en") {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await settledScroll(page)).toBe(0);
  await expect(page.locator("header")).toBeInViewport();
  await expect(galleryHeading(page, slug, locale)).toBeInViewport();
  await expect(backLink(page)).toBeInViewport();
  await expect(page.locator("footer#contact").filter({ visible: true })).toHaveCount(1);
}

test("a landing card opens the collection as a page with header, title and footer", async ({
  page,
}) => {
  await page.goto("/en");
  await openFromCard(page, landingCard(page, "personal"), "personal");
  await expectPageTop(page, "personal");
  await expect(page).toHaveTitle(texts.en.meta.galleryTitle("Personal Photosessions"));
  const sources = await currentMain(page)
    .getByRole("listitem")
    .locator("img")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("src")!));
  expect(sources.map(sourcePath)).toEqual(category("personal").photos.map((photo) => photo.src));
});

test("an all collections card opens the page and the arrow returns to the card", async ({
  page,
}) => {
  await page.goto("/en/portfolio");
  const link = collectionsCard(page, "business");
  const { scrollY: before } = await openFromCard(page, link, "business");
  await expectPageTop(page, "business");
  await expect(currentMain(page).getByRole("listitem")).toHaveCount(
    category("business").photos.length,
  );
  await backLink(page).click();
  await expect(page).toHaveURL("/en/portfolio");
  await expect(link).toBeFocused();
  expect(Math.abs((await settledScroll(page)) - before)).toBeLessThanOrEqual(2);
});

for (const method of ["arrow", "browser Back"] as const) {
  test(`the ${method} returns to the landing at the same scroll with focus on the card`, async ({
    page,
  }) => {
    await page.goto("/en");
    await (await headerLink(page, texts.en.nav.contact)).click();
    await expect(page).toHaveURL("/en#contact");
    await expect(page.locator("footer").getByRole("heading")).toBeInViewport();
    const landingUrl = page.url();

    const link = landingCard(page, "personal");
    const { scrollY: before } = await openFromCard(page, link, "personal");
    expect(await settledScroll(page)).toBe(0);

    if (method === "arrow") await backLink(page).click();
    else await page.goBack();

    await expect(page).toHaveURL(landingUrl);
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-style", "none");
    expect(Math.abs((await settledScroll(page)) - before)).toBeLessThanOrEqual(2);
    await expect(link).toBeInViewport();
  });
}

test("the arrow on a directly opened gallery goes to the landing portfolio", async ({ page }) => {
  const response = await page.goto("/pl/portfolio/events");
  expect(response?.status()).toBe(200);
  await expectPageTop(page, "events", "pl");
  await expect(backLink(page)).toHaveAccessibleName(texts.pl.back);
  await expect(currentMain(page).getByRole("listitem")).toHaveCount(category("events").photos.length);

  await backLink(page).click();
  await expect(page).toHaveURL("/pl#portfolio");
  await expect(
    page.getByRole("heading", { level: 2, name: texts.pl.headings.portfolio }),
  ).toBeInViewport();
});

test("the all collections arrow sits left of the title and returns to the landing", async ({
  page,
  context,
}) => {
  await page.goto("/en");
  const viewAll = page.locator("#portfolio").getByRole("link", { name: texts.en.viewAll });
  await viewAll.scrollIntoViewIfNeeded();
  const before = await settledScroll(page);
  await viewAll.click();
  await expect(page).toHaveURL("/en/portfolio");
  const heading = page.getByRole("heading", { level: 1, name: texts.en.headings.portfolio });
  await expect(heading).toBeVisible();
  const arrow = (await backLink(page).boundingBox())!;
  const title = (await heading.boundingBox())!;
  expect(arrow.x + arrow.width).toBeLessThanOrEqual(title.x);
  expect(arrow.y).toBeLessThan(title.y + title.height);
  expect(arrow.y + arrow.height).toBeGreaterThan(title.y);

  await backLink(page).click();
  await expect(page).toHaveURL("/en");
  await expect(viewAll).toBeFocused();
  expect(await settledScroll(page)).toBe(before);

  const direct = await context.newPage();
  await direct.goto("/en/portfolio");
  await backLink(direct).click();
  await expect(direct).toHaveURL("/en#portfolio");
});

test("the title row scrolls away with the page", async ({ page }) => {
  await page.goto("/en/portfolio/personal");
  await scrollPageTo(page, "bottom");
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await expect(backLink(page)).not.toBeInViewport();
  await expect(galleryHeading(page, "personal")).not.toBeInViewport();
});
