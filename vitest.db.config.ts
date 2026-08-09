import { createHmac } from "node:crypto";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration suite: the real lib/* code against real Postgres + PostgREST.
// Needs the containers up — see tests/README.md.
//   docker compose -f tests/db/docker-compose.yml up -d && npm run test:db

// Must match PGRST_JWT_SECRET in tests/db/docker-compose.yml.
const TEST_JWT_SECRET = "little-fox-game-test-jwt-secret-32chars-min";

/** Supabase API keys are just JWTs carrying a `role` claim; PostgREST switches
 *  to that Postgres role. Minting them here is what makes the anon key really
 *  behave like a student's key (RLS applies) and the service key really bypass
 *  RLS, exactly as in production. */
function mintKey(role: string): string {
  const base64url = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    role,
    iat: 1_700_000_000,
    exp: 4_000_000_000,
  });
  const signature = createHmac("sha256", TEST_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${header}.${payload}.${signature}`;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["./tests/db/setup-global.ts"],
    // Shared database: files and tests must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55431",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: mintKey("anon"),
      SUPABASE_SERVICE_ROLE_KEY: mintKey("service_role"),
      ADMIN_PASSWORD: "test-admin-password",
    },
  },
});
