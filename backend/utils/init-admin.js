import crypto from "node:crypto";
import hashPassword from "pbkdf2-wrapper/hashText.js";

import { isGoogleEnabled } from "./google-oauth.js";

/**
 * Builds the bootstrap local admin from the environment.
 *
 * With Google sign-in configured, accounts are provisioned on first login, so
 * these variables become optional and we no longer refuse to start without them.
 * @returns {Promise<Record<string, any> | null>} the admin record, or null when none is configured
 */
export async function initAdmin() {
  if (!process.env.ZU_DEFAULT_PASSWORD || !process.env.ZU_DEFAULT_USERNAME) {
    if (isGoogleEnabled()) return null;
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
    token: crypto.randomBytes(16).toString("hex"),
  };
}
