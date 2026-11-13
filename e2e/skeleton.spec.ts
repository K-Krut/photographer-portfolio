import { expect, test } from "@playwright/test";
import { portrait } from "../lib/content";
import { category, currentPhoto, holdImages, viewer } from "./helpers";

const skeletonColor = "rgb(23, 23, 23)";

test("a lazy photo shows a skeleton until it loads", async ({ page }) => {
  const release = await holdImages(page);
  await page.goto("/en/portfolio/personal", { waitUntil: "domcontentloaded" });
  const skeleton = page.locator("main li [data-skeleton]:has(img[loading=lazy])").first();
  await expect(skeleton).toHaveAttribute("data-skeleton", "loading");
  await expect(skeleton).toHaveCSS("background-color", skeletonColor);
  await expect(skeleton.locator("img")).toHaveCSS("opacity", "0");

  release();
  await skeleton.scrollIntoViewIfNeeded();
  await expect(skeleton).toHaveAttribute("data-skeleton", "loaded");
  await expect(skeleton.locator("img")).toHaveCSS("opacity", "1");
});

test("a failed photo leaves a still block", async ({ page }) => {
  const broken = category("personal").photos[0];
  await page.route(
    (url) => url.pathname === "/_next/image" && url.searchParams.get("url") === broken.src,
    (route) => route.fulfill({ status: 500, body: "" }),
  );
  await page.goto("/en/portfolio/personal");
  const skeleton = page.locator("main li [data-skeleton]").first();
  await expect(skeleton).toHaveAttribute("data-skeleton", "failed");
  await expect(skeleton).toHaveCSS("background-color", skeletonColor);
  await expect(skeleton).toHaveCSS("animation-name", "none");
  await expect(page.locator("main li [data-skeleton]").nth(1)).toHaveAttribute(
    "data-skeleton",
    "loaded",
  );
});

test("the viewer shows a placeholder while the photo loads", async ({ page }) => {
  const photo = category("personal").photos.at(-1)!;
  await page.goto("/en/portfolio/personal");
  const release = await holdImages(page, (src) => src === photo.src);
  await page.getByRole("button", { name: photo.alt.en, exact: true }).click();
  const skeleton = viewer(page).locator(".yarl__slide_current [data-viewer-skeleton]");
  await expect.poll(() => skeleton.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0);

  release();
  await expect(currentPhoto(page)).toHaveCSS("opacity", "1");
  await expect(skeleton).toHaveCSS("opacity", "0");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the hero portrait is visible from the server HTML", async ({ page }) => {
    await page.goto("/en");
    const image = page.getByAltText(portrait.alt.en);
    await expect(image).toBeVisible();
    await expect(image).toHaveCSS("opacity", "1");
  });
});
