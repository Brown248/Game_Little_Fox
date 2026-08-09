import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

// App Router hooks and <Link> need a router context that doesn't exist in
// jsdom, so they're mocked once here. Tests read the spies through
// `routerMock` to assert navigation.

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...rest }, children),
}));

// Node 25 ships its own (unconfigured) `localStorage` global, which shadows
// jsdom's and throws on use. Install a real in-memory Storage instead so
// lib/session.ts is exercised against something that behaves like a browser's.
class MemoryStorage implements Storage {
  #map = new Map<string, string>();

  get length() {
    return this.#map.size;
  }
  clear() {
    this.#map.clear();
  }
  getItem(key: string) {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }
  key(index: number) {
    return [...this.#map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#map.delete(key);
  }
  setItem(key: string, value: string) {
    this.#map.set(key, String(value));
  }
}

function installStorage() {
  const storage = new MemoryStorage();
  for (const target of [window, globalThis]) {
    Object.defineProperty(target, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
}

installStorage();

// Browser APIs jsdom doesn't implement that the game uses.
export const speechMock = {
  speak: vi.fn(),
  cancel: vi.fn(),
};

export const audioPlayMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  // A fresh Storage per test: mocked methods from a previous test can't leak.
  installStorage();

  Object.values(routerMock).forEach((fn) => fn.mockClear());
  speechMock.speak.mockClear();
  speechMock.cancel.mockClear();
  audioPlayMock.mockClear();

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: speechMock,
  });
  // jsdom has no SpeechSynthesisUtterance either.
  (
    globalThis as unknown as { SpeechSynthesisUtterance: unknown }
  ).SpeechSynthesisUtterance = class {
    text: string;
    lang = "";
    rate = 1;
    constructor(text: string) {
      this.text = text;
    }
  };

  // jsdom's HTMLMediaElement.play throws "not implemented".
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: audioPlayMock,
  });

  // jsdom has <dialog> but not showModal()/close() — a long-standing gap, not
  // a browser one: every browser the design already needs (Safari 15.4+, for
  // aspect-ratio alone) has them. Stub them here rather than guarding the
  // component, so ConfirmDialog stays written for the real platform.
  for (const [name, isOpen] of [
    ["showModal", true],
    ["show", true],
    ["close", false],
  ] as const) {
    Object.defineProperty(window.HTMLDialogElement.prototype, name, {
      configurable: true,
      writable: true,
      value: function (this: HTMLDialogElement) {
        this.open = isOpen;
      },
    });
  }

  vi.spyOn(window, "print").mockImplementation(() => {});
  vi.spyOn(window, "print").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});
