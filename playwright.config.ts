import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The Playwright runner is a plain Node process; only the `next dev` child it
// spawns reads .env.local on its own. e2e/auth.spec.ts needs SIGNUP_CODE in the
// runner itself to fill the signup form, so load it here too.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // 3100, not Next's conventional 3000: `reuseExistingServer` will silently
  // attach to whatever is already listening, and on a machine running several
  // Next projects that means testing someone else's app.
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
});
