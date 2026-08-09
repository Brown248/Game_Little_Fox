"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/admin/actions";

export default function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(password);
      if (result.ok) router.refresh();
      else setError(result.error ?? "Could not sign in.");
    });
  }

  return (
    <div className="card stack">
      <h1>Admin</h1>

      {!configured && (
        <div className="notice notice--error">
          <strong>ADMIN_PASSWORD is not set.</strong> Add it to{" "}
          <code>.env.local</code> (see <code>.env.example</code>) and restart the
          server — until then nobody can sign in.
        </div>
      )}

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={!configured}
          />
        </div>

        {error && <div className="notice notice--error">{error}</div>}

        <button className="btn" type="submit" disabled={!configured || pending}>
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
