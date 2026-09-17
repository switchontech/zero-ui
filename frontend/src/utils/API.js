import axios from "axios";

const baseURL = "/api/";

const API = axios.create({
  baseURL: baseURL,
  responseType: "json",
  withCredentials: true,
});

// The token is read per request rather than captured when this module is
// imported. Module bodies run before the OAuth callback has had a chance to
// store the new token, so a snapshot here would send a stale (or missing) one
// on the first request after signing in.
API.interceptors.request.use((config) => {
  if (localStorage.getItem("disableAuth") === "true") return config;

  const raw = localStorage.getItem("token");
  if (!raw) return config;

  try {
    config.headers.Authorization = `token ${JSON.parse(raw)}`;
  } catch {
    // A malformed entry is treated as no token at all; the request will come
    // back 401 and the response interceptor below will clear the session.
  }
  return config;
});

// A session the backend no longer recognises -- expired, revoked, or belonging
// to a disabled account -- should drop us back to the log-in screen rather than
// leaving the UI to fail one request at a time.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (
      (status === 401 || status === 403) &&
      localStorage.getItem("disableAuth") !== "true" &&
      localStorage.getItem("loggedIn") === "true"
    ) {
      localStorage.clear();
      window.location.assign("/app");
    }
    return Promise.reject(error);
  }
);

export default API;
