import { expect, test } from "@playwright/test";
import { defaultWindow, isBookingConfigured, readBookingConfig } from "../lib/booking/config";

const bookingVariables = [
  "BOOKING_FAKE",
  "BOOKING_GOOGLE_CLIENT_EMAIL",
  "BOOKING_GOOGLE_PRIVATE_KEY",
  "BOOKING_CALENDAR_ID",
  "BOOKING_BLOCKING_CALENDAR_IDS",
  "BOOKING_WINDOW",
  "BOOKING_GMAIL_ADDRESS",
  "BOOKING_GMAIL_APP_PASSWORD",
  "BOOKING_NOTIFY_EMAIL",
  "BOOKING_TOKEN_SECRET",
  "BOOKING_TELEGRAM_BOT_TOKEN",
  "BOOKING_TELEGRAM_CHAT_ID",
];

const realEnv = {
  BOOKING_GOOGLE_CLIENT_EMAIL: "bot@project.iam.gserviceaccount.com",
  BOOKING_GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  BOOKING_CALENDAR_ID: "bookings@group.calendar.google.com",
  BOOKING_BLOCKING_CALENDAR_IDS: "work@example.com, private@example.com",
  BOOKING_GMAIL_ADDRESS: "photographer@gmail.com",
  BOOKING_GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  BOOKING_TOKEN_SECRET: "secret",
};

function withEnv<T>(variables: Record<string, string>, run: () => T): T {
  const saved = Object.fromEntries(bookingVariables.map((name) => [name, process.env[name]]));
  for (const name of bookingVariables) delete process.env[name];
  Object.assign(process.env, variables);
  try {
    return run();
  } finally {
    for (const name of bookingVariables) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
}

test("booking is not configured when no booking variables are set", () => {
  withEnv({}, () => {
    expect(isBookingConfigured()).toBe(false);
    expect(readBookingConfig()).toBeNull();
  });
});

test("the fake flag counts as configured with defaults", () => {
  withEnv({ BOOKING_FAKE: "1" }, () => {
    expect(isBookingConfigured()).toBe(true);
    expect(readBookingConfig()).toEqual({
      provider: "fake",
      window: defaultWindow,
      tokenSecret: "booking-fake-secret",
      notifyEmail: "photographer@example.com",
      telegram: undefined,
    });
  });
  withEnv({ BOOKING_FAKE: "0" }, () => expect(isBookingConfigured()).toBe(false));
});

test("the real configuration is read with Telegram optional", () => {
  withEnv(realEnv, () => {
    expect(isBookingConfigured()).toBe(true);
    expect(readBookingConfig()).toEqual({
      provider: "google",
      window: defaultWindow,
      tokenSecret: "secret",
      notifyEmail: "photographer@gmail.com",
      telegram: undefined,
      google: {
        clientEmail: realEnv.BOOKING_GOOGLE_CLIENT_EMAIL,
        privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      },
      bookingsCalendarId: realEnv.BOOKING_CALENDAR_ID,
      blockingCalendarIds: ["work@example.com", "private@example.com"],
      gmail: { address: "photographer@gmail.com", appPassword: "abcd efgh ijkl mnop" },
    });
  });
  withEnv(
    {
      ...realEnv,
      BOOKING_NOTIFY_EMAIL: "inbox@example.com",
      BOOKING_TELEGRAM_BOT_TOKEN: "token",
      BOOKING_TELEGRAM_CHAT_ID: "42",
    },
    () => {
      expect(readBookingConfig()).toMatchObject({
        notifyEmail: "inbox@example.com",
        telegram: { botToken: "token", chatId: "42" },
      });
    },
  );
  withEnv({ ...realEnv, BOOKING_TELEGRAM_BOT_TOKEN: "token" }, () => {
    expect(readBookingConfig()?.telegram).toBeUndefined();
  });
});

test("every required real variable is needed", () => {
  for (const name of Object.keys(realEnv)) {
    withEnv({ ...realEnv, [name]: " " }, () => {
      expect(isBookingConfigured(), name).toBe(false);
    });
  }
});

test("the daily window is parsed and validated", () => {
  withEnv({ BOOKING_FAKE: "1", BOOKING_WINDOW: "10:00-20:00" }, () => {
    expect(readBookingConfig()?.window).toEqual({ start: 600, end: 1200 });
  });
  withEnv({ ...realEnv, BOOKING_WINDOW: "9:30-24:00" }, () => {
    expect(readBookingConfig()?.window).toEqual({ start: 570, end: 1440 });
  });
  withEnv({ BOOKING_FAKE: "1", BOOKING_WINDOW: " " }, () => {
    expect(readBookingConfig()?.window).toEqual(defaultWindow);
  });
  for (const value of ["20:00-10:00", "08:00-08:00", "08:60-22:00", "08:00-25:00", "8-22"]) {
    withEnv({ BOOKING_FAKE: "1", BOOKING_WINDOW: value }, () => {
      expect(readBookingConfig(), value).toBeNull();
    });
  }
});
