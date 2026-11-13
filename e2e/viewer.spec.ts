import { expect, test, type Page } from "@playwright/test";
import { texts } from "../lib/content";
import {
  category,
  currentMain,
  currentPhoto,
  expectPhoto,
  expectZoomedIn,
  expectZoomedOut,
  collectionsCard,
  openFromCard,
  openPhoto,
  photoButton,
  photoCenter,
  scrollPageTo,
  scrollOverflow,
  scrollY,
  settledPhotoWidth,
  settledScroll,
  viewer,
} from "./helpers";

type Point = { x: number; y: number };

async function touchSwipe(page: Page, from: Point, to: Point) {
  await page.evaluate(
    async ({ from, to }) => {
      const target = document.elementFromPoint(from.x, from.y)!;
      const fire = (type: string, x: number, y: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
      fire("pointerdown", from.x, from.y);
      for (let step = 1; step <= 10; step += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        fire(
          "pointermove",
          from.x + ((to.x - from.x) * step) / 10,
          from.y + ((to.y - from.y) * step) / 10,
        );
      }
      fire("pointerup", to.x, to.y);
    },
    { from, to },
  );
}

async function doubleTapOrClick(page: Page, hasTouch: boolean) {
  const zoomOut = viewer(page).getByRole("button", { name: texts.en.viewer.zoomOut });
  const zoomedBefore = await zoomOut.isEnabled();
  await expect(async () => {
    if ((await zoomOut.isEnabled()) === zoomedBefore) {
      const point = await photoCenter(page);
      if (hasTouch) {
        await page.touchscreen.tap(point.x, point.y);
        await page.touchscreen.tap(point.x, point.y);
      } else {
        await page.mouse.dblclick(point.x, point.y);
      }
    }
    await expect(zoomOut).toBeEnabled({ enabled: !zoomedBefore, timeout: 1000 });
  }).toPass();
}

test("clicking a photo opens the viewer on it with a counter", async ({ page }) => {
  await openPhoto(page, "personal", 2);
  await expectPhoto(page, "personal", 2);
  await expect(page).toHaveURL("/en/portfolio/personal");
  const box = (await viewer(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  expect(
    await viewer(page).evaluate((element) => element.closest("main, footer, header")),
  ).toBeNull();
  await viewer(page).getByRole("button", { name: texts.en.viewer.close }).click();
  await expect(viewer(page)).toHaveCount(0);
});

test("arrow keys and buttons move between photos", async ({ page, hasTouch }) => {
  test.skip(hasTouch, "keyboard navigation is a desktop input");
  await openPhoto(page, "personal", 2);
  await page.keyboard.press("ArrowRight");
  await expectPhoto(page, "personal", 3);
  await page.keyboard.press("ArrowLeft");
  await expectPhoto(page, "personal", 2);
  await viewer(page).getByRole("button", { name: texts.en.viewer.next }).click();
  await expectPhoto(page, "personal", 3);
});

test("a finger swipe moves to the next photo and back", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch-only behavior");
  await openPhoto(page, "personal", 2);
  await settledPhotoWidth(page);
  const { width, height } = page.viewportSize()!;
  const y = height / 2;
  await touchSwipe(page, { x: width * 0.8, y }, { x: width * 0.2, y });
  await expectPhoto(page, "personal", 3);
  await touchSwipe(page, { x: width * 0.2, y }, { x: width * 0.8, y });
  await expectPhoto(page, "personal", 2);
});

test("the viewer does not wrap past the last or first photo", async ({ page }) => {
  const last = category("personal").photos.length - 1;
  await openPhoto(page, "personal", last);
  await expect(viewer(page).getByRole("button", { name: texts.en.viewer.next })).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expectPhoto(page, "personal", last);
  await viewer(page).getByRole("button", { name: texts.en.viewer.close }).click();

  await photoButton(page, "personal", 0).click();
  await expect(viewer(page).getByRole("button", { name: texts.en.viewer.previous })).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expectPhoto(page, "personal", 0);
});

test("double-click or double-tap zooms in and out", async ({ page, hasTouch }) => {
  await openPhoto(page, "personal", 2);
  const initial = await settledPhotoWidth(page);
  await doubleTapOrClick(page, hasTouch);
  await expectZoomedIn(page, initial);
  await expect(viewer(page)).toBeVisible();
  await expectPhoto(page, "personal", 2);
  await settledPhotoWidth(page);
  await doubleTapOrClick(page, hasTouch);
  await expectZoomedOut(page, initial);
});

test("navigating, zooming and Escape in the viewer keep the gallery page scroll", async ({
  page,
  hasTouch,
}) => {
  await page.goto("/en/portfolio");
  await openFromCard(page, collectionsCard(page, "events"), "events");
  const firstPhoto = (await photoButton(page, "events", 0).boundingBox())!;
  await scrollPageTo(page, Math.round(firstPhoto.height / 2));
  const before = await settledScroll(page);
  expect(before).toBeGreaterThan(0);
  const visible = await currentMain(page)
    .locator("li button")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const bar = document.querySelector("[data-gallery-bar]")!.getBoundingClientRect();
        const center = box.top + box.height / 2;
        return center > bar.bottom && center < window.innerHeight;
      }),
    );
  const opened = visible.lastIndexOf(true);
  expect(opened).toBeGreaterThan(0);
  const button = photoButton(page, "events", opened);
  const box = (await button.boundingBox())!;
  if (hasTouch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(viewer(page)).toBeVisible();
  await expect(currentPhoto(page)).toBeVisible();
  expect(await scrollOverflow(page)).toBe("hidden");
  await viewer(page).getByRole("button", { name: texts.en.viewer.previous }).click();
  const index = opened - 1;
  await expectPhoto(page, "events", index);
  const initial = await settledPhotoWidth(page);
  await doubleTapOrClick(page, hasTouch);
  await expectZoomedIn(page, initial);
  await expectPhoto(page, "events", index);
  expect(await scrollY(page)).toBe(before);

  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  await expect(page).toHaveURL("/en/portfolio/events");
  expect(await settledScroll(page)).toBe(before);
  await expect(button).toBeFocused();
  expect(await scrollOverflow(page)).not.toBe("hidden");
});

test("the viewer uses Polish labels on Polish pages", async ({ page }) => {
  await page.goto("/pl/portfolio/business");
  await photoButton(page, "business", 0, "pl").click();
  const polish = viewer(page, "pl");
  await expect(polish).toBeVisible();
  await expect(polish.getByRole("button", { name: texts.pl.viewer.close })).toBeVisible();
  await expect(
    polish.getByRole("group", { name: `1 z ${category("business").photos.length}` }),
  ).toBeVisible();
});
