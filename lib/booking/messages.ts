import type { Locale } from "../i18n";
import {
  mailtoHref,
  renderEmailHtml,
  telegramHref,
  telHref,
  type EmailBlock,
  type EmailRow,
  type EmailSite,
} from "./email-html.ts";
import type { EmailAttachment, EmailMessage, Reservation } from "./provider";
import { timeZone } from "./slots.ts";
import type { CancelKind } from "./tokens";

export type MessageSite = EmailSite;

export type ReservationMessageContext = {
  site: MessageSite;
  currency: string;
  sessionTypeName?: string;
  cancelUrl: string;
};

export type PlainMessage = { subject: string; text: string };

type Labels = {
  day: string;
  start: string;
  time: string;
  duration: string;
  price: string;
  sessionType: string;
  name: string;
  email: string;
  phone: string;
  telegram: string;
  comment: string;
};

type MessageTexts = {
  labels: Labels;
  hours: (hours: number) => string;
  warsawTime: string;
  actions: { cancel: string; rebook: string };
  visitorReservation: {
    subject: (day: string, time: string) => string;
    greeting: (name: string) => string;
    reserved: string;
    contact: string;
    cancel: string;
    questions: (email: string) => string;
    calendarFile: string;
  };
  photographerReservation: {
    subject: (name: string, day: string, time: string) => string;
    intro: string;
    cancel: string;
  };
  calendarSummary: (siteName: string) => string;
  cancellation: {
    visitorSubject: (day: string, time: string) => string;
    byVisitor: {
      visitor: string;
      photographerSubject: (name: string, day: string, time: string) => string;
      photographer: string;
    };
    byPhotographer: {
      visitor: string;
      rebook: string;
      photographerSubject: (name: string, day: string, time: string) => string;
      photographer: string;
    };
  };
};

export const messageTexts: Record<Locale, MessageTexts> = {
  en: {
    labels: {
      day: "Day",
      start: "Start",
      time: "Time",
      duration: "Duration",
      price: "Price",
      sessionType: "Session type",
      name: "Name",
      email: "E-mail",
      phone: "Phone",
      telegram: "Telegram",
      comment: "Comment",
    },
    hours: (hours) => `${hours} ${hours === 1 ? "hour" : "hours"}`,
    warsawTime: "Warsaw time",
    actions: { cancel: "Cancel the reservation", rebook: "Book a session" },
    visitorReservation: {
      subject: (day, time) => `Your photo session is reserved: ${day}, ${time}`,
      greeting: (name) => `Hello ${name},`,
      reserved: "your photo session is reserved.",
      contact: "I will contact you shortly to confirm the details.",
      cancel: "To cancel the reservation, open this link (it works until 24 hours before the start):",
      questions: (email) => `If you have any questions, write to ${email}.`,
      calendarFile: "The session is attached as a calendar file.",
    },
    photographerReservation: {
      subject: (name, day, time) => `New reservation: ${name}, ${day}, ${time}`,
      intro: "A new session has been reserved on the site.",
      cancel: "To cancel the reservation, open this link (it works until the start of the session):",
    },
    calendarSummary: (siteName) => `Photo session — ${siteName}`,
    cancellation: {
      visitorSubject: (day, time) => `Your photo session is cancelled: ${day}, ${time}`,
      byVisitor: {
        visitor: "your reservation is cancelled as you requested.",
        photographerSubject: (name, day, time) => `Reservation cancelled by the client: ${name}, ${day}, ${time}`,
        photographer: "The client has cancelled this reservation. The time is free again on the site.",
      },
      byPhotographer: {
        visitor: "unfortunately I have to cancel your photo session. I am sorry for the inconvenience.",
        rebook: "You can choose another time on the booking page:",
        photographerSubject: (name, day, time) => `You cancelled the reservation: ${name}, ${day}, ${time}`,
        photographer: "You have cancelled this reservation. The client has been notified by e-mail.",
      },
    },
  },
  pl: {
    labels: {
      day: "Dzień",
      start: "Początek",
      time: "Godzina",
      duration: "Czas trwania",
      price: "Cena",
      sessionType: "Rodzaj sesji",
      name: "Imię",
      email: "E-mail",
      phone: "Telefon",
      telegram: "Telegram",
      comment: "Komentarz",
    },
    hours: (hours) => `${hours} ${hours === 1 ? "godzina" : "godziny"}`,
    warsawTime: "czasu warszawskiego",
    actions: { cancel: "Anuluj rezerwację", rebook: "Zarezerwuj sesję" },
    visitorReservation: {
      subject: (day, time) => `Sesja zdjęciowa zarezerwowana: ${day}, ${time}`,
      greeting: (name) => `Dzień dobry, ${name},`,
      reserved: "Twoja sesja zdjęciowa jest zarezerwowana.",
      contact: "Wkrótce skontaktuję się z Tobą, aby potwierdzić szczegóły.",
      cancel: "Aby anulować rezerwację, otwórz ten link (działa do 24 godzin przed rozpoczęciem):",
      questions: (email) => `W razie pytań napisz na ${email}.`,
      calendarFile: "Sesja jest dołączona jako plik kalendarza.",
    },
    photographerReservation: {
      subject: (name, day, time) => `Nowa rezerwacja: ${name}, ${day}, ${time}`,
      intro: "Na stronie zarezerwowano nową sesję.",
      cancel: "Aby anulować rezerwację, otwórz ten link (działa do rozpoczęcia sesji):",
    },
    calendarSummary: (siteName) => `Sesja zdjęciowa — ${siteName}`,
    cancellation: {
      visitorSubject: (day, time) => `Sesja zdjęciowa anulowana: ${day}, ${time}`,
      byVisitor: {
        visitor: "Twoja rezerwacja została anulowana zgodnie z prośbą.",
        photographerSubject: (name, day, time) => `Klient anulował rezerwację: ${name}, ${day}, ${time}`,
        photographer: "Klient anulował tę rezerwację. Termin jest znowu wolny na stronie.",
      },
      byPhotographer: {
        visitor: "niestety muszę odwołać Twoją sesję zdjęciową. Przepraszam za kłopot.",
        rebook: "Możesz wybrać inny termin na stronie rezerwacji:",
        photographerSubject: (name, day, time) => `Anulowano rezerwację: ${name}, ${day}, ${time}`,
        photographer: "Rezerwacja została anulowana. Klient otrzymał powiadomienie e-mailem.",
      },
    },
  },
};

function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

function detailLines(entries: [string, string | undefined][]): string {
  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => (value.includes("\n") ? `${label}:\n${value}` : `${label}: ${value}`))
    .join("\n");
}

function sessionDetails(reservation: Reservation, context: CancellationMessageContext) {
  const { locale } = reservation;
  const texts = messageTexts[locale];
  const day = formatDay(reservation.start, locale);
  const time = formatTime(reservation.start, locale);
  const entries: [string, string | undefined][] = [
    [texts.labels.day, day],
    [texts.labels.start, `${time} (${texts.warsawTime})`],
    [texts.labels.duration, texts.hours(reservation.duration)],
    [texts.labels.price, `${reservation.price} ${context.currency}`],
    [texts.labels.sessionType, context.sessionTypeName],
  ];
  const rows: EmailRow[] = [
    { label: texts.labels.day, value: day },
    { label: texts.labels.time, value: `${time}–${formatTime(reservation.end, locale)} (${texts.warsawTime})` },
    { label: texts.labels.duration, value: texts.hours(reservation.duration) },
    { label: texts.labels.price, value: `${reservation.price} ${context.currency}` },
    ...(context.sessionTypeName ? [{ label: texts.labels.sessionType, value: context.sessionTypeName }] : []),
  ];
  const summary = `${day}, ${rows[1].value}`;
  return { texts, day, time, entries, rows, summary };
}

function contactRows(reservation: Reservation, withComment: boolean): EmailRow[] {
  const { labels } = messageTexts[reservation.locale];
  const { name, email, phone, telegram, comment } = reservation;
  const rows: (EmailRow | false)[] = [
    { label: labels.name, value: name },
    { label: labels.email, value: email, href: mailtoHref(email) },
    Boolean(phone) && { label: labels.phone, value: phone, href: telHref(phone) },
    Boolean(telegram) && { label: labels.telegram, value: telegram!, href: telegramHref(telegram!) },
    withComment && Boolean(comment) && { label: labels.comment, value: comment! },
  ];
  return rows.filter((row): row is EmailRow => Boolean(row));
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function emailHtml(
  reservation: Reservation,
  site: MessageSite,
  title: string,
  preheader: string,
  blocks: EmailBlock[],
): string {
  return renderEmailHtml({ locale: reservation.locale, title, preheader, site, blocks });
}

function questionsBlock(texts: MessageTexts, site: MessageSite): EmailBlock {
  return {
    type: "text",
    text: texts.visitorReservation.questions(site.email),
    link: { text: site.email, href: mailtoHref(site.email) },
    tone: "muted",
  };
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeCalendarText(value: string): string {
  return value.replace(/[\\;,]/g, (character) => `\\${character}`).replace(/\r?\n/g, "\\n");
}

export function reservationCalendarFile(
  reservation: Reservation,
  context: ReservationMessageContext,
): EmailAttachment {
  const host = new URL(context.site.url).hostname;
  const summary = messageTexts[reservation.locale].calendarSummary(context.site.name);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeCalendarText(context.site.name)}//Booking//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeCalendarText(reservation.id)}@${host}`,
    `DTSTAMP:${utcStamp(reservation.createdAt)}`,
    `DTSTART:${utcStamp(reservation.start)}`,
    `DTEND:${utcStamp(reservation.end)}`,
    `SUMMARY:${escapeCalendarText(summary)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    filename: "session.ics",
    contentType: "text/calendar; charset=utf-8; method=PUBLISH",
    content: `${lines.join("\r\n")}\r\n`,
  };
}

export function visitorReservationEmail(
  reservation: Reservation,
  context: ReservationMessageContext,
): EmailMessage {
  const { texts, day, time, entries, rows, summary } = sessionDetails(reservation, context);
  const message = texts.visitorReservation;
  const subject = message.subject(day, time);
  const text = [
    message.greeting(reservation.name),
    message.reserved,
    detailLines(entries),
    message.contact,
    `${message.cancel}\n${context.cancelUrl}`,
    message.questions(context.site.email),
    message.calendarFile,
    context.site.name,
  ].join("\n\n");
  const html = emailHtml(reservation, context.site, subject, `${sentence(message.reserved)} ${summary}`, [
    { type: "text", text: message.greeting(reservation.name), tone: "lead" },
    { type: "text", text: message.reserved },
    { type: "details", rows },
    { type: "text", text: message.contact },
    { type: "button", intro: message.cancel, label: texts.actions.cancel, url: context.cancelUrl },
    questionsBlock(texts, context.site),
    { type: "text", text: message.calendarFile, tone: "muted" },
  ]);
  return {
    fromName: context.site.name,
    to: reservation.email,
    subject,
    text,
    html,
    attachment: reservationCalendarFile(reservation, context),
  };
}

export function photographerReservationMessage(
  reservation: Reservation,
  context: ReservationMessageContext,
): PlainMessage {
  const { texts, day, time, entries } = sessionDetails(reservation, context);
  const message = texts.photographerReservation;
  const contacts: [string, string | undefined][] = [
    [texts.labels.name, reservation.name],
    [texts.labels.email, reservation.email],
    [texts.labels.phone, reservation.phone],
    [texts.labels.telegram, reservation.telegram],
    [texts.labels.comment, reservation.comment],
  ];
  const text = [
    message.intro,
    detailLines(entries),
    detailLines(contacts),
    `${message.cancel}\n${context.cancelUrl}`,
  ].join("\n\n");
  return { subject: message.subject(reservation.name, day, time), text };
}

export function photographerReservationEmail(
  reservation: Reservation,
  context: ReservationMessageContext,
  to: string,
): EmailMessage {
  const plain = photographerReservationMessage(reservation, context);
  const { texts, rows, summary } = sessionDetails(reservation, context);
  const message = texts.photographerReservation;
  const html = emailHtml(reservation, context.site, plain.subject, `${reservation.name}: ${summary}`, [
    { type: "text", text: message.intro, tone: "lead" },
    { type: "details", rows },
    { type: "details", rows: contactRows(reservation, true) },
    { type: "button", intro: message.cancel, label: texts.actions.cancel, url: context.cancelUrl },
  ]);
  return {
    fromName: context.site.name,
    to,
    replyTo: reservation.email,
    ...plain,
    html,
  };
}

export type CancellationMessageContext = Omit<ReservationMessageContext, "cancelUrl">;

export function bookingPageUrl(siteUrl: string, locale: Locale): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/booking`;
}

export function visitorCancellationEmail(
  reservation: Reservation,
  kind: CancelKind,
  context: CancellationMessageContext,
): EmailMessage {
  const { texts, day, time, entries, rows, summary } = sessionDetails(reservation, context);
  const bookingUrl = bookingPageUrl(context.site.url, reservation.locale);
  const subject = texts.cancellation.visitorSubject(day, time);
  const status =
    kind === "visitor" ? texts.cancellation.byVisitor.visitor : texts.cancellation.byPhotographer.visitor;
  const rebook: EmailBlock[] =
    kind === "visitor"
      ? []
      : [
          {
            type: "button",
            intro: texts.cancellation.byPhotographer.rebook,
            label: texts.actions.rebook,
            url: bookingUrl,
          },
        ];
  const parts =
    kind === "visitor"
      ? [texts.cancellation.byVisitor.visitor, detailLines(entries)]
      : [
          texts.cancellation.byPhotographer.visitor,
          detailLines(entries),
          `${texts.cancellation.byPhotographer.rebook}\n${bookingUrl}`,
        ];
  const text = [
    texts.visitorReservation.greeting(reservation.name),
    ...parts,
    texts.visitorReservation.questions(context.site.email),
    context.site.name,
  ].join("\n\n");
  const html = emailHtml(reservation, context.site, subject, `${sentence(status)} ${summary}`, [
    { type: "text", text: texts.visitorReservation.greeting(reservation.name), tone: "lead" },
    { type: "text", text: status },
    { type: "details", rows },
    ...rebook,
    questionsBlock(texts, context.site),
  ]);
  return {
    fromName: context.site.name,
    to: reservation.email,
    subject,
    text,
    html,
  };
}

export function photographerCancellationMessage(
  reservation: Reservation,
  kind: CancelKind,
  context: CancellationMessageContext,
): PlainMessage {
  const { texts, day, time, entries } = sessionDetails(reservation, context);
  const message = kind === "visitor" ? texts.cancellation.byVisitor : texts.cancellation.byPhotographer;
  const contacts: [string, string | undefined][] = [
    [texts.labels.name, reservation.name],
    [texts.labels.email, reservation.email],
    [texts.labels.phone, reservation.phone],
    [texts.labels.telegram, reservation.telegram],
  ];
  const text = [message.photographer, detailLines(entries), detailLines(contacts)].join("\n\n");
  return { subject: message.photographerSubject(reservation.name, day, time), text };
}

export function photographerCancellationEmail(
  reservation: Reservation,
  kind: CancelKind,
  context: CancellationMessageContext,
  to: string,
): EmailMessage {
  const plain = photographerCancellationMessage(reservation, kind, context);
  const { texts, rows, summary } = sessionDetails(reservation, context);
  const message = kind === "visitor" ? texts.cancellation.byVisitor : texts.cancellation.byPhotographer;
  const html = emailHtml(reservation, context.site, plain.subject, `${reservation.name}: ${summary}`, [
    { type: "text", text: message.photographer, tone: "lead" },
    { type: "details", rows },
    { type: "details", rows: contactRows(reservation, false) },
  ]);
  return {
    fromName: context.site.name,
    to,
    replyTo: reservation.email,
    ...plain,
    html,
  };
}
