"use client";

import { useEffect, useRef, useState } from "react";
import { durations, type Duration } from "@/lib/booking/slots";
import type { Locale } from "@/lib/i18n";
import type { BookingTexts } from "@/lib/content";
import { revealElement } from "@/lib/smooth-scroll";
import { Arrow } from "./Arrow";
import { BookingConfirmation, type BookingConfirmationLabels } from "./BookingConfirmation";
import {
  BookingForm,
  emptyFormValues,
  type Confirmed,
  type FormValues,
  type SessionTypeOption,
} from "./BookingForm";

export type BookingPickerLabels = {
  timeZoneNote: string;
  calendar: { label: string; previousMonth: string; nextMonth: string };
  duration: { label: string; hours: Record<Duration, string> };
  price: string;
  times: {
    label: string;
    chooseDay: string;
    loading: string;
    none: string;
    error: string;
    retry: string;
  };
  form: BookingTexts["form"];
  errors: BookingTexts["errors"];
  confirmation: BookingConfirmationLabels;
};

type Start = { start: string; time: string };

type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

const loading = { status: "loading" } as const;

const hourMs = 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function monthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= count; day++) cells.push(`${month}-${pad(day)}`);
  return cells;
}

const weekdayAnchors = Array.from({ length: 7 }, (_, index) => utcDate(`2024-01-0${index + 1}`));

function pickDays(body: unknown): Set<string> {
  const days = (body as { days?: unknown }).days;
  return new Set(Array.isArray(days) ? days.filter((day) => typeof day === "string") : []);
}

function pickStarts(body: unknown): Start[] {
  const starts = (body as { starts?: unknown }).starts;
  return Array.isArray(starts)
    ? starts.filter(
        (item): item is Start =>
          typeof item?.start === "string" && typeof item?.time === "string",
      )
    : [];
}

function useLoad<T>(url: string | null, pick: (body: unknown) => T): [Load<T>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Load<T> } | null>(null);
  const key = url && `${url}#${attempt}`;

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setResult({ key, value: { status: "ready", data: pick(await response.json()) } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, value: { status: "error" } });
      });
    return () => controller.abort();
  }, [url, key, pick]);

  const state = result?.key === key ? result.value : loading;
  return [state, () => setAttempt((count) => count + 1)];
}

const control =
  "transition-[opacity,background-color,color] can-hover:hover:enabled:opacity-60 disabled:opacity-30";
const pressed = "aria-pressed:bg-foreground aria-pressed:text-background";
const included =
  "data-in-selection:bg-foreground/70 data-in-selection:text-background disabled:data-in-selection:opacity-100";
const square = `flex h-11 w-11 items-center justify-center ${control}`;
const option = `min-h-11 border border-current px-4 text-sm tracking-[0.15em] ${control} ${pressed}`;

function RetryError({
  message,
  retry,
  onRetry,
}: {
  message: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`border border-current px-4 py-2 text-xs uppercase tracking-[0.2em] ${control}`}
      >
        {retry}
      </button>
    </div>
  );
}

export function BookingPicker({
  locale,
  today,
  horizon,
  labels,
  prices,
  currency,
  sessionTypes,
}: {
  locale: Locale;
  today: string;
  horizon: string;
  labels: BookingPickerLabels;
  prices: Record<Duration, number>;
  currency: string;
  sessionTypes: SessionTypeOption[];
}) {
  const firstMonth = today.slice(0, 7);
  const lastMonth = horizon.slice(0, 7);
  const [month, setMonth] = useState(firstMonth);
  const [duration, setDuration] = useState<Duration>(1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues);
  const [reveal, setReveal] = useState<{ target: "form" | "slotTaken"; count: number } | null>(null);
  const formSection = useRef<HTMLElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const slotTakenMessage = useRef<HTMLParagraphElement>(null);

  const [days, retryDays] = useLoad(
    `/api/booking/days?month=${month}&duration=${duration}`,
    pickDays,
  );
  const dayStillOpen =
    days.status !== "ready" || month !== selectedDay?.slice(0, 7) || days.data.has(selectedDay);
  const activeDay = selectedDay && dayStillOpen ? selectedDay : null;
  const [starts, retryStarts] = useLoad(
    activeDay && `/api/booking/starts?day=${activeDay}&duration=${duration}`,
    pickStarts,
  );
  const [freeHours, retryFreeHours] = useLoad(
    activeDay && duration !== 1 ? `/api/booking/starts?day=${activeDay}&duration=1` : null,
    pickStarts,
  );
  const hours = duration === 1 ? starts : freeHours;
  const times: Load<{ hours: Start[]; starts: Set<string> }> =
    starts.status === "error" || hours.status === "error"
      ? { status: "error" }
      : starts.status === "ready" && hours.status === "ready"
        ? {
            status: "ready",
            data: {
              hours: [
                ...new Map(
                  [...hours.data, ...starts.data].map((item) => [item.start, item] as const),
                ).values(),
              ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
              starts: new Set(starts.data.map((item) => item.start)),
            },
          }
        : loading;
  const retryTimes = () => {
    retryStarts();
    retryFreeHours();
  };
  const activeStart =
    starts.status === "ready"
      ? (starts.data.find((item) => item.start === selectedStart) ?? null)
      : null;
  const activeStartMs = activeStart ? Date.parse(activeStart.start) : null;
  const activeEndMs = activeStartMs === null ? null : activeStartMs + duration * hourMs;

  useEffect(() => {
    if (!reveal) return;
    const forForm = reveal.target === "form";
    const target = forForm ? formSection.current : slotTakenMessage.current;
    if (!target) return;
    revealElement(target, forForm ? "start" : "center");
    (forForm ? formHeading.current : target)?.focus({ preventScroll: true });
  }, [reveal]);

  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Warsaw",
  });

  const chooseStart = (start: string | null) => {
    setSelectedStart(start);
    setSlotTaken(false);
  };
  const chooseDuration = (value: Duration) => {
    setDuration(value);
    chooseStart(null);
  };
  const chooseDay = (day: string) => {
    setSelectedDay(day);
    chooseStart(null);
  };
  const pickStart = (start: string) => {
    chooseStart(start);
    setReveal((current) => ({ target: "form", count: (current?.count ?? 0) + 1 }));
  };
  const handleSlotTaken = () => {
    setSelectedStart(null);
    setSlotTaken(true);
    setReveal((current) => ({ target: "slotTaken", count: (current?.count ?? 0) + 1 }));
    retryTimes();
    retryDays();
  };

  if (confirmed) {
    return (
      <div data-booking-picker data-confirmed className="mt-10">
        <BookingConfirmation
          locale={locale}
          confirmed={confirmed}
          labels={labels.confirmation}
          formLabels={labels.form}
          durationLabel={labels.duration.label}
          hours={labels.duration.hours}
          priceLabel={labels.price}
          currency={currency}
          sessionTypes={sessionTypes}
        />
      </div>
    );
  }

  return (
    <div
      data-booking-picker
      data-duration={duration}
      data-selected-day={activeDay ?? undefined}
      data-selected-start={activeStart?.start}
      className="mt-10"
    >
      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <section aria-labelledby="booking-calendar-label" data-calendar>
          <h2 id="booking-calendar-label" className="text-xs uppercase tracking-[0.25em] text-muted">
            {labels.calendar.label}
          </h2>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              type="button"
              aria-label={labels.calendar.previousMonth}
              disabled={month <= firstMonth}
              onClick={() => setMonth(shiftMonth(month, -1))}
              className={`${square} -ml-3`}
            >
              <Arrow direction="left" className="h-3 w-[1.125rem]" />
            </button>
            <p data-month={month} className="text-sm uppercase tracking-[0.25em]">
              {monthFormat.format(utcDate(`${month}-01`))}
            </p>
            <button
              type="button"
              aria-label={labels.calendar.nextMonth}
              disabled={month >= lastMonth}
              onClick={() => setMonth(shiftMonth(month, 1))}
              className={`${square} -mr-3`}
            >
              <Arrow direction="right" className="h-3 w-[1.125rem]" />
            </button>
          </div>
          {days.status === "error" ? (
            <div className="mt-6">
              <RetryError
                message={labels.times.error}
                retry={labels.times.retry}
                onRetry={retryDays}
              />
            </div>
          ) : (
            <div
              data-days
              aria-busy={days.status === "loading"}
              className="mt-4 grid grid-cols-7 gap-y-1 text-center"
            >
              {weekdayAnchors.map((anchor) => (
                <div
                  key={anchor.toISOString()}
                  aria-hidden="true"
                  className="py-2 text-xs uppercase tracking-[0.2em] text-muted"
                >
                  {weekdayFormat.format(anchor)}
                </div>
              ))}
              {monthCells(month).map((day, index) =>
                day ? (
                  <div key={day} className="flex justify-center">
                    <button
                      type="button"
                      data-day={day}
                      aria-label={dayFormat.format(utcDate(day))}
                      aria-pressed={day === activeDay}
                      disabled={days.status !== "ready" || !days.data.has(day)}
                      onClick={() => chooseDay(day)}
                      className={`${square} ${pressed}`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </div>
                ) : (
                  <div key={`empty-${index}`} aria-hidden="true" />
                ),
              )}
            </div>
          )}
        </section>

        <div data-time-picker>
          <section aria-labelledby="booking-duration-label">
            <h2
              id="booking-duration-label"
              className="text-xs uppercase tracking-[0.25em] text-muted"
            >
              {labels.duration.label}
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div role="group" aria-labelledby="booking-duration-label" className="flex gap-2">
                {durations.map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-duration-option={value}
                    aria-pressed={value === duration}
                    onClick={() => chooseDuration(value)}
                    className={option}
                  >
                    {labels.duration.hours[value]}
                  </button>
                ))}
              </div>
              <p className="text-lg">
                <span className="text-muted">{labels.price}</span>{" "}
                <span data-price={prices[duration]}>
                  {prices[duration]} {currency}
                </span>
              </p>
            </div>
          </section>

          <section aria-labelledby="booking-times-label" className="mt-12">
            <h2 id="booking-times-label" className="text-xs uppercase tracking-[0.25em] text-muted">
              {labels.times.label}
            </h2>
            <p className="mt-2 text-sm text-muted">{labels.timeZoneNote}</p>
            <div className="mt-6">
              {!activeDay ? (
                <p>{labels.times.chooseDay}</p>
              ) : times.status === "loading" ? (
                <p aria-busy="true">{labels.times.loading}</p>
              ) : times.status === "error" ? (
                <RetryError
                  message={labels.times.error}
                  retry={labels.times.retry}
                  onRetry={retryTimes}
                />
              ) : times.data.starts.size === 0 ? (
                <p data-starts>{labels.times.none}</p>
              ) : (
                <ul data-starts className="flex flex-wrap gap-2">
                  {times.data.hours.map((item) => {
                    const startMs = Date.parse(item.start);
                    const bookable = times.data.starts.has(item.start);
                    const inSelection =
                      activeStartMs !== null &&
                      activeEndMs !== null &&
                      startMs > activeStartMs &&
                      startMs < activeEndMs;
                    return (
                      <li key={item.start}>
                        <button
                          type="button"
                          data-hour={item.start}
                          data-start={bookable ? item.start : undefined}
                          data-in-selection={inSelection || undefined}
                          aria-pressed={bookable ? item.start === activeStart?.start : undefined}
                          disabled={!bookable}
                          onClick={() => pickStart(item.start)}
                          className={`${option} ${included}`}
                        >
                          {item.time}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {activeDay && activeStart && activeEndMs !== null ? (
        <section
          ref={formSection}
          aria-labelledby="booking-form-heading"
          data-booking-selection
          className="mt-16"
        >
          <h2
            id="booking-form-heading"
            ref={formHeading}
            tabIndex={-1}
            data-quiet-focus
            className="text-xs uppercase tracking-[0.25em] text-muted"
          >
            {labels.form.heading}
          </h2>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            {[
              ["day", labels.form.day, dayFormat.format(utcDate(activeDay))],
              ["time", labels.form.time, `${activeStart.time}–${timeFormat.format(activeEndMs)}`],
              ["duration", labels.duration.label, labels.duration.hours[duration]],
              ["price", labels.price, `${prices[duration]} ${currency}`],
            ].map(([key, label, value]) => (
              <div key={key} data-detail={key}>
                <dt className="text-xs uppercase tracking-[0.25em] text-muted">{label}</dt>
                <dd className="mt-1 text-lg">{value}</dd>
              </div>
            ))}
          </dl>
          <BookingForm
            key={`${activeStart.start}/${duration}`}
            locale={locale}
            start={activeStart.start}
            duration={duration}
            labels={labels}
            sessionTypes={sessionTypes}
            values={formValues}
            onValueChange={(name, value) => setFormValues((current) => ({ ...current, [name]: value }))}
            onConfirmed={setConfirmed}
            onSlotTaken={handleSlotTaken}
          />
        </section>
      ) : (
        slotTaken && (
          <p
            ref={slotTakenMessage}
            role="alert"
            tabIndex={-1}
            data-quiet-focus
            data-booking-error="slotTaken"
            className="mt-16"
          >
            {labels.errors.slotTaken}
          </p>
        )
      )}
    </div>
  );
}
