import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { getCategories } from "../lib/content";

const categories = getCategories();

const contentDir = path.join(__dirname, "..", "content", "collections");
const collectionJson = readdirSync(contentDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(path.join(contentDir, file), "utf8")));

test("the root redirects by Accept-Language", async ({ request, baseURL }) => {
  for (const [acceptLanguage, target] of [
    ["pl-PL,pl;q=0.9,en;q=0.8", "/pl"],
    ["en-US,en;q=0.9", "/en"],
    ["de-DE,de;q=0.9", "/en"],
    ["", "/en"],
  ]) {
    const response = await request.get("/", {
      headers: { "Accept-Language": acceptLanguage },
      maxRedirects: 0,
    });
    expect(response.status(), acceptLanguage).toBeGreaterThanOrEqual(300);
    expect(response.status(), acceptLanguage).toBeLessThan(400);
    expect(new URL(response.headers()["location"], baseURL).pathname, acceptLanguage).toBe(target);
  }
});

test("an unknown locale shows the 404 page", async ({ page }) => {
  for (const path of ["/de", "/EN", "/de/portfolio", "/de/booking", "/EN/booking"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  }
});

test("an unknown collection shows the 404 page", async ({ page }) => {
  for (const path of [
    "/en/portfolio/weddings",
    "/pl/portfolio/Family",
    "/en/portfolio/events/extra",
    "/en/portfolio/collections",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  }
});

test("every landing, collections page, booking page and gallery is served", async ({ request }) => {
  const paths = [
    "",
    "/portfolio",
    "/booking",
    ...categories.map(({ slug }) => `/portfolio/${slug}`),
  ];
  for (const locale of ["en", "pl"]) {
    for (const path of paths) {
      const response = await request.get(`/${locale}${path}`);
      expect(response.status(), `/${locale}${path}`).toBe(200);
    }
  }
});

test("an old collection address listed in redirectFrom moves permanently to the slug", async ({
  request,
  baseURL,
}) => {
  const events = collectionJson.find((data) => data.slug === "events");
  expect(events.redirectFrom).toEqual(["bts", "behind-the-scenes"]);
  for (const locale of ["en", "pl"]) {
    for (const old of events.redirectFrom) {
      const response = await request.get(`/${locale}/portfolio/${old}`, { maxRedirects: 0 });
      expect(response.status(), `${locale} ${old}`).toBe(301);
      expect(new URL(response.headers()["location"], baseURL).pathname).toBe(
        `/${locale}/portfolio/events`,
      );
    }
  }
});

test("collections come only from the content files", async ({ page }) => {
  expect(collectionJson).toHaveLength(3);
  const fromFiles = collectionJson
    .toSorted((a, b) => a.order - b.order || (a.slug < b.slug ? -1 : 1))
    .map((data) => ({
      slug: data.slug,
      name: data.name,
      photos: data.photos.map((photo: { file: string; alt: unknown }) => ({
        src: `/photos/${data.slug}/${photo.file}`,
        alt: photo.alt,
      })),
    }));
  expect(
    categories.map(({ slug, name, photos }) => ({
      slug,
      name,
      photos: photos.map(({ src, alt }) => ({ src, alt })),
    })),
  ).toEqual(fromFiles);
  await page.goto("/en/portfolio");
  await expect(page.locator("#collections").getByRole("listitem")).toHaveCount(
    collectionJson.length,
  );
});
