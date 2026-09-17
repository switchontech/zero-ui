import { isGoogleEnabled } from "./google-oauth.js";

/**
 * Whether username and password sign-in is accepted.
 *
 * Configuring Google turns this off unless it is switched back on explicitly,
 * so the domain restriction is the default rather than something you have to
 * remember to opt into.
 * @returns {boolean} true when local login is accepted
 */
export function isLocalLoginEnabled() {
  if (process.env.ZU_LOCAL_LOGIN === "true") return true;
  if (process.env.ZU_LOCAL_LOGIN === "false") return false;
  return !isGoogleEnabled();
}

/**
 * Whether an account is allowed to authenticate at all.
 *
 * With local login disabled, Google is mandatory for everyone: a local
 * account cannot hold a usable session, however it came by one. Locking only
 * the password form would leave the legacy per-user static token as an open
 * side door into the same admin account.
 * @param {Record<string, any>} user the stored user record
 * @returns {boolean} true when this account may sign in
 */
export function canUserSignIn(user) {
  if (!user) return false;
  if (user.enabled === false) return false;
  if (isLocalLoginEnabled()) return true;
  return user.provider === "google";
}

/**
 * Whether the long-lived per-user token written by older versions is still
 * honoured. It predates Google sign-in and bypasses it, so it only survives
 * while local login does.
 * @returns {boolean} true when legacy static tokens are accepted
 */
export function isLegacyTokenEnabled() {
  return isLocalLoginEnabled();
}
