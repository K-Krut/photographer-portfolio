export type BookingWindow = { start: number; end: number };

export type TelegramConfig = { botToken: string; chatId: string };

type SharedConfig = {
  window: BookingWindow;
  tokenSecret: string;
  notifyEmail: string;
  telegram?: TelegramConfig;
};

export type FakeBookingConfig = SharedConfig & { provider: "fake" };

export type RealBookingConfig = SharedConfig & {
  provider: "google";
  google: { clientEmail: string; privateKey: string };
  bookingsCalendarId: string;
  blockingCalendarIds: string[];
  gmail: { address: string; appPassword: string };
};

export type BookingConfig = FakeBookingConfig | RealBookingConfig;

export const defaultWindow: BookingWindow = { start: 8 * 60, end: 22 * 60 };

const fakeDefaults = {
  tokenSecret: "booking-fake-secret",
  notifyEmail: "photographer@example.com",
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function parseWindow(value: string | undefined): BookingWindow | null {
  if (value === undefined) return defaultWindow;
  const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [start, end] = [
    Number(match[1]) * 60 + Number(match[2]),
    Number(match[3]) * 60 + Number(match[4]),
  ];
  const valid =
    Number(match[2]) < 60 && Number(match[4]) < 60 && start < end && end <= 24 * 60;
  return valid ? { start, end } : null;
}

function telegramFromEnv(): TelegramConfig | undefined {
  const botToken = env("BOOKING_TELEGRAM_BOT_TOKEN");
  const chatId = env("BOOKING_TELEGRAM_CHAT_ID");
  return botToken && chatId ? { botToken, chatId } : undefined;
}

export function isBookingFake(): boolean {
  return ["1", "true"].includes(env("BOOKING_FAKE") ?? "");
}

export function readBookingConfig(): BookingConfig | null {
  const window = parseWindow(env("BOOKING_WINDOW"));
  if (!window) return null;
  const telegram = telegramFromEnv();

  if (isBookingFake()) {
    return {
      provider: "fake",
      window,
      tokenSecret: env("BOOKING_TOKEN_SECRET") ?? fakeDefaults.tokenSecret,
      notifyEmail:
        env("BOOKING_NOTIFY_EMAIL") ??
        env("BOOKING_GMAIL_ADDRESS") ??
        fakeDefaults.notifyEmail,
      telegram,
    };
  }

  const clientEmail = env("BOOKING_GOOGLE_CLIENT_EMAIL");
  const privateKey = env("BOOKING_GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const bookingsCalendarId = env("BOOKING_CALENDAR_ID");
  const blockingCalendarIds = (env("BOOKING_BLOCKING_CALENDAR_IDS") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const address = env("BOOKING_GMAIL_ADDRESS");
  const appPassword = env("BOOKING_GMAIL_APP_PASSWORD");
  const tokenSecret = env("BOOKING_TOKEN_SECRET");

  if (
    !clientEmail ||
    !privateKey ||
    !bookingsCalendarId ||
    blockingCalendarIds.length === 0 ||
    !address ||
    !appPassword ||
    !tokenSecret
  ) {
    return null;
  }

  return {
    provider: "google",
    window,
    tokenSecret,
    notifyEmail: env("BOOKING_NOTIFY_EMAIL") ?? address,
    telegram,
    google: { clientEmail, privateKey },
    bookingsCalendarId,
    blockingCalendarIds,
    gmail: { address, appPassword },
  };
}

export function isBookingConfigured(): boolean {
  return readBookingConfig() !== null;
}
