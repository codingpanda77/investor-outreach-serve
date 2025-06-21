function transformFrontendToDB(data) {
  const transformItem = (item) => ({
    partner_email: item.partner_email?.toLowerCase().trim() || "",
    investor_name: item.investor_name?.trim().toLowerCase() || "",
    partner_name: item.partner_name?.trim().toLowerCase() || "",
    fund_type: item.fund_type?.toLowerCase().trim() || "",

    fund_stage: item.fund_stage
      ? item.fund_stage
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],

    location: item.location?.trim() || "",
    website: item.website?.trim() || "",

    sector_focus: item.sector_focus
      ? item.sector_focus
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],

    portfolio_companies: item.portfolio_companies
      ? item.portfolio_companies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],

    twitter_link: item.twitter_link?.trim() || "",
    linkedIn_link: item.linkedIn_link?.trim() || "",
    facebook_link: item.facebook_link?.trim() || "",

    number_of_investments: Number(item.number_of_investments) || 0,
    number_of_exits: Number(item.number_of_exits) || 0,
    fund_description: item.fund_description?.trim() || "",
    founded_year: Number(item.founded_year) || null,
  });

  return Array.isArray(data) ? data.map(transformItem) : transformItem(data);
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
