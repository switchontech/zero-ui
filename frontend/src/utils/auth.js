import axios from "axios";

/**
 * Reads the session token the same way utils/API.js does, so the two never
 * disagree about who is signed in.
 *
 * @returns {string | null} the stored bearer token
 */
export function getToken() {
  try {
    const raw = localStorage.getItem("token");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears every trace of the session and reloads, which is what we want after a
 * log out or once the backend tells us the token is no longer good.
 *
 * @returns {void}
 */
export function clearSession() {
  localStorage.clear();
  window.location.assign("/app");
}

/**
 * Asks the backend which sign-in methods this instance offers.
 *
 * @returns {Promise<{enabled: boolean, google: boolean, localLogin: boolean, allowedDomains: string[]}>} the capabilities
 */
export async function fetchAuthConfig() {
  const response = await axios.get("/auth/login", { withCredentials: true });
  return {
    enabled: response.data.enabled !== false,
    google: Boolean(response.data.google),
    localLogin: response.data.localLogin !== false,
    allowedDomains: response.data.allowedDomains || [],
  };
}

/**
 * Sends the browser to Google. The backend owns the client secret and the
 * state/PKCE values, so all the frontend does is leave.
 *
 * @param {string} [returnTo] the app path to come back to
 * @returns {void}
 */
export function startGoogleLogin(returnTo) {
  const target =
    returnTo || window.location.pathname.replace(/^\/app/, "") || "/";
  window.location.assign(`/auth/google?returnTo=${encodeURIComponent(target)}`);
}

/**
 * Picks up the result of a Google sign-in.
 *
 * The backend hands the token back in the URL fragment so it never reaches a
 * server log or a Referer header. We consume it once and scrub it from the
 * address bar so a copied link cannot leak a live session.
 *
 * @returns {{token?: string, error?: string} | null} the outcome, or null when this is not a callback
 */
export function consumeLoginFragment() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get("token");
  const error = params.get("error");
  if (!token && !error) return null;

  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );

  if (token) {
    localStorage.setItem("token", JSON.stringify(token));
    localStorage.setItem("loggedIn", "true");
    localStorage.setItem("disableAuth", "false");
    return { token };
  }

  return { error: error || undefined };
}

/**
 * Ends the session on the backend before clearing it locally, so the token
 * cannot be replayed if it leaked.
 *
 * @returns {Promise<void>} resolves once the session is gone
 */
export async function logOut() {
  try {
    await axios.post(
      "/auth/logout",
      {},
      { headers: { Authorization: `token ${getToken()}` } }
    );
  } catch {
    // The session is going away locally regardless; a failed revoke should
    // never trap someone in a logged-in state.
  }
  clearSession();
}
