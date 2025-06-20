const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");
const {
  addClientData,
  deleteClientData,
  getActiveClientData,
  getClientData,
  updateClientData,
} = require("../controllers/company.controller");

// router.use(verifyJWT);

router.route("/").get(getClientData).post(addClientData);

router.route("/active").get(getActiveClientData);

router.route("/:id").put(updateClientData).delete(deleteClientData);

module.exports = router;
