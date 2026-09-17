import path from "path";
import * as url from "url";
import express from "express";
import logger from "morgan";
import compression from "compression";
import bearerToken from "express-bearer-token";
import helmet from "helmet";
import { Cron } from "croner";

import { db } from "./utils/db.js";
import { initAdmin } from "./utils/init-admin.js";
import { pingAll } from "./utils/ping.js";
import { migrateUsers } from "./services/user.js";
import { isGoogleEnabled, allowedDomains } from "./utils/google-oauth.js";
import { isLocalLoginEnabled } from "./utils/auth-policy.js";
import {
  describeControllerError,
  isControllerError,
} from "./utils/controller-error.js";

import authRoutes from "./routes/auth.js";
import networkRoutes from "./routes/network.js";
import memberRoutes from "./routes/member.js";
import userRoutes from "./routes/user.js";
import controllerRoutes from "./routes/controller.js";

const app = express();
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
if (process.env.ZU_DISABLE_AUTH !== "true") {
  app.use(
    bearerToken({
      headerKey: "token",
    })
  );
}

if (process.env.NODE_ENV === "production") {
  console.debug = function () {};
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.ZU_SECURE_HEADERS !== "false"
) {
  // @ts-ignore
  app.use(helmet());
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.ZU_SERVE_FRONTEND !== "false"
) {
  app.use(compression());
  app.use(
    ["/app", "/app/*"],
    express.static(path.join(__dirname, "..", "frontend", "build"))
  );
  app.use(
    ["/locales", "/locales/*"],
    express.static(path.join(__dirname, "..", "frontend", "build", "locales"))
  );
  // SPA fallback: any /app route that is not a real file is handled by the
  // client-side router. express.static above has already served real assets.
  app.get(["/app/*"], function (req, res) {
    res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
  });
  app.get("/", function (req, res) {
    res.redirect("/app");
  });
}

// With local login off and Google unconfigured there is no way in at all.
// Failing here is friendlier than starting a panel nobody can sign in to.
if (
  !isLocalLoginEnabled() &&
  !isGoogleEnabled() &&
  process.env.ZU_DISABLE_AUTH !== "true"
) {
  console.error(
    "ZU_LOCAL_LOGIN is false but Google sign-in is not configured, so no one could sign in. Set ZU_GOOGLE_CLIENT_ID and ZU_GOOGLE_CLIENT_SECRET, or set ZU_LOCAL_LOGIN=true."
  );
  throw new Error("noSignInMethodConfigured");
}

initAdmin().then(function (admin) {
  db.defaults({ users: admin ? [admin] : [], networks: [] }).write();
  migrateUsers();
});

if (isGoogleEnabled() && allowedDomains().length === 0) {
  console.error(
    "Google sign-in is configured but ZU_GOOGLE_ALLOWED_DOMAINS is empty. Set it to the domains allowed to sign in, e.g. example.com"
  );
}

if (process.env.ZU_LAST_SEEN_FETCH !== "false") {
  let schedule = process.env.ZU_LAST_SEEN_SCHEDULE || "*/5 * * * *";
  Cron(schedule, () => {
    console.debug("Running scheduled job");
    const networks = db.get("networks").value();
    networks.forEach(async (network) => {
      console.debug("Processing network " + network.id);
      await pingAll(network);
    });
  });
}

const routerAPI = express.Router();
const routerController = express.Router();

routerAPI.use("/network", networkRoutes);
routerAPI.use("/network/:nwid/member", memberRoutes);
routerController.use("", controllerRoutes);

app.use("/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api", routerAPI); // offical SaaS API compatible
app.use("/controller", routerController); // other controller-specific routes

// error handlers
app.get("*", async function (req, res) {
  res.status(404).json({ error: "404 Not found" });
});
app.use(function (err, req, res, next) {
  // A handler that already answered and then failed cannot be answered again;
  // hand it to Express, which closes the connection.
  if (res.headersSent) {
    return next(err);
  }

  if (isControllerError(err)) {
    const described = describeControllerError(err);
    console.error(
      `Controller request failed (${req.method} ${req.originalUrl}):`,
      err.message
    );
    return res.status(described.status).json({
      error: described.error,
      ...(described.detail ? { detail: described.detail } : {}),
    });
  }

  console.error(err.stack);
  res.status(500).json({ error: "500 Internal server error" });
});

export default app;
