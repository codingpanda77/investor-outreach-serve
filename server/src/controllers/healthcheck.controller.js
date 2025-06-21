const healthcheck = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "API is working fine!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Healthcheck failed",
      error: error.message,
    });
  }
};

module.exports = {
  healthcheck,
};