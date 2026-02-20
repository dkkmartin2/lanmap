import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run db:push && npm run dev -- --port 3100",
    url: `http://127.0.0.1:${port}`,
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "file:./e2e/e2e.db"
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
