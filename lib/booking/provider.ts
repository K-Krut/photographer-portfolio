import type { CategorySlug } from "../content";
import type { Locale } from "../i18n";
import type { BookingConfig } from "./config";
import { fakeBookingProvider } from "./fake.ts";
import { createGoogleBookingProvider } from "./google.ts";
import type { Duration, Interval } from "./slots";

export type ReservationInput = Interval & {
  duration: Duration;
  price: number;
  locale: Locale;
  name: string;
  email: string;
  phone: string;
  telegram?: string;
  sessionType?: CategorySlug;
  comment?: string;
};

export type Reservation = ReservationInput & { id: string; createdAt: Date };

export type EmailAttachment = { filename: string; contentType: string; content: string };

export type EmailMessage = {
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachment?: EmailAttachment;
};

export type BookingProvider = {
  now(): Date;
  busyIntervals(range: Interval): Promise<Interval[]>;
  reservations(range: Interval): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | null>;
  createReservation(input: ReservationInput): Promise<Reservation>;
  deleteReservation(id: string): Promise<void>;
  sendEmail(message: EmailMessage): Promise<void>;
  sendTelegram(text: string): Promise<void>;
};

export function getBookingProvider(config: BookingConfig): BookingProvider {
  if (config.provider === "fake") return fakeBookingProvider;
  return createGoogleBookingProvider(config);
}
