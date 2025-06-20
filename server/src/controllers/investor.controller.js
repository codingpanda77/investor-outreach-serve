const fs = require("fs").promises;
const Papa = require("papaparse");
const Investor = require("../models/investor.model");
const transformFrontendToDB = require("../utils/functions");

exports.getPaginatedInvestors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      fund_stage = [],
      fund_type = [],
      sector = [],
    } = req.query;

    const matchStage = {};

    if (search.trim()) {
      matchStage.$text = { $search: search.trim() };
    }

    if (Array.isArray(fund_stage) && fund_stage.length > 0) {
      matchStage.fund_stage = {
        $in: fund_stage.map((s) => s.toLowerCase()),
      };
    }

    if (Array.isArray(fund_type) && fund_type.length > 0) {
      matchStage.fund_type = {
        $in: fund_type.map((t) => t.toLowerCase()),
      };
    }

    if (Array.isArray(sector) && sector.length > 0) {
      matchStage.sector_focus = {
        $elemMatch: {
          $in: sector.map((s) => s.toLowerCase()),
        },
      };
    }

    // const pipeline = [
    //   { $match: matchStage },
    //   { $sort: { createdAt: -1 } },
    //   { $skip: (page - 1) * limit },
    //   { $limit: parseInt(limit) },
    // ];

    // const explain = await Investor.collection
    //   .aggregate(pipeline)
    //   .explain("executionStats");
    // console.log(
    //   "Explain Stats:",
    //   JSON.stringify(explain.executionStats, null, 2)
    // );

    const aggregate = Investor.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
    ]);

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const result = await Investor.aggregatePaginate(aggregate, options);

    res.status(200).json(result);
  } catch (err) {
    console.error("Error in getPaginatedInvestors:", err);
    res.status(500).json({ error: err.message });
  }
};

// Controller to add investors data manually

exports.bulkAddInvestors = async (req, res) => {
  try {
    const investorData = req.body;

    if (!Array.isArray(investorData) || investorData.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid request: Array of investor data is required" });
    }

    const invalid = investorData.find(
      (inv) => !inv["partner_email"] || !inv["list_id"]
    );
    if (invalid) {
      return res.status(400).json({
        error: "Each investor must have 'partner_email' and 'listId'",
      });
    }

    const cleanedData = investorData.map(normalizeInvestor);
    const result = await Investor.insertMany(cleanedData);

    // const result = await Investor.insertMany(investorData);

    res.status(201).json({
      ids: result.map((doc) => doc._id),
      message: `Successfully added ${result.length} investors`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add investors",
      details: error.message,
    });
  }
};

exports.bulkAddInvestors = async (req, res) => {
  try {
    const investorData = req.body;

    if (!Array.isArray(investorData) || investorData.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid request: Array of investor data is required" });
    }

    const invalid = investorData.find(
      (inv) => !inv["partner_email"] || !inv["list_id"]
    );
    if (invalid) {
      return res.status(400).json({
        error: "Each investor must have 'partner_email' and 'list_id'",
      });
    }

    // Normalize each investor
    const normalizedData = investorData.map((item) =>
      transformFrontendToDB(item, item.list_id)
    );

    const result = await Investor.insertMany(normalizedData);

    res.status(201).json({
      ids: result.map((doc) => doc._id),
      message: `Successfully added ${result.length} investors`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add investors",
      details: error.message,
    });
  }
};

// Controller to add investors data by csv file
// exports.uploadCSV = async (req, res) => {
//   if (!req.file) return res.status(400).json({ error: "No file uploaded" });

//   const { listId } = req.body;
//   if (!listId) return res.status(400).json({ error: "listId is required" });

//   try {
//     const filePath = req.file.path;
//     const fileContent = await fs.readFile(filePath, "utf-8");

//     const { data, errors } = Papa.parse(fileContent, {
//       header: true,
//       skipEmptyLines: true,
//     });

//     // Remove uploaded file
//     fs.unlink(filePath).catch(console.error);

//     if (errors.length > 0) {
//       return res
//         .status(400)
//         .json({ error: "Invalid CSV format", details: errors });
//     }

//     const records = transformFrontendToDB(data, listId);

//     await Investor.insertMany(records);

//     res.status(201).json({
//       success: true,
//       message: `CSV uploaded successfully! ${records.length} records inserted.`,
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: "Failed to upload CSV",
//       details: error.message,
//     });
//   }
// };

exports.uploadCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { listId } = req.body;
  if (!listId) return res.status(400).json({ error: "listId is required" });

  try {
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath, "utf-8");

    const { data, errors } = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    await fs.unlink(filePath).catch(console.error); // Clean up file

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ error: "Invalid CSV format", details: errors });
    }

    // Normalize CSV records
    const records = transformFrontendToDB(data, listId);

    const result = await Investor.insertMany(records);

    res.status(201).json({
      success: true,
      message: `CSV uploaded successfully! ${records.length} records inserted.`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upload CSV",
      details: error.message,
    });
  }
};

exports.getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find();

    if (investors.length === 0) {
      return res.status(404).json({
        message: "No investors found",
        totalCount: 0,
        data: [],
      });
    }

    const formattedInvestors = investors.map((investor) => ({
      ...investor.toObject(),
      fund_stage: Array.isArray(investor.fund_stage)
        ? investor.fund_stage.join(", ")
        : investor.fund_stage,
      sector_focus: Array.isArray(investor.sector_focus)
        ? investor.sector_focus.join(", ")
        : investor.sector_focus,
      portfolio_companies: Array.isArray(investor.portfolio_companies)
        ? investor.portfolio_companies.join(", ")
        : investor.portfolio_companies,
    }));

    res.status(200).json({
      message: "Successfully retrieved all investors",
      totalCount: formattedInvestors.length,
      data: formattedInvestors,
    });
  } catch (error) {
    console.error("Error retrieving investors:", error);
    res.status(500).json({
      error: "Failed to retrieve investors",
      details: error.message,
    });
  }
};

exports.updateInvestor = async (req, res) => {
  try {
    const investorId = req.params.id;
    const updateData = req.body;

    if (!investorId) {
      return res.status(400).json({ error: "Investor ID is required" });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Update data is required" });
    }

    const normalizedData = transformFrontendToDB
      ? transformFrontendToDB(updateData, updateData.list_id)
      : updateData;

    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ error: "Investor not found" });
    }

    Object.assign(investor, normalizedData);
    await investor.save();

    res.status(200).json({
      message: `Investor ${investorId} updated successfully`,
      updatedFields: Object.keys(normalizedData),
    });
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(500)
      .json({ error: "Failed to update investor", details: error.message });
  }
};

exports.deleteInvestor = async (req, res) => {
  try {
    const investorId = req.params.id;

    if (!investorId) {
      return res.status(400).json({ error: "Investor ID is required" });
    }

    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ error: "Investor not found" });
    }

    await investor.deleteOne();

    res.status(200).json({
      message: `Successfully deleted investor with ID: ${investorId}`,
    });
  } catch (error) {
    console.error("Error deleting investor:", error);
    res.status(500).json({
      error: "Failed to delete investor",
      details: error.message,
    });
  }
};

exports.getFilterOptions = async (req, res) => {
  try {
    const result = await Investor.aggregate([
      {
        $facet: {
          fund_stage: [
            { $unwind: "$fund_stage" },
            { $group: { _id: { $toLower: "$fund_stage" } } },
            { $sort: { _id: 1 } },
          ],
          fund_type: [
            { $unwind: "$fund_type" },
            { $group: { _id: { $toLower: "$fund_type" } } },
            { $sort: { _id: 1 } },
          ],
          sector_focus: [
            { $unwind: "$sector_focus" },
            { $group: { _id: { $toLower: "$sector_focus" } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const format = (arr) => arr.map((item) => item._id);

    res.status(200).json({
      fund_stage: format(result[0].fund_stage),
      fund_type: format(result[0].fund_type),
      sector_focus: format(result[0].sector_focus),
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve filter options",
      details: err.message,
    });
  }
};

exports.getUniqueFundSectors = async (req, res) => {
  try {
    const result = await Investor.aggregate([
      {
        $project: {
          sector_focus: 1,
        },
      },
      {
        $unwind: "$sector_focus",
      },
      {
        $group: {
          _id: { $toLower: "$sector_focus" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const sector_focus = result.map((item) => item._id);

    res.status(200).json({
      sector_focus,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve sector_focus options",
      details: err.message,
    });
  }
};

exports.getUniqueFundTypes = async (req, res) => {
  try {
    const result = await Investor.aggregate([
      {
        $project: {
          fund_type: 1,
        },
      },
      {
        $group: {
          _id: { $toLower: "$fund_type" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const fund_type = result.map((item) => item._id);

    res.status(200).json({
      fund_type,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to retrieve fund_type options",
      details: err.message,
    });
  }
};
