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

// router.use(verifyJWT);

router.route("/").get(getAllInvestors).post(bulkAddInvestors);

router.route("/:id").put(updateInvestor).delete(deleteInvestor); // Implement handler later

router.route("/upload-csv").post(upload.single("file"), uploadCSV);

router.route("/matchmaking").get(getPaginatedInvestors);

module.exports = router;
