import { hash, verify, type Options } from "@node-rs/argon2";

/**
 * Pinned rather than left to the library defaults, which are the OWASP floor
 * (m=19456, t=2, p=1) and could move under us on a dependency bump with nothing
 * in the diff to catch it. 64 MiB is comfortable for a two-user app with no
 * rate limiting in front of the login form.
 *
 * `algorithm` is written as its numeric member because @node-rs/argon2 declares
 * `Algorithm` as an ambient `const enum`, which `isolatedModules` forbids
 * importing by value.
 */
const HASH_OPTIONS: Options = {
  algorithm: 2 as Options["algorithm"], // Algorithm.Argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  // No options here on purpose: verify reads the cost parameters back out of
  // the stored PHC string, so hashes written under the old settings still work.
  try {
    return await verify(hashed, plain);
  } catch {
    // A malformed stored hash must read as "wrong password", not a crash.
    return false;
  }
}
