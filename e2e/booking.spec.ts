import { expect, test } from "@playwright/test";
import { site, texts } from "../lib/content";
import { locales } from "../lib/i18n";
import { notConfiguredBaseURL } from "../playwright.config";
import {
  absolute,
  expectJustBelowHeader,
  headerLink,
  headLinks,
  languageAlternates,
  meta,
} from "./helpers";

for (const locale of locales) {
  test(`/${locale}/booking shows the page with the booking item current and its metadata`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/booking`);
    const { nav, headings, meta: metaTexts } = texts[locale];
    await expect(
      page.locator("#booking").getByRole("heading", { level: 1, name: headings.booking }),
    ).toBeVisible();
    await expect(page.locator("footer#contact")).toBeVisible();
    await expect(await headerLink(page, nav.booking)).toHaveAttribute("aria-current", "page");

    await expect(page).toHaveTitle(metaTexts.bookingTitle);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(await meta(page, 'name="description"')).toBe(metaTexts.bookingDescription);
    expect(await headLinks(page, 'link[rel="canonical"]', "rel")).toEqual([
      ["canonical", absolute(`/${locale}/booking`)],
    ]);
    expect(await headLinks(page, 'link[rel="alternate"][hreflang]', "hreflang")).toEqual(
      languageAlternates("/booking"),
    );
    expect(await meta(page, 'property="og:url"')).toBe(absolute(`/${locale}/booking`));
  });

  test(`/${locale}/booking with the fake provider does not show the not-configured notice`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/booking`);
    const { booking, headings } = texts[locale];
    const section = page.locator("#booking");
    await expect(section.getByRole("heading", { level: 1, name: headings.booking })).toBeVisible();
    await expect(section.getByText(booking.notConfigured)).toHaveCount(0);
    await expect(section.getByRole("link", { name: site.email, exact: true })).toHaveCount(0);
  });
}

test.describe("without configuration", () => {
  test.use({ baseURL: notConfiguredBaseURL });

  for (const locale of locales) {
    test(`/${locale}/booking shows the contact e-mail instead of the calendar`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/booking`);
      const { booking, headings } = texts[locale];
      const section = page.locator("#booking");
      await expect(
        section.getByRole("heading", { level: 1, name: headings.booking }),
      ).toBeVisible();
      const notice = section.getByText(booking.notConfigured);
      await expect(notice).toBeVisible();
      const mail = notice.getByRole("link", { name: site.email, exact: true });
      await expect(mail).toHaveAttribute("href", `mailto:${site.email}`);
      await expect(section.getByText(booking.calendar.label)).toHaveCount(0);
      await expect(section.getByRole("button")).toHaveCount(0);
      await expect(section.getByText(booking.timeZoneNote)).toHaveCount(0);
    });
  }
});

test("the sitemap lists the booking page in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const locale of locales) {
    expect(xml).toContain(`<loc>${absolute(`/${locale}/booking`)}</loc>`);
  }
});

test("the language switch keeps the booking page", async ({ page }) => {
  await page.goto("/en/booking");
  await (await headerLink(page, "PL")).click();
  await expect(page).toHaveURL("/pl/booking");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(
    page.getByRole("heading", { level: 1, name: texts.pl.headings.booking }),
  ).toBeVisible();
  await (await headerLink(page, "EN")).click();
  await expect(page).toHaveURL("/en/booking");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the price section link leads to the booking page", async ({ page }) => {
  await page.goto("/pl");
  const link = page.locator("#price [data-book-session]");
  await expect(link).toHaveText(texts.pl.booking.bookSession);
  await expect(link).toHaveAttribute("href", "/pl/booking");
  await link.click();
  await expect(page).toHaveURL("/pl/booking");
  await expect(
    page.getByRole("heading", { level: 1, name: texts.pl.headings.booking }),
  ).toBeVisible();
});

test("a header anchor on the booking page lands on the landing section", async ({ page }) => {
  await page.goto("/en/booking");
  await (await headerLink(page, texts.en.nav.price)).click();
  await expect(page).toHaveURL("/en#price");
  await expectJustBelowHeader(
    page,
    page.getByRole("heading", { level: 2, name: texts.en.headings.price }),
  );
});
