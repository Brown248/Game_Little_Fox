"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, signIn, signOut } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Every mutating action re-checks the session itself. The admin layout only
// gates *rendering* — a server action is a public endpoint until it checks.

export async function loginAction(password: string): Promise<ActionResult> {
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." };
  }
  if (!(await signIn(password))) {
    return { ok: false, error: "Wrong password." };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function logoutAction(): Promise<ActionResult> {
  await signOut();
  revalidatePath("/admin");
  return { ok: true };
}

/** Fixes a mistyped name. */
export async function renamePlayerAction(
  playerId: string,
  name: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cleanName = name.trim();
    if (!cleanName) {
      return { ok: false, error: "The name cannot be empty." };
    }

    const { error } = await supabaseAdmin()
      .from("players")
      .update({ name: cleanName })
      .eq("id", playerId);

    if (error) {
      // 23505 = the unique index on lower(trim(name))
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Another explorer already uses that name — merge them instead.",
        };
      }
      throw error;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/players");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Moves every attempt from one explorer onto another, then removes the empty
 *  duplicate. This is the fix for "same student, two spellings" — it keeps the
 *  history instead of deleting it. */
export async function mergePlayersAction(
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!sourceId || !targetId) return { ok: false, error: "Pick two players." };
    if (sourceId === targetId) {
      return { ok: false, error: "Pick two different players." };
    }

    const db = supabaseAdmin();
    const moved = await db
      .from("attempts")
      .update({ player_id: targetId })
      .eq("player_id", sourceId);
    if (moved.error) throw moved.error;

    // Only after the attempts are safely moved: deleting first would cascade
    // them away.
    const removed = await db.from("players").delete().eq("id", sourceId);
    if (removed.error) throw removed.error;

    revalidatePath("/admin");
    revalidatePath("/admin/players");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Deletes a player and, by cascade, all of their attempts. */
export async function deletePlayerAction(playerId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin()
      .from("players")
      .delete()
      .eq("id", playerId);
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/admin/players");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** For test rows and obvious mistakes only — a student's real attempts are
 *  meant to be kept forever (the leaderboard picks the best one anyway). */
export async function deleteAttemptAction(attemptId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin()
      .from("attempts")
      .delete()
      .eq("id", attemptId);
    if (error) throw error;

    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

function message(err: unknown): string {
  if (err instanceof Error) return err.message;
  // Supabase rejects with a plain PostgrestError object, not an Error, so
  // without this every database failure would read "Something went wrong."
  if (err && typeof err === "object") {
    const candidate = err as { message?: unknown; details?: unknown; code?: unknown };
    const text = [candidate.message, candidate.details]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" — ");
    if (text) return candidate.code ? `${text} (${String(candidate.code)})` : text;
  }
  return "Something went wrong.";
}
