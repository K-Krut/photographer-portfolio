import { NextResponse, type NextRequest } from "next/server";
import { readCollectionRoutes, type CollectionRoutes } from "@/lib/collection-files";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";

const startupRoutes =
  process.env.NODE_ENV === "development" ? undefined : readCollectionRoutes();

function collectionRoutes(): CollectionRoutes {
  return startupRoutes ?? readCollectionRoutes();
}

function preferredLocale(acceptLanguage: string | null): Locale {
  const languages = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.language);
  return languages.find(isLocale) ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    const locale = preferredLocale(request.headers.get("accept-language"));
    const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
    response.headers.set("Vary", "Accept-Language");
    return response;
  }
  const [, locale, section, slug, ...rest] = pathname.split("/");
  if (!isLocale(locale)) return notFound(request);
  if (section !== "portfolio" || slug === undefined) return;

  const { slugs, redirects, problems } = collectionRoutes();
  if (slugs.has(slug) || problems.length > 0) return;
  const target = redirects.get(slug);
  if (target && rest.length === 0) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/portfolio/${target}`;
    return NextResponse.redirect(url, 301);
  }
  return notFound(request);
}

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  matcher: "/((?!_next/|api/|.*\\.).*)",
};
