// `server-only` is a build-time guard: importing it outside a server component
// throws. Vitest aliases it to this empty module so the server-only libraries
// (units, admin-data, admin-auth, supabase-admin) can be unit tested directly.
// The real guard still applies to `next build` — see vitest.config.ts.
export {};
