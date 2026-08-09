import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client. It bypasses RLS, so it must never reach the browser —
// the "server-only" import above turns an accidental client import into a build
// error rather than a leaked key.

// Annotated as SupabaseClient (not ReturnType<typeof createClient>): the
// generic function's ReturnType resolves row payloads to `never`, which makes
// every .insert()/.update() a type error.
let cached: SupabaseClient | null = null;

export function serviceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function supabaseAdmin() {
  if (!serviceConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are not set — see .env.example"
    );
  }
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cached;
}
