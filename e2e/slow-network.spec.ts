import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { site, texts } from "../lib/content";
import { backLink, category, galleryHeading, viewer } from "./helpers";

const screenshotDir = path.join(process.cwd(), "test-results", "slow-network");
const loadTimeout = 90_000;

test.describe.configure({ timeout: 180_000 });

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const bytesPerSecond = (1500 * 1000) / 8;
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 300,
    downloadThroughput: bytesPerSecond,
    uploadThroughput: bytesPerSecond,
  });
  return cdp;
}

async function capture(cdp: CDPSession, name: string) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  mkdirSync(screenshotDir, { recursive: true });
  writeFileSync(path.join(screenshotDir, `${name}.png`), Buffer.from(data, "base64"));
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function skeletonStatuses(scope: Page | Locator) {
  return scope.locator("[data-skeleton]").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.bottom > 0 && box.top < window.innerHeight && box.width > 0;
      })
      .map((element) => element.getAttribute("data-skeleton")),
  );
}

async function expectNoStuckSkeletons(scope: Page | Locator) {
  await expect
    .poll(async () => (await skeletonStatuses(scope)).every((status) => status === "loaded"), {
      timeout: loadTimeout,
    })
    .toBe(true);
}

test("the landing shows skeletons while loading and settles with every photo loaded", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const cdp = await throttle(page);
  await page.goto("/en", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { level: 1, name: site.name })).toBeVisible({
    timeout: loadTimeout,
  });
  await capture(cdp, "landing-loading");
  expect(await skeletonStatuses(page)).toContain("loading");

  await expectNoStuckSkeletons(page);
  await page.locator("#portfolio").scrollIntoViewIfNeeded();
  await capture(cdp, "landing-portfolio");
  await expectNoStuckSkeletons(page);
  await capture(cdp, "landing-loaded");
  expect(errors).toEqual([]);
});

test("a gallery fills in without stuck skeletons", async ({ page }) => {
  const errors = collectErrors(page);
  const cdp = await throttle(page);
  await page.goto("/en/portfolio/personal", { waitUntil: "commit" });
  await expect(
    page.getByRole("heading", { level: 1, name: category("personal").name.en }),
  ).toBeVisible({ timeout: loadTimeout });
  await capture(cdp, "gallery-loading");
  await expectNoStuckSkeletons(page.locator("main"));
  await capture(cdp, "gallery-loaded");
  expect(errors).toEqual([]);
});

test("cards and photos open while images are still loading", async ({ page }) => {
  const errors = collectErrors(page);
  const cdp = await throttle(page);
  await page.goto("/en/portfolio", { waitUntil: "commit" });
  const card = page.locator('#collections a[href="/en/portfolio/business"]');
  await expect
    .poll(
      () => card.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps"))),
      { timeout: loadTimeout },
    )
    .toBe(true);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page).toHaveURL("/en/portfolio/business", { timeout: loadTimeout });
  await expect(galleryHeading(page, "business")).toBeVisible({ timeout: loadTimeout });
  await capture(cdp, "gallery-opened");

  const photo = category("business").photos[1];
  await page.getByRole("button", { name: photo.alt.en, exact: true }).click();
  await expect(viewer(page)).toBeVisible();
  await capture(cdp, "viewer-opened");
  await expect(viewer(page).locator(".yarl__slide_current img").filter({ visible: true })).toHaveCSS(
    "opacity",
    "1",
    { timeout: loadTimeout },
  );
  await capture(cdp, "viewer-loaded");

  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  await backLink(page).click();
  await expect(page).toHaveURL("/en/portfolio");
  await expect(card).toBeFocused();
  await expect(page.getByRole("heading", { level: 1, name: texts.en.headings.portfolio })).toBeVisible();
  expect(errors).toEqual([]);
});
