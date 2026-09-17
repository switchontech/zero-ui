import express from "express";

const router = express.Router();

import * as auth from "../services/auth.js";
import * as user from "../services/user.js";

// Every signed-in user has the same permissions, so each of these routes needs
// nothing beyond a valid session. The guards below are about not letting
// someone lock the instance out of itself, not about privilege.

router.get("/", auth.isAuthorized, function (req, res) {
  res.send(user.listUsers().map((account) => user.publicUser(account)));
});

router.get("/:id", auth.isAuthorized, function (req, res) {
  const found = user.getUser(req.params.id);
  if (!found) return res.status(404).send({ error: "userNotFound" });
  res.send(user.publicUser(found));
});

// enable or disable an account
router.patch("/:id", auth.isAuthorized, function (req, res) {
  const found = user.getUser(req.params.id);
  if (!found) return res.status(404).send({ error: "userNotFound" });

  if (typeof req.body.enabled !== "boolean") {
    return res.status(400).send({ error: "specifyEnabled" });
  }

  if (!req.body.enabled) {
    if (req.user && found.id === req.user.id) {
      return res.status(400).send({ error: "cannotDisableSelf" });
    }
    if (countEnabledOthers(found.id) === 0) {
      return res.status(400).send({ error: "lastEnabledUser" });
    }
  }

  const updated = user.setUserEnabled(found.id, req.body.enabled);
  res.send(user.publicUser(updated || found));
});

// sign a user out of every device
router.delete("/:id/sessions", auth.isAuthorized, function (req, res) {
  const found = user.getUser(req.params.id);
  if (!found) return res.status(404).send({ error: "userNotFound" });
  user.revokeAllSessions(found.id);
  res.send({ ok: true });
});

router.delete("/:id", auth.isAuthorized, function (req, res) {
  const found = user.getUser(req.params.id);
  if (!found) return res.status(404).send({ error: "userNotFound" });

  if (req.user && found.id === req.user.id) {
    return res.status(400).send({ error: "cannotDeleteSelf" });
  }
  if (countEnabledOthers(found.id) === 0) {
    return res.status(400).send({ error: "lastEnabledUser" });
  }

  user.deleteUser(found.id);
  res.send({ ok: true });
});

/**
 * Counts accounts that could still sign in if the given user went away.
 * @param {string} excludeId the user being disabled or deleted
 * @returns {number} how many enabled accounts would remain
 */
function countEnabledOthers(excludeId) {
  return user
    .listUsers()
    .filter((candidate) => candidate.id !== excludeId)
    .filter((candidate) => candidate.enabled !== false).length;
}

export default router;
