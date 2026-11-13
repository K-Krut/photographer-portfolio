import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://localhost:${port}`;
const notConfiguredPort = 3101;
export const notConfiguredBaseURL = `http://localhost:${notConfiguredPort}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "slow-network.spec.ts",
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
  ],
  webServer: [
    {
      command: `npm run build && npm run start -- --port ${notConfiguredPort}`,
      url: notConfiguredBaseURL + "/en",
      env: {
        NEXT_DIST_DIR: ".next-not-configured",
        BOOKING_FAKE: "",
        BOOKING_GOOGLE_CLIENT_EMAIL: "",
        BOOKING_GOOGLE_PRIVATE_KEY: "",
        BOOKING_CALENDAR_ID: "",
        BOOKING_BLOCKING_CALENDAR_IDS: "",
        BOOKING_WINDOW: "",
        BOOKING_GMAIL_ADDRESS: "",
        BOOKING_GMAIL_APP_PASSWORD: "",
        BOOKING_NOTIFY_EMAIL: "",
        BOOKING_TOKEN_SECRET: "",
        BOOKING_TELEGRAM_BOT_TOKEN: "",
        BOOKING_TELEGRAM_CHAT_ID: "",
      },
      timeout: 300_000,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npm run start -- --port ${port}`,
      url: baseURL + "/en",
      env: { BOOKING_FAKE: "1" },
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
