import { expect, test } from "@playwright/test";
import { getCategories, ogImage, site, texts } from "../lib/content";
import { locales } from "../lib/i18n";
import { phoneNumber } from "../lib/phone";
import { absolute, category, headLinks, languageAlternates, meta } from "./helpers";

const categories = getCategories();

test("/pl has Polish metadata, canonical and alternates", async ({ page }) => {
  await page.goto("/pl");
  const { title, description } = texts.pl.meta;
  await expect(page).toHaveTitle(title);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  expect(await meta(page, 'name="description"')).toBe(description);
  expect(await headLinks(page, 'link[rel="canonical"]', "rel")).toEqual([
    ["canonical", absolute("/pl")],
  ]);
  expect(await headLinks(page, 'link[rel="alternate"][hreflang]', "hreflang")).toEqual(
    languageAlternates(""),
  );
  expect(await meta(page, 'property="og:locale"')).toBe("pl_PL");
  expect(await meta(page, 'property="og:image"')).toBe(absolute(ogImage.src));
});

test("a gallery page names the collection and uses its cover as the Open Graph image", async ({
  page,
}) => {
  const business = category("business");
  await page.goto("/en/portfolio/business");
  await expect(page).toHaveTitle(texts.en.meta.galleryTitle(business.name.en));
  expect(business.description?.en).toBeTruthy();
  expect(await meta(page, 'name="description"')).toBe(business.description!.en);
  expect(await meta(page, 'property="og:description"')).toBe(business.description!.en);
  expect(await page.locator("body").innerText()).not.toContain(business.description!.en);
  expect(await headLinks(page, 'link[rel="canonical"]', "rel")).toEqual([
    ["canonical", absolute("/en/portfolio/business")],
  ]);
  expect(await meta(page, 'property="og:image"')).toBe(absolute(business.cover.src));
  expect(await meta(page, 'property="og:image:alt"')).toBe(business.cover.alt.en);
});

test("the sitemap lists landings, collections pages, the booking page and every gallery with alternates", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>(.*?)<\/loc>/)![1],
    alternates: [...body.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([, lang, href]) => [
      lang,
      href,
    ]),
  }));
  expect(categories).toHaveLength(3);
  const paths = [
    "",
    "/portfolio",
    "/booking",
    ...categories.map(({ slug }) => `/portfolio/${slug}`),
  ];
  expect(entries).toEqual(
    paths.flatMap((path) =>
      locales.map((locale) => ({
        loc: absolute(`/${locale}${path}`),
        alternates: languageAlternates(path),
      })),
    ),
  );
});

test("robots allows everything and points to the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/User-Agent: \*/i);
  expect(body).toMatch(/^Allow: \/$/m);
  expect(body).not.toMatch(/Disallow/);
  expect(body).toContain(`Sitemap: ${absolute("/sitemap.xml")}`);
});

test("the landing describes the local business in JSON-LD", async ({ page }) => {
  await page.goto("/en");
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((elements) => elements.map((element) => element.textContent ?? ""));
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts[0]);
  expect(data).toMatchObject({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    url: absolute("/en"),
    email: site.email,
    address: { addressLocality: "Kraków", addressCountry: "PL" },
  });
  expect(data.sameAs).toEqual(site.socials.map((social) => social.href));
  expect(data.telephone).toBe(phoneNumber(site.phone));
});
