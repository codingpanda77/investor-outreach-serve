const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/multer.middleware");
const {
  bulkAddInvestors,
  getAllInvestors,
  uploadCSV,
  getPaginatedInvestors,
  updateInvestor,
  deleteInvestor,
} = require("../controllers/investor.controller");
const verifyFirebaseToken = require("../middlewares/firebaseAuth.middleware");

// router.use(verifyJWT);

router
  .route("/")
  .get(verifyFirebaseToken, getAllInvestors)
  .post(verifyFirebaseToken, bulkAddInvestors);

router
  .route("/:id")
  .put(verifyFirebaseToken, updateInvestor)
  .delete(verifyFirebaseToken, deleteInvestor); // Implement handler later

router
  .route("/upload-csv")
  .post(verifyFirebaseToken, upload.single("file"), uploadCSV);

router.route("/matchmaking").get(verifyFirebaseToken, getPaginatedInvestors);

module.exports = router;
