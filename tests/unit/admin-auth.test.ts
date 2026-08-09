import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the Next cookie jar, capturing the options the real one gets.
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, { value, options });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const {
  adminPasswordConfigured,
  isAdmin,
  requireAdmin,
  signIn,
  signOut,
} = await import("@/lib/admin-auth");

const PASSWORD = "hunter2-but-longer";

function forgeToken(expiresAt: number, secret = PASSWORD) {
  const signature = createHmac("sha256", secret)
    .update(`admin:${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${signature}`;
}

beforeEach(() => {
  jar.clear();
  process.env.ADMIN_PASSWORD = PASSWORD;
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("admin auth", () => {
  it("reports whether a password is configured", () => {
    expect(adminPasswordConfigured()).toBe(true);
    delete process.env.ADMIN_PASSWORD;
    expect(adminPasswordConfigured()).toBe(false);
  });

  it("refuses every sign-in when no password is configured", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await signIn("")).toBe(false);
    expect(await signIn("anything")).toBe(false);
    expect(jar.size).toBe(0);
  });

  it("rejects a wrong password without setting a cookie", async () => {
    expect(await signIn("wrong")).toBe(false);
    expect(await signIn(PASSWORD + "x")).toBe(false);
    expect(await signIn(PASSWORD.slice(0, -1))).toBe(false);
    expect(jar.size).toBe(0);
    expect(await isAdmin()).toBe(false);
  });

  it("accepts the right password and sets an httpOnly cookie", async () => {
    expect(await signIn(PASSWORD)).toBe(true);

    const cookie = jar.get("we_admin");
    expect(cookie).toBeDefined();
    expect(cookie!.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
      maxAge: 12 * 60 * 60,
    });
    expect(await isAdmin()).toBe(true);
  });

  it("stores the session as expiry.hmac, not the password itself", async () => {
    await signIn(PASSWORD);
    const value = jar.get("we_admin")!.value;
    expect(value).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(value).not.toContain(PASSWORD);
  });

  it("rejects a tampered signature", async () => {
    const valid = forgeToken(Date.now() + 60_000);
    jar.set("we_admin", { value: valid.replace(/.$/, (c) => (c === "0" ? "1" : "0")) });
    expect(await isAdmin()).toBe(false);
  });

  it("rejects a token signed with a different password", async () => {
    jar.set("we_admin", { value: forgeToken(Date.now() + 60_000, "other-password") });
    expect(await isAdmin()).toBe(false);
  });

  it("rejects an expired token", async () => {
    jar.set("we_admin", { value: forgeToken(Date.now() - 1) });
    expect(await isAdmin()).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    for (const value of ["", "abc", ".abc", "abc.def", "12345", "NaN.abc"]) {
      jar.set("we_admin", { value });
      expect(await isAdmin(), `value: ${value}`).toBe(false);
    }
  });

  it("invalidates existing sessions when the password changes", async () => {
    await signIn(PASSWORD);
    expect(await isAdmin()).toBe(true);

    process.env.ADMIN_PASSWORD = "a-new-password-entirely";
    expect(await isAdmin()).toBe(false);
  });

  it("signs out", async () => {
    await signIn(PASSWORD);
    await signOut();
    expect(jar.size).toBe(0);
    expect(await isAdmin()).toBe(false);
  });

  it("requireAdmin throws unless signed in", async () => {
    await expect(requireAdmin()).rejects.toThrow(/not authorised/i);
    await signIn(PASSWORD);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
