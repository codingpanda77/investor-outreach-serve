function transformFrontendToDB(data, id) {
  const transformItem = (item) => ({
    // Required fields
    partner_email: item["Partner Email"]?.toLowerCase().trim() || "",
    investor_name: item["Investor Name"]?.trim().toLowerCase() || "",
    partner_name: item["Partner Name"]?.trim().toLowerCase() || "",
    fund_type: item["Fund Type"]?.toLowerCase().trim() || "",

    // Normalize fund_stage as lowercase array
    fund_stage: item["Fund Stage"]
      ? typeof item["Fund Stage"] === "string"
        ? item["Fund Stage"]
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : Array.isArray(item["Fund Stage"])
        ? item["Fund Stage"].map((s) => s.trim().toLowerCase())
        : []
      : [],

    // Other fields
    location: item["Location"]?.trim() || "",
    website: item["Website (if available)"]?.trim() || "",

    // Normalize sector_focus to lowercase array
    sector_focus: item["Fund Focus (Sectors)"]
      ? typeof item["Fund Focus (Sectors)"] === "string"
        ? item["Fund Focus (Sectors)"]
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : Array.isArray(item["Fund Focus (Sectors)"])
        ? item["Fund Focus (Sectors)"].map((s) => s.trim().toLowerCase())
        : []
      : [],

    // Normalize portfolio_companies
    portfolio_companies: item["Portfolio Companies"]
      ? typeof item["Portfolio Companies"] === "string"
        ? item["Portfolio Companies"]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : Array.isArray(item["Portfolio Companies"])
        ? item["Portfolio Companies"].map((s) => s.trim())
        : []
      : [],

    twitter_link: item["Twitter Link"]?.trim() || "",
    linkedIn_link: item["LinkedIn Link"]?.trim() || "",
    facebook_link: item["Facebook Link"]?.trim() || "",
    number_of_investments: Number(item["Number of Investments"]) || 0,
    number_of_exits: Number(item["Number of Exits"]) || 0,
    fund_description: item["Fund Description"]?.trim() || "",
    founded_year: Number(item["Founding Year"]) || null,
    list_id: id,
  });

  return Array.isArray(data)
    ? data.map((item) => transformItem(item))
    : transformItem(data);
}

async function fetchInvestorEmails(listId) {
  if (!listId || listId === "No Recipients") return [];
  const listIds = listId.split(",").map((id) => id.trim());
  const emails = [];
  const chunks = [];
  for (let i = 0; i < listIds.length; i += 10) {
    chunks.push(listIds.slice(i, i + 10));
  }
  try {
    const investorsRef = db.collection("investors");
    for (const chunk of chunks) {
      const querySnapshot = await investorsRef
        .where("listId", "in", chunk)
        .get();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data["Partner Email"]) emails.push(data["Partner Email"]);
      });
    }
    return emails;
  } catch (error) {
    console.error("Error fetching investor emails:", error);
    return [];
  }
}

module.exports = transformFrontendToDB;
