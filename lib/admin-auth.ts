import "server-only";
import { cookies } from "next/headers";

// The whole admin gate: one shared password (ADMIN_PASSWORD) and a signed,
// httpOnly cookie. There is one admin — BB — so there are no accounts, roles,
// or password resets to build. The password doubles as the HMAC signing key,
// which means changing it invalidates every existing session.

const COOKIE = "we_admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** True when the current request carries a valid, unexpired admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token, secret);
}

/** Checks the typed password and, on success, sets the session cookie. */
export async function signIn(password: string): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  if (!timingSafeEqual(password, secret)) return false;

  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = `${expiresAt}.${await sign(String(expiresAt), secret)}`;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Throws unless the caller is an authenticated admin. Call this first in
 *  every server action — the layout gate only protects rendering. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot < 1) return false;

  const expiresAt = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  return timingSafeEqual(signature, await sign(String(expiresAt), secret));
}

// Web Crypto rather than node:crypto so this file stays runtime-agnostic.
async function sign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`admin:${message}`)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish compare so a wrong password can't be found byte by byte.
function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
