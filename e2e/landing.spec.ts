import { expect, test, type Locator, type Page } from "@playwright/test";
import { currency, portrait, priceItems, site, texts } from "../lib/content";
import { locales } from "../lib/i18n";
import { phoneLink } from "../lib/phone";
import { category, expectJustBelowHeader, headerLink } from "./helpers";

test("sections appear in order: header, hero, portfolio, price, footer", async ({ page }) => {
  await page.goto("/en");
  const sections = [
    page.locator("header"),
    page.getByRole("heading", { level: 1, name: site.name }),
    page.locator("#portfolio"),
    page.locator("#price"),
    page.locator("footer#contact"),
  ];
  const tops: number[] = [];
  for (const section of sections) tops.push((await section.boundingBox())!.y);
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

test("the hero shows the portrait, role and bio", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.getByAltText(portrait.alt.pl)).toBeVisible();
  await expect(page.getByText(texts.pl.role, { exact: true })).toBeVisible();
  await expect(page.getByText(texts.pl.bio)).toBeVisible();
});

for (const [link, target] of [
  ["Portfolio", "portfolio"],
  ["Price", "price"],
  ["Contact", "contact"],
] as const) {
  test(`the header ${link} link lands on the section below the fixed header`, async ({ page }) => {
    await page.goto("/en");
    await (await headerLink(page, link)).click();
    await expect(page).toHaveURL(`/en#${target}`);
    await expectJustBelowHeader(
      page,
      page.getByRole("heading", { level: 2, name: texts.en.headings[target] }),
    );
  });
}

test("a header link on a gallery page lands on the landing section", async ({ page }) => {
  await page.goto("/pl/portfolio/personal");
  await (await headerLink(page, texts.pl.nav.contact)).click();
  await expect(page).toHaveURL("/pl#contact");
  await expectJustBelowHeader(
    page,
    page.locator("footer").getByRole("heading", { name: texts.pl.headings.contact }),
  );
});

test("the language switch keeps the landing", async ({ page }) => {
  await page.goto("/en");
  await (await headerLink(page, "PL")).click();
  await expect(page).toHaveURL("/pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { name: texts.pl.headings.price })).toBeAttached();
  await (await headerLink(page, "EN")).click();
  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the language switch keeps the gallery", async ({ page }) => {
  await page.goto("/en/portfolio/business");
  await (await headerLink(page, "PL")).click();
  await expect(page).toHaveURL("/pl/portfolio/business");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(
    page.getByRole("heading", { level: 1, name: category("business").name.pl, exact: true }),
  ).toBeVisible();
});

test("the price section lists prices and conditions in both languages", async ({ page }) => {
  for (const locale of ["en", "pl"] as const) {
    await page.goto(`/${locale}`);
    const section = page.locator("#price");
    await expect(section.getByRole("heading", { name: texts[locale].headings.price })).toBeVisible();
    for (const item of priceItems) {
      await expect(section).toContainText(`${item.duration[locale]} — ${item.amount} ${currency}`);
    }
    for (const condition of texts[locale].priceConditions) {
      await expect(section).toContainText(condition);
    }
  }
});

test("the footer has a mailto link, social links in a new tab and the copyright", async ({
  page,
}) => {
  await page.goto("/en");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: site.email })).toHaveAttribute(
    "href",
    `mailto:${site.email}`,
  );
  for (const social of site.socials) {
    const link = footer.getByRole("link", { name: social.label });
    await expect(link).toHaveAttribute("href", social.href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
  await expect(footer).toContainText(`© ${new Date().getFullYear()} ${site.name}`);
});

function priceCta(page: Page) {
  return page.locator("#price [data-book-session]");
}

function opacity(locator: Locator) {
  return locator.evaluate((element) => {
    let current: Element | null = element;
    let value = 1;
    while (current) {
      value *= Number(getComputedStyle(current).opacity);
      current = current.parentElement;
    }
    return value;
  });
}

for (const locale of locales) {
  test(`the price section invites to book a session in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const link = priceCta(page);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await expect(link).toHaveText(texts[locale].booking.bookSession);
    await expect(link).toHaveAttribute("href", `/${locale}/booking`);
    await expect.poll(() => opacity(link)).toBe(1);
  });
}

test("on desktop the booking call to action sits to the right of the price list", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "phones stack the call to action under the conditions");
  await page.goto("/en");
  const list = (await page.locator("#price ul").first().boundingBox())!;
  const conditions = (await page.locator("#price ul").nth(1).boundingBox())!;
  const link = (await priceCta(page).boundingBox())!;
  expect(link.x).toBeGreaterThanOrEqual(list.x + list.width);
  expect(link.y).toBeLessThan(conditions.y + conditions.height);
  expect(link.y + link.height).toBeGreaterThan(list.y);
});

test("on a phone the booking call to action sits below the conditions", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "desktop puts the call to action beside the price list");
  await page.goto("/en");
  const conditions = (await page.locator("#price ul").nth(1).boundingBox())!;
  const link = (await priceCta(page).boundingBox())!;
  expect(link.y).toBeGreaterThanOrEqual(conditions.y + conditions.height);
});

test("the booking call to action fades in once when it scrolls into view", async ({ page }) => {
  await page.goto("/en");
  const reveal = page.locator("#price [data-reveal-on-view]");
  await expect(reveal).toHaveAttribute("data-reveal", "waiting");
  await priceCta(page).scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute("data-reveal", "shown");
  await expect.poll(() => opacity(priceCta(page))).toBe(1);
});

test("with reduced motion the booking call to action is shown at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  const reveal = page.locator("#price [data-reveal-on-view]");
  await expect(reveal).not.toHaveAttribute("data-reveal", /.*/);
  expect(await opacity(priceCta(page))).toBe(1);
  await priceCta(page).scrollIntoViewIfNeeded();
  await expect(reveal).not.toHaveAttribute("data-reveal", /.*/);
  expect(await opacity(priceCta(page))).toBe(1);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the booking call to action is visible", async ({ page }) => {
    await page.goto("/en");
    const link = priceCta(page);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    expect(await opacity(link)).toBe(1);
  });
});

for (const locale of locales) {
  test(`the hero links to the booking page in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const link = page.locator("main section").first().locator("[data-book-session]");
    await expect(link).toBeVisible();
    await expect(link).toHaveText(texts[locale].booking.bookSession);
    const bio = (await page.getByText(texts[locale].bio).boundingBox())!;
    expect((await link.boundingBox())!.y).toBeGreaterThanOrEqual(bio.y + bio.height);
    await link.click();
    await expect(page).toHaveURL(`/${locale}/booking`);
    await expect(
      page.locator("#booking").getByRole("heading", { level: 1, name: texts[locale].headings.booking }),
    ).toBeVisible();
  });
}

test("the footer shows a phone link only when a number is set", async ({ page }) => {
  await page.goto("/en");
  const links = page.locator('footer a[href^="tel:"]');
  const phone = phoneLink(site.phone);
  if (!phone) {
    await expect(links).toHaveCount(0);
    return;
  }
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute("href", phone.href);
  await expect(links).toHaveText(phone.label);
});
