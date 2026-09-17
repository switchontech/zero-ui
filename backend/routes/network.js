import express from "express";
const router = express.Router();

import * as auth from "../services/auth.js";
import * as network from "../services/network.js";

import { api } from "../utils/controller-api.js";
import { defaultRules } from "../utils/constants.js";
import { getZTAddress } from "../utils/zt-address.js";
import { asyncHandler } from "../utils/async-handler.js";

let ZT_ADDRESS = null;
getZTAddress()
  .then(function (address) {
    ZT_ADDRESS = address;
    return address;
  })
  .catch(function (err) {
    console.error("Could not read the controller address:", err);
  });

// get all networks
router.get(
  "/",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    const controllerRes = await api.get("controller/network");
    const nwids = controllerRes.data;
    const data = await network.getNetworksData(nwids);
    res.send(data);
  })
);

// get network
router.get(
  "/:nwid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    const nwid = req.params.nwid;
    const data = await network.getNetworksData([nwid]);
    if (data[0]) {
      res.send(data[0]);
    } else {
      res.status(404).send({ error: "Network not found" });
    }
  })
);

// create new network
router.post(
  "/",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    let reqData = req.body;
    if (!reqData.config) {
      return res.status(400).send({ error: "Bad request" });
    }

    const config = reqData.config;
    delete reqData.config;
    reqData = config;
    reqData.rules = JSON.parse(defaultRules);

    // Without the controller's own address there is no valid network id to
    // create under, and posting to "null______" would silently make a network
    // nobody can reach.
    if (!ZT_ADDRESS) {
      ZT_ADDRESS = await getZTAddress();
    }
    if (!ZT_ADDRESS) {
      return res.status(504).send({ error: "controllerUnreachable" });
    }

    const controllerRes = await api.post(
      "controller/network/" + ZT_ADDRESS + "______",
      reqData
    );
    await network.createNetworkAdditionalData(controllerRes.data.id);
    const data = await network.getNetworksData([controllerRes.data.id]);
    res.send(data[0]);
  })
);

// update network
router.post(
  "/:nwid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    const nwid = req.params.nwid;
    network.updateNetworkAdditionalData(nwid, req.body);
    if (req.body.config) {
      await api.post("controller/network/" + nwid, req.body.config);
    }
    const data = await network.getNetworksData([nwid]);
    res.send(data[0]);
  })
);

// delete network
router.delete(
  "/:nwid",
  auth.isAuthorized,
  asyncHandler(async function (req, res) {
    const nwid = req.params.nwid;
    network.deleteNetworkAdditionalData(nwid);
    const controllerRes = await api.delete("controller/network/" + nwid);
    res.status(controllerRes.status).send("");
  })
);

export default router;
