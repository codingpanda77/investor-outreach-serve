const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");

const { createCampaign } = require("../controllers/campaign.controller");

// router.use(verifyJWT);

router.route("/").post(createCampaign);

module.exports = router;
