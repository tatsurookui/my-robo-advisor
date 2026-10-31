import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  projects: [
    {
      name: "clerk-setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /auth\.spec\.ts/,
      dependencies: ["clerk-setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:5000",
      },
    },
  ],
});
