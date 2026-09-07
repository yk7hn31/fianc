import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./use-media-query";

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", () => mql);
  return {
    set(value: boolean) {
      mql.matches = value;
      listeners.forEach((l) => l());
    },
  };
}

describe("useMediaQuery", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("reports the current match", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("updates when the query starts matching", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => mql.set(true));
    expect(result.current).toBe(true);
  });
});
