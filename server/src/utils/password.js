// Argon2id hashing (OWASP-recommended parameters) and password rules.

import argon2 from "argon2";
import crypto from "node:crypto";

const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// A real hash of a random string: verifying against it costs the same as a
// real check, so unknown emails can't be detected by response time.
let dummyHash;
export async function burnPasswordCheck(plain) {
  dummyHash ??= await hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(dummyHash, plain);
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Readable temporary password for admin resets, e.g. "Kite-7342-Moss".
const WORDS = ["Amber", "Brook", "Cedar", "Delta", "Ember", "Fable", "Grove", "Haven", "Iris", "Jade", "Kite", "Lumen", "Maple", "North", "Opal", "Pine", "Quill", "Ridge", "Sage", "Tide", "Umber", "Vale", "Willow", "Zephyr"];
export function temporaryPassword() {
  const w = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${w()}-${crypto.randomInt(1000, 10000)}-${w()}${crypto.randomInt(10, 100)}`;
}
