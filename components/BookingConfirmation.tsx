"use client";

import { useEffect, useRef } from "react";
import type { Duration } from "@/lib/booking/slots";
import type { BookingTexts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { revealElement } from "@/lib/smooth-scroll";
import type { Confirmed, SessionTypeOption } from "./BookingForm";

export type BookingConfirmationLabels = Omit<BookingTexts["confirmation"], "emailSent"> & {
  emailSent: string;
};

export function BookingConfirmation({
  locale,
  confirmed: { reservation, cancelUrl },
  labels,
  formLabels,
  durationLabel,
  hours,
  priceLabel,
  currency,
  sessionTypes,
}: {
  locale: Locale;
  confirmed: Confirmed;
  labels: BookingConfirmationLabels;
  formLabels: BookingTexts["form"];
  durationLabel: string;
  hours: Record<Duration, string>;
  priceLabel: string;
  currency: string;
  sessionTypes: SessionTypeOption[];
}) {
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (section.current) revealElement(section.current);
    heading.current?.focus({ preventScroll: true });
  }, []);

  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Warsaw",
  });
  const start = new Date(reservation.start);
  const end = new Date(reservation.end);
  const sessionType = sessionTypes.find((type) => type.slug === reservation.sessionType)?.name;

  const details: [string, string, string | undefined][] = [
    ["day", formLabels.day, dayFormat.format(start)],
    ["time", labels.time, `${timeFormat.format(start)}–${timeFormat.format(end)}`],
    ["duration", durationLabel, hours[reservation.duration]],
    ["price", priceLabel, `${reservation.price} ${currency}`],
    ["sessionType", labels.sessionType, sessionType],
    ["name", formLabels.name, reservation.name],
    ["email", formLabels.email, reservation.email],
    ["phone", formLabels.phone, reservation.phone],
    ["telegram", labels.telegram, reservation.telegram],
  ];
  const [before, after = ""] = labels.emailSent.split("{email}");

  return (
    <section
      ref={section}
      data-booking-confirmation
      data-reservation-id={reservation.id}
      aria-labelledby="booking-confirmation-heading"
      className="max-w-2xl"
    >
      <h2
        id="booking-confirmation-heading"
        ref={heading}
        tabIndex={-1}
        data-quiet-focus
        className="text-lg uppercase tracking-[0.25em]"
      >
        {labels.heading}
      </h2>
      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
        {details.map(([key, label, value]) =>
          value ? (
            <div key={key} data-detail={key} className="contents">
              <dt className="text-xs uppercase leading-7 tracking-[0.25em] text-muted">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="mt-8">{labels.contact}</p>
      <p className="mt-2 text-muted">
        {before}
        <span className="text-foreground">{reservation.email}</span>
        {after}
      </p>
      <a
        href={cancelUrl}
        data-cancel-link
        className="mt-8 inline-block underline underline-offset-4 transition-opacity can-hover:hover:opacity-60"
      >
        {labels.cancel}
      </a>
    </section>
  );
}
