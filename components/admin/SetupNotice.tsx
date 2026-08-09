// Shown when the admin pages can't reach the database. Keeping it explicit
// means a missing key looks like a setup step, not a broken app.

export function ServiceKeyMissing() {
  return (
    <div className="notice notice--error">
      <strong>SUPABASE_SERVICE_ROLE_KEY is not set.</strong> The admin pages read
      and edit data with the service-role key, which bypasses row-level security.
      Copy it from your Supabase project settings into <code>.env.local</code>{" "}
      (see <code>.env.example</code>) and restart the server.
    </div>
  );
}

export function LoadFailed({ error }: { error: string }) {
  return (
    <div className="notice notice--error">
      <strong>Could not load data.</strong> {error}
      <br />
      Check that <code>supabase/schema.sql</code> has been run in this project.
    </div>
  );
}
