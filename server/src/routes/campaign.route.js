const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");

const {
  createCampaign,
  getCampaignReport,
} = require("../controllers/campaign.controller");

// router.use(verifyJWT);

router.route("/").post(createCampaign);
router.route("/:campaignId").get(getCampaignReport);

module.exports = router;
