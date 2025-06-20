const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");

const {
  sendEmail,
  trackOpen,
  updateDeliveryStatus,
  storeReply,
  getCampaignReport,
  getEmailCampaignReport,
} = require("../controllers/emailStatus.controller");

// router.use(verifyJWT);

router.route("/send").post(sendEmail);
router.route("/receive").post(storeReply);
router.route("/report/:id").get(getEmailCampaignReport);
router.route("/track").get(trackOpen).post(updateDeliveryStatus);

module.exports = router;
