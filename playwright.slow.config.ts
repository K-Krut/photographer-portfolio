import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: "slow-network.spec.ts",
  projects: [{ name: "slow-network", use: { ...devices["Desktop Chrome"] } }],
});
