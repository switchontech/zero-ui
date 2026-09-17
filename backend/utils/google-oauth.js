import crypto from "node:crypto";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Pending authorization requests, keyed by the `state` we hand to Google.
// Single-process app, so an in-memory map is enough; entries are one-shot and
// expire so an abandoned login cannot pile up forever.
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;
// /auth/google is unauthenticated, so without a ceiling anyone can make the
// backend allocate ten minutes' worth of entries as fast as they can send
// requests. Map preserves insertion order, so the oldest is the first key.
const MAX_PENDING_STATES = 1024;

/**
 * Reads a required Google credential, failing loudly rather than sending
 * "undefined" to Google and debugging a vague invalid_client error later.
 * @param {string} name the environment variable name
 * @returns {string} the configured value
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error("googleNotConfigured");
  return value;
}

/**
 * @returns {boolean} true when the Google OAuth client credentials are present.
 */
export function isGoogleEnabled() {
  return Boolean(
    process.env.ZU_GOOGLE_CLIENT_ID && process.env.ZU_GOOGLE_CLIENT_SECRET
  );
}

/**
 * Domains allowed to sign in, lowercased. Empty means "any domain", which we
 * refuse to run with, so callers must treat an empty list as a misconfiguration.
 * @returns {string[]} allowed email domains
 */
export function allowedDomains() {
  return (process.env.ZU_GOOGLE_ALLOWED_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * @param {string} email address to check
 * @returns {boolean} true when the address belongs to an allowed domain
 */
export function isAllowedEmail(email) {
  const domains = allowedDomains();
  if (domains.length === 0) return false;

  // Exactly one "@", so that "a@allowed.example@evil.example" cannot pass by
  // having its first segment read as the domain.
  const parts = String(email || "")
    .toLowerCase()
    .split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;
  return domains.includes(domain);
}

/**
 * The redirect URI registered with Google. Derived from the incoming request
 * unless pinned explicitly, which is what you want behind a reverse proxy.
 * @param {import("express").Request} req current request
 * @returns {string} absolute callback URL
 */
export function redirectUri(req) {
  if (process.env.ZU_GOOGLE_REDIRECT_URI) {
    return process.env.ZU_GOOGLE_REDIRECT_URI;
  }
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}/auth/google/callback`;
}

function base64url(buffer) {
  return buffer.toString("base64url");
}

function prune() {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (entry.expiresAt <= now) pendingStates.delete(state);
  }

  // Evict oldest-first once the ceiling is reached. A flood can then only cost
  // a bounded amount of memory; the worst it can do is push out other people's
  // in-flight sign-ins, who get googleStateMismatch and can simply retry.
  while (pendingStates.size >= MAX_PENDING_STATES) {
    const oldest = pendingStates.keys().next();
    if (oldest.done) break;
    pendingStates.delete(oldest.value);
  }
}

/**
 * Builds the Google consent URL and records the matching PKCE verifier.
 * @param {import("express").Request} req current request
 * @param {string} [returnTo] frontend path to return to after login
 * @returns {string} the URL to redirect the browser to
 */
export function buildAuthUrl(req, returnTo) {
  prune();

  const state = base64url(crypto.randomBytes(32));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  pendingStates.set(state, {
    codeVerifier,
    redirectUri: redirectUri(req),
    returnTo: returnTo || "/",
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: requireEnv("ZU_GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  // Ask Google to only show accounts on our domain. This is a UX hint, never a
  // security control -- the callback re-checks the domain on the verified claims.
  const domains = allowedDomains();
  if (domains.length === 1) {
    params.set("hd", domains[0]);
  }

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Consumes a previously issued state value. One-shot by design.
 * @param {string} state the state returned by Google
 * @returns {{codeVerifier: string, redirectUri: string, returnTo: string} | null} the pending request, or null
 */
export function consumeState(state) {
  prune();
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  return entry;
}

/**
 * Decodes an ID token payload without verifying its signature.
 *
 * This is only safe because we read tokens straight off Google's token
 * endpoint over TLS in a server-to-server call -- never do this to a token
 * that arrived from a browser.
 * @param {string} idToken the JWT from the token endpoint
 * @returns {Record<string, any>} the decoded claims
 */
function decodeIdToken(idToken) {
  const parts = String(idToken).split(".");
  if (parts.length !== 3) throw new Error("googleInvalidToken");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

/**
 * Exchanges an authorization code for the signed-in user's claims.
 * @param {string} code the authorization code from Google
 * @param {{codeVerifier: string, redirectUri: string}} pending the matching pending request
 * @returns {Promise<{sub: string, email: string, name: string, picture: string}>} verified profile claims
 */
export async function exchangeCode(code, pending) {
  const body = new URLSearchParams({
    code: code,
    client_id: requireEnv("ZU_GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("ZU_GOOGLE_CLIENT_SECRET"),
    redirect_uri: pending.redirectUri,
    grant_type: "authorization_code",
    code_verifier: pending.codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error("Google token exchange failed:", await response.text());
    throw new Error("googleExchangeFailed");
  }

  const tokens = await response.json();
  if (!tokens.id_token) throw new Error("googleExchangeFailed");

  const claims = decodeIdToken(tokens.id_token);

  if (claims.aud !== process.env.ZU_GOOGLE_CLIENT_ID) {
    throw new Error("googleInvalidToken");
  }
  if (
    claims.iss !== "accounts.google.com" &&
    claims.iss !== "https://accounts.google.com"
  ) {
    throw new Error("googleInvalidToken");
  }
  // Absent or non-numeric exp is rejected rather than skipped: a token that
  // cannot be shown to be unexpired is not one we should accept.
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
    throw new Error("googleInvalidToken");
  }
  // Likewise email_verified must be exactly true. Google always sends it, so
  // anything else means we are not looking at the token we think we are.
  if (!claims.email || claims.email_verified !== true) {
    throw new Error("googleUnverifiedEmail");
  }

  return {
    sub: claims.sub,
    email: String(claims.email).toLowerCase(),
    name: claims.name || claims.email,
    picture: claims.picture || "",
  };
}
