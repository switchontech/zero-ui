import express from "express";
const router = express.Router({ mergeParams: true });

import * as auth from "../services/auth.js";
import * as member from "../services/member.js";

import { api } from "../utils/controller-api.js";
import { asyncHandler } from "../utils/async-handler.js";

// get all members
router.get(
  "/",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    // @ts-ignore
    const nwid = req.params.nwid;
    const controllerRes = await api.get(
      "controller/network/" + nwid + "/member"
    );
    const mids = Object.keys(controllerRes.data);
    const data = await member.getMembersData(nwid, mids);
    res.send(data);
  })
);

// get member
router.get(
  "/:mid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    // @ts-ignore
    const nwid = req.params.nwid;
    const mid = req.params.mid;
    const data = await member.getMembersData(nwid, [mid]);
    if (data[0]) {
      res.send(data[0]);
    } else {
      res.status(404).send({ error: "Member not found" });
    }
  })
);

// update member
router.post(
  "/:mid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    // @ts-ignore
    const nwid = req.params.nwid;
    const mid = req.params.mid;
    member.updateMemberAdditionalData(nwid, mid, req.body);
    if (req.body.config) {
      await api.post(
        "controller/network/" + nwid + "/member/" + mid,
        req.body.config
      );
    }
    const data = await member.getMembersData(nwid, [mid]);
    res.send(data[0]);
  })
);

// delete member
router.delete(
  "/:mid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    // @ts-ignore
    const nwid = req.params.nwid;
    const mid = req.params.mid;
    member.deleteMemberAdditionalData(nwid, mid);

    await api.delete("controller/network/" + nwid + "/member/" + mid);

    // Need this to fix ZT controller bug
    // https://github.com/zerotier/ZeroTierOne/issues/859
    const defaultConfig = {
      authorized: false,
      ipAssignments: [],
      capabilities: [],
      tags: [],
    };
    // Awaited in sequence rather than fired alongside the delete: run
    // concurrently, both branches answered the same request, and whichever
    // finished second threw on an already-sent response.
    const controllerRes = await api.post(
      "controller/network/" + nwid + "/member/" + mid,
      defaultConfig
    );
    res.status(controllerRes.status).send("");
  })
);

export default router;
