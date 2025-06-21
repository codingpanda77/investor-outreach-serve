const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");
const {
  addClientData,
  deleteClientData,
  getActiveClientData,
  getClientData,
  updateClientData,
  verifyClientEmail,
  updateClientEmailVerification,
} = require("../controllers/company.controller");
const verifyFirebaseToken = require("../middlewares/firebaseAuth.middleware");

// router.use(verifyJWT);

router
  .route("/")
  .get(verifyFirebaseToken, getClientData)
  .post(verifyFirebaseToken, addClientData);

router.route("/active").get(verifyFirebaseToken, getActiveClientData);

router
  .route("/:id")
  .put(verifyFirebaseToken, updateClientData)
  .delete(verifyFirebaseToken, deleteClientData);

router.route("/verify-email").post(verifyFirebaseToken, verifyClientEmail);
router
  .route("/get-verify-status")
  .post(verifyFirebaseToken, updateClientEmailVerification);

module.exports = router;
