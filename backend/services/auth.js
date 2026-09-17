import { db } from "../utils/db.js";
import verifyHash from "pbkdf2-wrapper/verifyHash.js";

import { isGoogleEnabled } from "../utils/google-oauth.js";
import * as user from "./user.js";

/**
 * Username and password sign-in stays available as a break-glass path, but it
 * is off by default once Google is configured so that the domain restriction
 * cannot be sidestepped. Set ZU_LOCAL_LOGIN=true to keep it.
 * @returns {boolean} true when local login is accepted
 */
export function isLocalLoginEnabled() {
  if (process.env.ZU_LOCAL_LOGIN === "true") return true;
  if (process.env.ZU_LOCAL_LOGIN === "false") return false;
  return !isGoogleEnabled();
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

  const verified = await verifyHash(password, found.value()["password_hash"]);
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
