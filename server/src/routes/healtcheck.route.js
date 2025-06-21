const express = require("express");
const router = express.Router();

const { healthcheck } = require("../controllers/healthcheck.controller.js");
const verifyFirebaseToken = require("../middlewares/firebaseAuth.middleware.js");

router.route("/").get(verifyFirebaseToken, healthcheck);

module.exports = router;
