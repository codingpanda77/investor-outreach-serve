const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "https://email-sender-platform.web.app"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes import
const healthcheckRouter = require("./routes/healtcheck.route");
const investorRoutes = require("./routes/investor.route");
const companyRoutes = require("./routes/company.route");
const campaignRoutes = require("./routes/campaign.route");
const emailStatusRoutes = require("./routes/emailStatus.route");
const contactListRoutes = require("./routes/contactList.route");
const {
  updateDeliveryStatus,
} = require("./controllers/emailStatus.controller");

// Router Declaration
app.use("/", healthcheckRouter);
app.use("/investors", investorRoutes);
app.use("/clients", companyRoutes);
app.use("/campaign", campaignRoutes);
app.use("/email", emailStatusRoutes);
app.use("/contact-list", contactListRoutes);
app.post("/sns-email-events", updateDeliveryStatus);

module.exports = app;
