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

/**
 * An argon2id hash of 32 random bytes nobody kept, written with exactly the
 * parameters in `HASH_OPTIONS` above.
 *
 * Login must do the same work whether or not the email exists. Returning
 * early for an unknown email made the two branches take ~52ms and ~0ms, so
 * the deliberately identical "Email or password is incorrect" message was
 * defeated by a stopwatch and the login form became an account-enumeration
 * oracle. Verifying against this instead spends the same time on the
 * unknown-email path.
 *
 * A literal, not a hash computed at import: generating one on module load
 * costs a real argon2 run at every cold start, and pinning the string is what
 * makes the cost parameters checkable — `password.test.ts` parses them back
 * out and asserts they match `HASH_OPTIONS`, because a dummy hashed more
 * cheaply than the real ones reopens the same timing gap it exists to close.
 */
export const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$cvcxC47bN+rMUsD5Sysq6A$6w4gQqwkM9LpZOmCgbT45Xg6M1vdanpa46YLwBJG1RA";

/** Always false. Call it to spend a verify's worth of time. */
export function verifyDummyPassword(plain: string): Promise<boolean> {
  return verifyPassword(DUMMY_HASH, plain);
}
