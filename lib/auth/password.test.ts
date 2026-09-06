import { describe, it, expect } from "vitest";
import { hash, parseOptions, type Options } from "@node-rs/argon2";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("produces an argon2id hash, not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("pins its cost parameters instead of inheriting library defaults", async () => {
    // A @node-rs/argon2 bump must not be able to weaken this silently.
    const opts = parseOptions(await hashPassword("cost-parameter-probe"));
    expect(opts.algorithm).toBe(2); // Argon2id
    expect(opts.memoryCost).toBe(65536);
    expect(opts.timeCost).toBe(3);
    expect(opts.parallelism).toBe(1);
  });

  it("still verifies a hash written under the old default cost", async () => {
    // Rows written before the pin must keep working: verify has to read the
    // cost parameters back out of the PHC string, not assume the current ones.
    const old = await hash("legacy-password", {
      algorithm: 2 as Options["algorithm"],
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    expect(old).toContain("m=19456,t=2,p=1");
    await expect(verifyPassword(old, "legacy-password")).resolves.toBe(true);
  });

  it("verifies the right password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    await expect(verifyPassword(hash, "s3cret-passphrase")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    await expect(verifyPassword(hash, "s3cret-passphras")).resolves.toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("same-password-twice");
    const b = await hashPassword("same-password-twice");
    expect(a).not.toBe(b);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    await expect(verifyPassword("not-a-hash", "whatever")).resolves.toBe(false);
  });
});
