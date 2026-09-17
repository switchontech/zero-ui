import express from "express";
import rateLimit from "express-rate-limit";

const router = express.Router();

import * as auth from "../services/auth.js";
import * as user from "../services/user.js";
import * as google from "../utils/google-oauth.js";

const loginLimiter = rateLimit({
  windowMs: (Number(process.env.ZU_LOGIN_LIMIT_WINDOW) || 30) * 60 * 1000, // 30 minutes
  max: Number(process.env.ZU_LOGIN_LIMIT_ATTEMPTS) || 50, // limit each IP to 50 requests per windowMs
  message: {
    status: 429,
    error: "tooManyAttempts",
  },
});

const loginLimiterWrapper = (req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ZU_LOGIN_LIMIT === "true"
  ) {
    return loginLimiter(req, res, next);
  } else {
    return next();
  }
};

/**
 * Sends the browser back to the frontend, carrying the outcome in the URL
 * fragment so the token never reaches a server log, proxy or Referer header.
 * @param {import("express").Response} res outgoing response
 * @param {string} returnTo frontend path to land on
 * @param {Record<string, string>} params fragment parameters
 * @returns {void}
 */
function redirectToApp(res, returnTo, params) {
  const base = (process.env.ZU_FRONTEND_BASE || "/app").replace(/\/$/, "");
  // Only ever a same-origin app path: an open redirect here would hand the
  // session token in the fragment to whatever host the attacker named.
  const path = returnTo && /^\/(?!\/)[\w\-/]*$/.test(returnTo) ? returnTo : "/";
  const fragment = new URLSearchParams(params).toString();
  // Trailing slash matters: redirecting to "/app" makes express.static issue a
  // 301 to "/app/", and a fragment does not reliably survive that hop.
  res.redirect(`${base}${path}#${fragment}`);
}

// what sign-in methods this instance offers
router.get("/login", async function (req, res) {
  res.send({
    enabled: process.env.ZU_DISABLE_AUTH !== "true",
    google: google.isGoogleEnabled(),
    localLogin: auth.isLocalLoginEnabled(),
    allowedDomains: google.allowedDomains(),
  });
});

// start the Google sign-in flow
router.get("/google", loginLimiterWrapper, function (req, res) {
  if (!google.isGoogleEnabled()) {
    return res.status(404).send({ error: "googleNotConfigured" });
  }
  if (google.allowedDomains().length === 0) {
    console.error(
      "ZU_GOOGLE_ALLOWED_DOMAINS is empty - refusing to start a sign-in that would accept any Google account"
    );
    return res.status(500).send({ error: "googleNotConfigured" });
  }
  res.redirect(google.buildAuthUrl(req, String(req.query.returnTo || "/")));
});

// Google redirects the browser back here with an authorization code
router.get("/google/callback", loginLimiterWrapper, async function (req, res) {
  const pending = google.consumeState(String(req.query.state || ""));
  if (!pending) {
    return redirectToApp(res, "/", { error: "googleStateMismatch" });
  }

  if (req.query.error || !req.query.code) {
    return redirectToApp(res, pending.returnTo, {
      error: String(req.query.error || "googleNoCode"),
    });
  }

  try {
    const profile = await google.exchangeCode(String(req.query.code), pending);

    if (!google.isAllowedEmail(profile.email)) {
      console.warn(
        `Rejected sign-in for out-of-domain account: ${profile.email}`
      );
      return redirectToApp(res, pending.returnTo, {
        error: "domainNotAllowed",
      });
    }

    const account = user.upsertGoogleUser(profile);
    if (account.enabled === false) {
      return redirectToApp(res, pending.returnTo, { error: "accountDisabled" });
    }

    const session = user.createSession(account.id);
    return redirectToApp(res, pending.returnTo, {
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    console.error("Google sign-in failed:", err);
    const message = err instanceof Error ? err.message : "googleSignInFailed";
    return redirectToApp(res, pending.returnTo, { error: message });
  }
});

router.post("/login", loginLimiterWrapper, async function (req, res) {
  if (!auth.isLocalLoginEnabled()) {
    return res.status(403).send({ error: "localLoginDisabled" });
  }
  if (!req.body.username || !req.body.password) {
    return res.status(400).send({ error: "Specify username and password" });
  }

  auth.authorize(req.body.username, req.body.password, function (err, account) {
    if (!account) {
      return res.status(401).send({ error: err ? err.message : "logInFailed" });
    }
    const session = user.createSession(account.id);
    res.send({ token: session.token, expiresAt: session.expiresAt });
  });
});

// the signed-in user's own profile
router.get("/me", auth.isAuthorized, function (req, res) {
  if (!req.user) {
    return res.send({ id: null, name: "anonymous", provider: "none" });
  }
  res.send(user.publicUser(req.user));
});

router.post("/logout", auth.isAuthorized, function (req, res) {
  if (req.token) user.revokeSession(req.token);
  res.send({ ok: true });
});

export default router;
