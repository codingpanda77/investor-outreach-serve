exports.getEmailVerificationStatus = async (req, res) => {
  const { clientId } = req.params;

  try {
    const client = await Client.findById(clientId);
    if (!client)
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });

    const email = client.email;
    const params = { Identities: [email] };

    const data = await ses.getIdentityVerificationAttributes(params).promise();
    const attr = data.VerificationAttributes[email];

    const isVerified = attr && attr.VerificationStatus === "Success";

    return res.json({
      success: true,
      verified: isVerified,
      status: attr?.VerificationStatus || "NotFound",
    });
  } catch (error) {
    console.error("SES verification check failed:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
