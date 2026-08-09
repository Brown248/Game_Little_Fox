import { describe, expect, it, vi } from "vitest";
import { clearPlayer, loadPlayer, savePlayer } from "@/lib/session";

const player = { id: "abc-123", name: "Mint" };

describe("session", () => {
  it("round-trips the player through localStorage", () => {
    savePlayer(player);
    expect(loadPlayer()).toEqual(player);
    expect(window.localStorage.getItem("we.player")).toContain("abc-123");
  });

  it("returns null when nothing is stored", () => {
    expect(loadPlayer()).toBeNull();
  });

  it("returns null for corrupt or incomplete stored data", () => {
    window.localStorage.setItem("we.player", "{not json");
    expect(loadPlayer()).toBeNull();

    window.localStorage.setItem("we.player", JSON.stringify({ name: "Mint" }));
    expect(loadPlayer()).toBeNull();

    window.localStorage.setItem("we.player", JSON.stringify({ id: "1" }));
    expect(loadPlayer()).toBeNull();
  });

  it("clears the player", () => {
    savePlayer(player);
    clearPlayer();
    expect(loadPlayer()).toBeNull();
  });

  // Safari private mode throws on setItem; losing the session is acceptable,
  // crashing the page is not.
  it("survives a localStorage that throws", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => savePlayer(player)).not.toThrow();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadPlayer()).toBeNull();

    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearPlayer()).not.toThrow();
  });
});
