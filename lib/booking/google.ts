import { createSign } from "node:crypto";
import nodemailer from "nodemailer";
import { defaultLocale, isLocale } from "../i18n.ts";
import type { RealBookingConfig } from "./config";
import type { BookingProvider, EmailMessage, Reservation, ReservationInput } from "./provider";
import { durations, timeZone, warsawDate, type Interval } from "./slots.ts";

type EventTime = { date?: string; dateTime?: string; timeZone?: string };

export type CalendarEvent = {
  id: string;
  status?: string;
  created?: string;
  summary?: string;
  description?: string;
  start?: EventTime;
  end?: EventTime;
  extendedProperties?: { private?: Record<string, string> };
};

export type CalendarEventBody = Omit<CalendarEvent, "id" | "status" | "created">;

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
};

type EventsPage = { items?: CalendarEvent[]; nextPageToken?: string };

type Credentials = RealBookingConfig["google"];

type Token = { clientEmail: string; value: string; expiresAt: number };

export const markerProperty = "revich.booking";

const apiBase = "https://www.googleapis.com/calendar/v3";
const tokenUrl = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/calendar";
const hourMs = 60 * 60 * 1000;
const propertyValueLimit = 1024;

export class GoogleApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

export function formatDescription(input: ReservationInput): string {
  const lines = [
    `Name: ${input.name}`,
    `E-mail: ${input.email}`,
    `Phone: ${input.phone}`,
    input.telegram ? `Telegram: ${input.telegram}` : null,
    `Session: ${input.sessionType ?? "—"}`,
    `Duration: ${input.duration} h`,
    `Price: ${input.price} PLN`,
    `Language: ${input.locale}`,
    input.comment ? `\nComment:\n${input.comment}` : null,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export function buildEvent(input: ReservationInput): CalendarEventBody {
  const properties: Record<string, string> = {
    [markerProperty]: "1",
    name: input.name,
    email: input.email,
    phone: input.phone,
    locale: input.locale,
    duration: String(input.duration),
    price: String(input.price),
  };
  if (input.telegram) properties.telegram = input.telegram;
  if (input.sessionType) properties.sessionType = input.sessionType;
  if (input.comment) properties.comment = input.comment.slice(0, propertyValueLimit);
  return {
    summary: `${input.name} — ${input.sessionType ?? "Session"}`,
    description: formatDescription(input),
    start: { dateTime: input.start.toISOString(), timeZone },
    end: { dateTime: input.end.toISOString(), timeZone },
    extendedProperties: { private: properties },
  };
}

function instant(time: EventTime | undefined): Date | null {
  if (time?.dateTime) {
    const date = new Date(time.dateTime);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (time?.date) return warsawDate(time.date, 0);
  return null;
}

export function eventBusyInterval(event: CalendarEvent): Interval | null {
  if (event.status === "cancelled") return null;
  const start = instant(event.start);
  const end = instant(event.end);
  return start && end ? { start, end } : null;
}

export function readReservation(event: CalendarEvent): Reservation | null {
  const properties = event.extendedProperties?.private ?? {};
  if (properties[markerProperty] !== "1") return null;
  const interval = eventBusyInterval(event);
  if (!interval) return null;
  const { start, end } = interval;
  const hours = Math.round((end.getTime() - start.getTime()) / hourMs);
  const duration =
    durations.find((candidate) => String(candidate) === properties.duration) ??
    durations.find((candidate) => candidate === hours) ??
    1;
  const locale = properties.locale && isLocale(properties.locale) ? properties.locale : defaultLocale;
  return {
    id: event.id,
    createdAt: new Date(event.created ?? 0),
    start,
    end,
    duration,
    price: Number(properties.price) || 0,
    locale,
    name: properties.name ?? "",
    email: properties.email ?? "",
    phone: properties.phone ?? "",
    telegram: properties.telegram,
    sessionType: properties.sessionType,
    comment: properties.comment,
  };
}

let cachedToken: Token | undefined;

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

async function fetchToken({ clientEmail, privateKey }: Credentials): Promise<Token> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: clientEmail, scope, aud: tokenUrl, iat: issuedAt, exp: issuedAt + 3600 }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new GoogleApiError(response.status, `Google token request failed: ${await response.text()}`);
  }
  const { access_token, expires_in } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { clientEmail, value: access_token, expiresAt: Date.now() + expires_in * 1000 };
}

async function accessToken(credentials: Credentials): Promise<string> {
  const fresh =
    cachedToken?.clientEmail === credentials.clientEmail &&
    cachedToken.expiresAt - Date.now() > 60 * 1000;
  if (!fresh) cachedToken = await fetchToken(credentials);
  return cachedToken!.value;
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
  } catch {}
  return text || response.statusText;
}

async function call<T>(
  credentials: Credentials,
  method: "GET" | "POST" | "DELETE",
  path: string,
  query: Record<string, string | undefined> = {},
  body?: unknown,
): Promise<T> {
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${await accessToken(credentials)}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      `Google Calendar ${method} ${path} failed with ${response.status}: ${await errorMessage(response)}`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function isGone(error: unknown): boolean {
  return error instanceof GoogleApiError && (error.status === 404 || error.status === 410);
}

function notImplemented(operation: string): never {
  throw new Error(`Google booking provider: ${operation} is not implemented yet`);
}

export function mailOptions(sender: string, message: EmailMessage) {
  const { fromName, to, subject, text, html, replyTo, attachment } = message;
  return {
    from: fromName ? { name: fromName, address: sender } : sender,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(attachment ? { attachments: [attachment] } : {}),
  };
}

function createGmailTransport({ address, appPassword }: RealBookingConfig["gmail"]) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: address, pass: appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function createGoogleBookingProvider(config: RealBookingConfig): BookingProvider {
  const credentials = config.google;
  const mailer = createGmailTransport(config.gmail);
  const eventsPath = `/calendars/${encodeURIComponent(config.bookingsCalendarId)}/events`;
  const eventPath = (id: string) => `${eventsPath}/${encodeURIComponent(id)}`;

  async function listEvents(range: Interval, query: Record<string, string> = {}): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;
    do {
      const page = await call<EventsPage>(credentials, "GET", eventsPath, {
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        maxResults: "250",
        ...query,
        pageToken,
      });
      events.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return events;
  }

  async function freeBusy(range: Interval): Promise<Interval[]> {
    const ids = [...new Set(config.blockingCalendarIds)].filter((id) => id !== config.bookingsCalendarId);
    if (ids.length === 0) return [];
    const result = await call<FreeBusyResponse>(credentials, "POST", "/freeBusy", {}, {
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      timeZone,
      items: ids.map((id) => ({ id })),
    });
    const busy: Interval[] = [];
    for (const id of ids) {
      const entry = result.calendars?.[id];
      if (!entry) throw new Error(`Free/busy query returned nothing for calendar ${id}`);
      if (entry.errors?.length) {
        const reasons = entry.errors.map((error) => error.reason).join(", ");
        throw new Error(`Free/busy query failed for calendar ${id}: ${reasons}`);
      }
      for (const { start, end } of entry.busy ?? []) {
        busy.push({ start: new Date(start), end: new Date(end) });
      }
    }
    return busy;
  }

  return {
    now: () => new Date(),

    async busyIntervals(range: Interval) {
      const [busy, events] = await Promise.all([freeBusy(range), listEvents(range)]);
      for (const event of events) {
        const interval = eventBusyInterval(event);
        if (interval) busy.push(interval);
      }
      return busy;
    },

    async reservations(range: Interval) {
      const events = await listEvents(range, { privateExtendedProperty: `${markerProperty}=1` });
      return events.map(readReservation).filter((reservation) => reservation !== null);
    },

    async getReservation(id: string) {
      try {
        return readReservation(await call<CalendarEvent>(credentials, "GET", eventPath(id)));
      } catch (error) {
        if (isGone(error)) return null;
        throw error;
      }
    },

    async createReservation(input: ReservationInput) {
      const event = await call<CalendarEvent>(credentials, "POST", eventsPath, {}, buildEvent(input));
      return { ...input, id: event.id, createdAt: new Date(event.created ?? Date.now()) };
    },

    async deleteReservation(id: string) {
      try {
        await call<void>(credentials, "DELETE", eventPath(id));
      } catch (error) {
        if (!isGone(error)) throw error;
      }
    },

    async sendEmail(message: EmailMessage) {
      await mailer.sendMail(mailOptions(config.gmail.address, message));
    },

    async sendTelegram() {
      notImplemented("sendTelegram");
    },
  };
}
