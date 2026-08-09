import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two suites:
//   tests/unit — pure logic + React components in jsdom (no network, no DB)
//   tests/db   — the real client code against real Postgres + PostgREST
//                (docker compose, see tests/README.md) — `npm run test:db`
// `npm test` runs the unit suite only so it needs nothing running.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // See tests/stubs/empty.ts — lets the server-only libs be imported here.
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Keys the client never actually calls here (every query is mocked), but
    // they make `supabaseConfigured` true so the screens behave like a properly
    // set-up deployment rather than showing the setup notice.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
