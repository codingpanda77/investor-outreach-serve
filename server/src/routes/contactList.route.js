const express = require("express");
const router = express.Router();

// const { verifyJWT } = require("../middlewares/auth.middleware");
const verifyFirebaseToken = require("../middlewares/firebaseAuth.middleware");
const {
  createContactList,
  getAllContactLists,
  getContactListsByCompany,
  deleteContactList,
} = require("../controllers/contactList.controller");

// router.use(verifyJWT);

router
  .route("/")
  .get(verifyFirebaseToken, getAllContactLists)
  .post(verifyFirebaseToken, createContactList);

router
  .route("/:id")
  .get(verifyFirebaseToken, getContactListsByCompany)
  .delete(verifyFirebaseToken, deleteContactList);

module.exports = router;
