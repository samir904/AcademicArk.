// CONTROLLERS/searchAdminSuggestions.controller.js
import SearchAnalytics from "../MODELS/searchAnalytics.model.js";
import SearchCorrection from "../MODELS/searchCorrection.model.js";

export const getCorrectionSuggestions = async (req, res) => {
  try {
    const minCount = Number(req.query.minCount) || 3;

    // 1️⃣ All existing corrections
    const existingCorrections = await SearchCorrection.find({})
      .select("wrongQuery")
      .lean();

    const existingSet = new Set(
      existingCorrections.map(c => c.wrongQuery)
    );

    // 2️⃣ Aggregate failed searches
    const failed = await SearchAnalytics.aggregate([
      { $match: { isFailedSearch: true } },
      {
        $group: {
          _id: "$normalizedQuery",
          rawQuery: { $first: "$rawQuery" },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gte: minCount } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // 3️⃣ Filter ones WITHOUT correction
    const suggestions = failed.filter(
      f => !existingSet.has(f._id)
    );

    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error("❌ correction suggestion error:", error);
    res.status(500).json({ success: false });
  }
};
