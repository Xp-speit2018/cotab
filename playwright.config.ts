import { defineConfig, devices } from "@playwright/test";

for (const key of ["NO_PROXY", "no_proxy"] as const) {
  const existing = process.env[key];
  process.env[key] = [existing, "localhost", "127.0.0.1"]
    .filter(Boolean)
    .join(",");
}

const appPort = Number(process.env.COTAB_E2E_PORT ?? 5175);
const appUrl = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--disable-features=WebRtcHideLocalIpsWithMdns"],
        },
      },
    },
  ],
  webServer: [
    {
      command: "docker compose up --build signaling turn",
      url: "http://localhost:4444",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${appPort}`,
      url: appUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_SIGNALING_URL: "http://localhost:4444",
        VITE_WEBRTC_ICE_SERVERS: JSON.stringify([
          {
            urls: [
              "turn:127.0.0.1:3478?transport=udp",
              "turn:127.0.0.1:3478?transport=tcp",
            ],
            username: "cotab",
            credential: "cotab-dev",
          },
        ]),
      },
    },
  ],
});
