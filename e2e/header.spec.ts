import { expect, test } from "@playwright/test";
import { site, texts } from "../lib/content";
import { locales } from "../lib/i18n";
import {
  expectJustBelowHeader,
  headerLink,
  menuButton,
  openMenu,
  scrollOverflow,
  scrollY,
} from "./helpers";

test.describe("the mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "the burger menu is for phones");

  test("the header is a single row with the burger and no inline links", async ({ page }) => {
    await page.goto("/en");
    const header = page.locator("header");
    const logo = header.getByRole("link", { name: site.name });
    const toggle = menuButton(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAccessibleName(texts.en.menu.open);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(header.getByRole("link", { name: texts.en.nav.price })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "PL", exact: true })).toHaveCount(0);
    const logoBox = (await logo.boundingBox())!;
    const toggleBox = (await toggle.boundingBox())!;
    expect(toggleBox.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox.height).toBeGreaterThanOrEqual(44);
    expect(
      Math.abs(logoBox.y + logoBox.height / 2 - (toggleBox.y + toggleBox.height / 2)),
    ).toBeLessThan(2);
    expect((await header.boundingBox())!.height).toBeLessThan(toggleBox.height * 2);
  });

  test("the menu shows the links and switcher, and Escape and the cross close it", async ({
    page,
  }) => {
    await page.goto("/pl");
    const header = page.locator("header");
    const toggle = menuButton(page);
    await openMenu(page);
    await expect(toggle).toHaveAccessibleName(texts.pl.menu.close);
    for (const label of Object.values(texts.pl.nav)) {
      await expect(header.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(header.getByRole("link", { name: "EN", exact: true })).toBeVisible();
    const first = header.getByRole("link", { name: texts.pl.nav.portfolio, exact: true });
    await expect(first).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(header.getByRole("link", { name: "PL", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(first).toBeHidden();
    await expect(toggle).toBeFocused();

    await openMenu(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(first).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("the page behind the open menu does not scroll", async ({ page }) => {
    await page.goto("/en");
    await openMenu(page);
    expect(await scrollOverflow(page)).toBe("hidden");
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
    expect(await scrollY(page)).toBe(0);
    await page.keyboard.press("Escape");
    expect(await scrollOverflow(page)).not.toBe("hidden");
  });

  test("tapping a link closes the menu and lands the section below the header", async ({
    page,
  }) => {
    await page.goto("/en");
    await openMenu(page);
    await page.locator("header").getByRole("link", { name: texts.en.nav.price }).click();
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL("/en#price");
    await expectJustBelowHeader(
      page,
      page.getByRole("heading", { level: 2, name: texts.en.headings.price }),
    );
  });

  test("tapping the booking link closes the menu and opens the booking page", async ({ page }) => {
    await page.goto("/pl");
    await openMenu(page);
    await page.locator("header").getByRole("link", { name: texts.pl.nav.booking }).click();
    await expect(page).toHaveURL("/pl/booking");
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("heading", { level: 1, name: texts.pl.headings.booking }),
    ).toBeVisible();
    expect(await scrollOverflow(page)).not.toBe("hidden");
  });
});

for (const locale of locales) {
  test(`the ${locale} booking item is a page link and is not current on the landing`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const { nav } = texts[locale];
    const booking = await headerLink(page, nav.booking);
    await expect(booking).toHaveAttribute("href", `/${locale}/booking`);
    await expect(booking).not.toHaveAttribute("aria-current");
    for (const [id, label] of [
      ["portfolio", nav.portfolio],
      ["price", nav.price],
      ["contact", nav.contact],
    ]) {
      const anchor = await headerLink(page, label);
      await expect(anchor).toHaveAttribute("href", `/${locale}#${id}`);
      await expect(anchor).not.toHaveAttribute("aria-current");
    }
    await booking.click();
    await expect(page).toHaveURL(`/${locale}/booking`);
    await expect(await headerLink(page, nav.booking)).toHaveAttribute("aria-current", "page");
  });
}

test("desktop keeps the inline navigation without a burger", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await page.goto("/en");
  await expect(menuButton(page)).toBeHidden();
  for (const label of Object.values(texts.en.nav)) {
    await expect(
      page.locator("header").getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  }
});
