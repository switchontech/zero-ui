import { Buffer } from "node:buffer";

import { db } from "../utils/db.js";
import verifyHash from "pbkdf2-wrapper/verifyHash.js";

import { isLocalLoginEnabled } from "../utils/auth-policy.js";
import * as user from "./user.js";

// Re-exported so routes can keep importing the whole auth surface from here.
export { isLocalLoginEnabled } from "../utils/auth-policy.js";

/**
 * Checks that a stored hash is shaped the way pbkdf2-wrapper writes them:
 * hex, with two big-endian uint32 headers ahead of the salt and the hash.
 *
 * verifyHash reads those headers with no bounds checking and throws from
 * inside a callback, where an await cannot catch it -- so a hand-edited or
 * half-written db.json would take the backend down from an unauthenticated
 * login attempt. Checking the shape first is the only place to stop that.
 *
 * @param {unknown} stored the password_hash field as read from the database
 * @returns {boolean} true when verifyHash can safely be handed this value
 */
function isStoredHashUsable(stored) {
  if (typeof stored !== "string") return false;
  if (stored.length % 2 !== 0) return false;
  if (!/^[\da-f]+$/i.test(stored)) return false;

  const combined = Buffer.from(stored, "hex");
  if (combined.length < 8) return false;

  const saltBytes = combined.readUInt32BE(0);
  return saltBytes > 0 && combined.length - saltBytes - 8 > 0;
}

/**
 * @param {string} username the submitted username
 * @param {string} password the submitted password
 * @param {(err: Error | null, user?: Record<string, any>) => void} callback result handler
 * @returns {Promise<void>} resolves once the callback has been invoked
 */
export async function authorize(username, password, callback) {
  if (!isLocalLoginEnabled()) {
    return callback(new Error("localLoginDisabled"));
  }

  const users = db.get("users");
  const found = users.find({ username: username });
  // Reporting "user not found" separately would let anyone enumerate users.
  if (!found.value()) return callback(new Error("logInFailed"));
  if (found.value().enabled === false)
    return callback(new Error("logInFailed"));

  const storedHash = found.value()["password_hash"];
  if (!isStoredHashUsable(storedHash)) {
    console.error(
      `Stored password hash for "${username}" is malformed; refusing the login.`
    );
    return callback(new Error("logInFailed"));
  }

  let verified = false;
  try {
    verified = await verifyHash(password, storedHash);
  } catch (err) {
    console.error(`Could not verify the password for "${username}":`, err);
    return callback(new Error("logInFailed"));
  }
  if (!verified) return callback(new Error("logInFailed"));

  return callback(null, found.value());
}

/**
 * Express middleware. Every authenticated user has the same permissions, so
 * this is the only authorization check in the app.
 * @param {import("express").Request & {token?: string}} req incoming request
 * @param {import("express").Response} res outgoing response
 * @param {import("express").NextFunction} next next middleware
 * @returns {void}
 */
export function isAuthorized(req, res, next) {
  if (process.env.ZU_DISABLE_AUTH === "true") {
    return next();
  }

  if (!req.token) {
    res.status(401).send({ error: "Specify token" });
    return;
  }

  const authenticated = user.getUserByToken(req.token);
  if (!authenticated) {
    res.status(403).send({ error: "Invalid token" });
    return;
  }

  req.user = authenticated;
  next();
}
