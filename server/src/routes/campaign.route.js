const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");

const {
  createCampaign,
  getCampaignReport,
  getCampaigns,
  getPublicCampaignReport,
  deleteCampaign,
} = require("../controllers/campaign.controller");
const verifyFirebaseToken = require("../middlewares/firebaseAuth.middleware");

// router.use(verifyJWT);

router.route("/").get(getCampaigns).post(verifyFirebaseToken, createCampaign);
router
  .route("/:campaignId")
  .get(getPublicCampaignReport)
  .delete(verifyFirebaseToken, deleteCampaign);

module.exports = router;
