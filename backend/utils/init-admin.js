import crypto from "node:crypto";
import hashPassword from "pbkdf2-wrapper/hashText.js";

import { isLocalLoginEnabled } from "./auth-policy.js";

/**
 * Builds the bootstrap local admin from the environment.
 *
 * It is only meaningful when someone could actually sign in with it. With
 * Google mandatory, or with auth handled by a proxy in front, there is nothing
 * to bootstrap and the ZU_DEFAULT_* variables become optional.
 * @returns {Promise<Record<string, any> | null>} the admin record, or null when none is needed
 */
export async function initAdmin() {
  if (process.env.ZU_DISABLE_AUTH === "true") return null;
  if (!isLocalLoginEnabled()) return null;

  if (!process.env.ZU_DEFAULT_PASSWORD || !process.env.ZU_DEFAULT_USERNAME) {
    console.error("ZU_DEFAULT_PASSWORD or ZU_DEFAULT_USERNAME not found!");
    process.exit(1);
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    username: process.env.ZU_DEFAULT_USERNAME,
    name: process.env.ZU_DEFAULT_USERNAME,
    email: null,
    password_hash: await hashPassword(process.env.ZU_DEFAULT_PASSWORD),
    provider: "local",
    enabled: true,
    createdAt: now,
    lastLoginAt: null,
    sessions: [],
  };
}
