import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { PageTransition } from "@/components/PageTransition";
import { Portfolio } from "@/components/Portfolio";
import { Price } from "@/components/Price";
import { isLocale } from "@/lib/i18n";
import { businessJsonLd, landingMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return landingMetadata(locale);
}

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <PageTransition>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessJsonLd(locale)).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        <Hero locale={locale} />
        <Portfolio locale={locale} />
        <Price locale={locale} />
      </main>
      <Footer locale={locale} />
    </PageTransition>
  );
}
