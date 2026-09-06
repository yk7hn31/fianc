import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  sessionExpiry,
  isExpired,
  shouldRefresh,
} from "./token";

describe("token", () => {
  it("generates a distinct high-entropy token each call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes, base64url
  });

  it("hashes deterministically to 64 hex characters", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the token as its own hash", () => {
    const t = generateToken();
    expect(hashToken(t)).not.toBe(t);
  });

  it("expires sessions 30 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(sessionExpiry(now).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("detects expiry", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(isExpired(new Date("2026-01-09T23:59:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-01-10T00:01:00Z"), now)).toBe(false);
  });

  it("refreshes once more than half the lifetime has elapsed", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    // 20 days left of 30: less than half elapsed.
    expect(shouldRefresh(new Date("2026-02-09T00:00:00Z"), now)).toBe(false);
    // 10 days left of 30: more than half elapsed.
    expect(shouldRefresh(new Date("2026-01-30T00:00:00Z"), now)).toBe(true);
  });
});
