import crypto from "node:crypto";

import { db } from "../utils/db.js";
import { canUserSignIn, isLegacyTokenEnabled } from "../utils/auth-policy.js";

const SESSION_TTL_MS =
  (Number(process.env.ZU_SESSION_TTL_HOURS) || 24 * 7) * 60 * 60 * 1000;

/**
 * Strips secrets from a user record before it leaves the backend.
 * @param {Record<string, any>} user the stored user record
 * @returns {Record<string, any> | null} a safe representation
 */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    name: user.name || user.username || user.email || null,
    picture: user.picture || null,
    provider: user.provider || "local",
    enabled: user.enabled !== false,
    canSignIn: canUserSignIn(user),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,
    sessionCount: (user.sessions || []).length,
  };
}

/**
 * @returns {Record<string, any>[]} every stored user, newest session data included
 */
export function listUsers() {
  return db.get("users").value() || [];
}

/**
 * @param {string} id the user id
 * @returns {Record<string, any> | undefined} the stored user
 */
export function getUser(id) {
  return db.get("users").find({ id: id }).value();
}

/**
 * @param {string} email the address to look up, case-insensitive
 * @returns {Record<string, any> | undefined} the stored user
 */
export function getUserByEmail(email) {
  const needle = String(email || "").toLowerCase();
  return db
    .get("users")
    .find((user) => String(user.email || "").toLowerCase() === needle)
    .value();
}

/**
 * Creates the user on first sign-in, or refreshes their profile on later ones.
 *
 * Every user gets the same permissions, so there is nothing to decide here
 * beyond whether the account has been disabled by someone else.
 * @param {{sub: string, email: string, name: string, picture: string}} profile verified Google claims
 * @returns {Record<string, any>} the stored user record
 */
export function upsertGoogleUser(profile) {
  const existing = getUserByEmail(profile.email);
  const now = new Date().toISOString();

  if (existing) {
    db.get("users")
      .find({ id: existing.id })
      .assign({
        name: profile.name,
        picture: profile.picture,
        googleId: profile.sub,
        provider: "google",
        lastLoginAt: now,
      })
      .write();
    return getUser(existing.id) || existing;
  }

  const user = {
    id: crypto.randomUUID(),
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    googleId: profile.sub,
    provider: "google",
    enabled: true,
    createdAt: now,
    lastLoginAt: now,
    sessions: [],
  };

  db.get("users").push(user).write();
  return user;
}

/**
 * Issues a session token for a user and prunes any that have expired.
 * @param {string} id the user id
 * @returns {{token: string, expiresAt: string}} the new session
 */
export function createSession(id) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const session = {
    token: token,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };

  const user = getUser(id);
  if (!user) throw new Error("userNotFound");
  const sessions = (user.sessions || []).filter(
    (candidate) => new Date(candidate.expiresAt).getTime() > now
  );
  sessions.push(session);

  db.get("users")
    .find({ id: id })
    .assign({ sessions: sessions, lastLoginAt: session.createdAt })
    .write();

  return session;
}

/**
 * Resolves a bearer token to its user, rejecting expired sessions and
 * disabled accounts.
 * @param {string} token the bearer token
 * @returns {Record<string, any> | null} the authenticated user, or null
 */
export function getUserByToken(token) {
  if (!token) return null;
  const now = Date.now();
  const allowLegacyToken = isLegacyTokenEnabled();

  const user = (listUsers() || []).find((candidate) => {
    // Accounts created before sessions existed carry a single static token.
    // It predates Google sign-in and would walk straight past it, so it is
    // only honoured while local login is enabled.
    if (allowLegacyToken && candidate.token && candidate.token === token) {
      return true;
    }
    return (candidate.sessions || []).some(
      (session) =>
        session.token === token && new Date(session.expiresAt).getTime() > now
    );
  });

  if (!user) return null;
  // Also catches a local account still holding a session issued before Google
  // was made mandatory, as well as any disabled account.
  if (!canUserSignIn(user)) return null;
  return user;
}

/**
 * Drops a single session, used when a user logs out.
 * @param {string} token the session token to revoke
 * @returns {void}
 */
export function revokeSession(token) {
  const user = getUserByToken(token);
  if (!user) return;

  const record = db.get("users").find({ id: user.id });
  record
    .assign({
      sessions: (user.sessions || []).filter(
        (session) => session.token !== token
      ),
    })
    .write();

  // Logging out with the legacy static token has to retire it, otherwise the
  // "session" the user just ended keeps working forever.
  if (user.token && user.token === token) {
    record.unset("token").write();
  }
}

/**
 * Drops every session for a user, forcing them to sign in again.
 * @param {string} id the user id
 * @returns {void}
 */
export function revokeAllSessions(id) {
  // The legacy static token is a credential like any other, so "sign out
  // everywhere" has to take it too -- it is exactly the one still sitting in
  // the localStorage of every browser that signed in before the upgrade.
  db.get("users")
    .find({ id: id })
    .assign({ sessions: [] })
    .unset("token")
    .write();
}

/**
 * Enables or disables an account. A disabled account keeps its history but
 * cannot sign in and has all of its sessions dropped immediately.
 * @param {string} id the user id
 * @param {boolean} enabled the desired state
 * @returns {Record<string, any> | undefined} the updated user
 */
export function setUserEnabled(id, enabled) {
  db.get("users")
    .find({ id: id })
    .assign({ enabled: enabled, ...(enabled ? {} : { sessions: [] }) })
    .write();
  return getUser(id);
}

/**
 * @param {string} id the user id
 * @returns {void}
 */
export function deleteUser(id) {
  db.get("users").remove({ id: id }).write();
}

/**
 * Backfills ids and session arrays so records written by older versions keep
 * working after an upgrade.
 * @returns {void}
 */
export function migrateUsers() {
  const users = listUsers() || [];
  for (const [index, user] of users.entries()) {
    const patch = {};
    if (!user.id) patch.id = crypto.randomUUID();
    if (!user.provider) patch.provider = user.googleId ? "google" : "local";
    if (user.enabled === undefined) patch.enabled = true;
    if (!Array.isArray(user.sessions)) patch.sessions = [];
    if (Object.keys(patch).length === 0) continue;

    db.get("users").nth(index).assign(patch).write();
  }
}
