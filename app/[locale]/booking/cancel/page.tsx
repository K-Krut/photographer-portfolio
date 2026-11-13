import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BookingCancel } from "@/components/BookingCancel";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { lookUpCancellation, type CancelLookup } from "@/lib/booking/cancellation";
import { readBookingConfig } from "@/lib/booking/config";
import { getBookingProvider, type Reservation } from "@/lib/booking/provider";
import { timeZone } from "@/lib/booking/slots";
import { getCategories, site, texts } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/booking/cancel">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: texts[locale].meta.bookingCancelTitle,
    robots: { index: false, follow: false },
  };
}

const linkClass =
  "underline decoration-transparent underline-offset-4 transition-[text-decoration-color] hover:decoration-current";

function Message({ state, children }: { state: string; children: ReactNode }) {
  return (
    <p data-cancel-state={state} className="mt-8 text-lg">
      {children}
    </p>
  );
}

function ContactEmail() {
  return (
    <a href={`mailto:${site.email}`} data-contact-email className={linkClass}>
      {site.email}
    </a>
  );
}

function Details({ locale, reservation }: { locale: Locale; reservation: Reservation }) {
  const booking = texts[locale].booking;
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  const sessionType = getCategories().find((category) => category.slug === reservation.sessionType)
    ?.name[locale];
  const details: [string, string, string | undefined][] = [
    ["day", booking.form.day, day.format(reservation.start)],
    ["time", booking.confirmation.time, `${time.format(reservation.start)}–${time.format(reservation.end)}`],
    ["duration", booking.duration.label, booking.duration.hours(reservation.duration)],
    ["sessionType", booking.confirmation.sessionType, sessionType],
  ];

  return (
    <dl
      data-cancel-details
      data-reservation-id={reservation.id}
      className="mt-8 grid max-w-2xl grid-cols-[auto_1fr] gap-x-8 gap-y-3"
    >
      {details.map(([key, label, value]) =>
        value ? (
          <div key={key} data-detail={key} className="contents">
            <dt className="text-xs uppercase leading-7 tracking-[0.25em] text-muted">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

async function CancelState({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await io();
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw : "";
  const { booking } = texts[locale];
  const labels = booking.cancel;
  const config = readBookingConfig();
  if (!config) {
    return (
      <Message state="notConfigured">
        {booking.notConfigured} <ContactEmail />
      </Message>
    );
  }

  let lookup: CancelLookup;
  try {
    lookup = await lookUpCancellation(token, config.tokenSecret, getBookingProvider(config));
  } catch (error) {
    console.error("Booking provider failed", error);
    return <Message state="failed">{labels.failed}</Message>;
  }

  if (lookup.status === "invalid") return <Message state="invalid">{labels.invalid}</Message>;
  if (lookup.status === "alreadyCancelled") {
    return <Message state="alreadyCancelled">{labels.alreadyCancelled}</Message>;
  }

  return (
    <>
      <Details locale={locale} reservation={lookup.reservation} />
      {lookup.status === "open" ? (
        <BookingCancel token={token} labels={labels} />
      ) : lookup.kind === "visitor" ? (
        <Message state="tooLate">
          {labels.tooLate} <ContactEmail />
        </Message>
      ) : (
        <Message state="tooLate">{labels.started}</Message>
      )}
    </>
  );
}

export default async function BookingCancelPage({
  params,
  searchParams,
}: PageProps<"/[locale]/booking/cancel">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { headings, booking } = texts[locale];

  return (
    <PageTransition>
      <main>
        <section
          id="booking-cancel"
          aria-labelledby="booking-cancel-heading"
          className="mx-auto max-w-6xl px-5 pt-10 pb-16 md:px-10 md:pt-16 md:pb-24"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{headings.booking}</p>
          <h1
            id="booking-cancel-heading"
            className="mt-4 text-xl uppercase tracking-[0.3em] md:text-2xl"
          >
            {booking.cancel.heading}
          </h1>
          <Suspense
            fallback={
              <p aria-busy="true" className="mt-8 text-muted">
                {booking.times.loading}
              </p>
            }
          >
            <CancelState locale={locale} searchParams={searchParams} />
          </Suspense>
          <Link href={`/${locale}/booking`} data-back-to-booking className={`mt-10 inline-block ${linkClass}`}>
            {booking.cancel.backToBooking}
          </Link>
        </section>
      </main>
      <Footer locale={locale} />
    </PageTransition>
  );
}
