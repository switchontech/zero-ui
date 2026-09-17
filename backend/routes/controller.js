import express from "express";
const router = express.Router();

import * as auth from "../services/auth.js";
import { api } from "../utils/controller-api.js";
import { asyncHandler } from "../utils/async-handler.js";

router.get(
  "/status",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    const controllerRes = await api.get("status");
    res.send(controllerRes.data);
  })
);

export default router;
