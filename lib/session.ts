// Where the "logged in" explorer lives between pages. There is no auth — the
// landing page resolves the typed name into a players row and stashes it here.
// localStorage (not sessionStorage) so a student coming back next week doesn't
// have to retype their name.

import type { Player } from "./types";

const KEY = "we.player";

export function savePlayer(player: Player): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // Private-mode Safari throws on setItem. Not fatal: the current play
    // session still works, the student just gets asked again next time.
  }
}

export function loadPlayer(): Player | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Player>;
    if (!parsed?.id || !parsed.name) return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

export function clearPlayer(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
