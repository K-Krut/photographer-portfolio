import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingPicker, type BookingPickerLabels } from "@/components/BookingPicker";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { isBookingConfigured, readBookingConfig } from "@/lib/booking/config";
import { sessionPrice } from "@/lib/booking/price";
import { getBookingProvider } from "@/lib/booking/provider";
import { durations, horizonDay, warsawDay, type Duration } from "@/lib/booking/slots";
import { currency, getCategories, site, texts, type BookingTexts } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n";
import { bookingMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/booking">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return bookingMetadata(locale);
}

function pickerLabels(booking: BookingTexts): BookingPickerLabels {
  const hours = Object.fromEntries(
    durations.map((duration) => [duration, booking.duration.hours(duration)]),
  ) as Record<Duration, string>;
  return {
    timeZoneNote: booking.timeZoneNote,
    calendar: booking.calendar,
    duration: { label: booking.duration.label, hours },
    price: booking.price,
    times: booking.times,
    form: booking.form,
    errors: booking.errors,
    confirmation: { ...booking.confirmation, emailSent: booking.confirmation.emailSent("{email}") },
  };
}

async function Availability({ locale }: { locale: Locale }) {
  await io();
  const config = readBookingConfig();
  if (!config) return null;
  const now = getBookingProvider(config).now();
  const prices = Object.fromEntries(
    durations.map((duration) => [duration, sessionPrice(duration)]),
  ) as Record<Duration, number>;

  return (
    <BookingPicker
      locale={locale}
      today={warsawDay(now)}
      horizon={horizonDay(now)}
      labels={pickerLabels(texts[locale].booking)}
      prices={prices}
      currency={currency}
      sessionTypes={getCategories().map((category) => ({
        slug: category.slug,
        name: category.name[locale],
      }))}
    />
  );
}

export default async function BookingPage({
  params,
}: PageProps<"/[locale]/booking">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { headings, booking } = texts[locale];

  return (
    <PageTransition>
      <main>
        <section
          id="booking"
          aria-labelledby="booking-heading"
          className="mx-auto max-w-6xl px-5 pt-10 pb-16 md:px-10 md:pt-16 md:pb-24"
        >
          <h1
            id="booking-heading"
            className="text-xl uppercase tracking-[0.3em] md:text-2xl"
          >
            {headings.booking}
          </h1>
          {isBookingConfigured() ? (
            <Suspense
              fallback={
                <p aria-busy="true" className="mt-10 text-muted">
                  {booking.times.loading}
                </p>
              }
            >
              <Availability locale={locale} />
            </Suspense>
          ) : (
            <p className="mt-10 text-lg">
              {booking.notConfigured}{" "}
              <a
                href={`mailto:${site.email}`}
                className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] hover:decoration-current"
              >
                {site.email}
              </a>
            </p>
          )}
        </section>
      </main>
      <Footer locale={locale} />
    </PageTransition>
  );
}
