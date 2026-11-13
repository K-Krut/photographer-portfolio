import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { InputModality } from "@/components/InputModality";
import { NavigationHistory } from "@/components/NavigationHistory";
import { SmoothScroll } from "@/components/SmoothScroll";
import { site } from "@/lib/content";
import { jost } from "@/lib/font";
import { isLocale, locales } from "@/lib/i18n";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
};

export const viewport: Viewport = {
  themeColor: "#000",
  viewportFit: "cover",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${jost.variable} antialiased`}
    >
      <body className="pt-(--header-height) pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <Header locale={locale} />
        {children}
        <SmoothScroll />
        <NavigationHistory />
        <InputModality />
      </body>
    </html>
  );
}
