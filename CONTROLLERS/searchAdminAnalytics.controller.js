// CONTROLLERS/searchAdminAnalytics.controller.js
import failedSearchAction from "../MODELS/failedSearchAction.model.js";
import SearchAnalytics from "../MODELS/searchAnalytics.model.js";
import SearchCorrection from "../MODELS/searchCorrection.model.js";
import searchSynonym from "../MODELS/searchSynonym.model.js";

/**
 * 📊 ADMIN: GET FAILED SEARCHES
 * What users searched that returned ZERO results
 */
export const getFailedSearches = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;

    const failedSearches = await SearchAnalytics.aggregate([
      {
        $match: {
          isFailedSearch: true
        }
      },
      {
        $group: {
          _id: "$normalizedQuery",
          rawQuery: { $first: "$rawQuery" },
          count: { $sum: 1 },
          lastSearchedAt: { $max: "$createdAt" }
        }
      },
      {
        $sort: {
          count: -1,
          lastSearchedAt: -1
        }
      },
      {
        $limit: limit
      }
    ]);

    res.status(200).json({
      success: true,
      data: failedSearches
    });
  } catch (error) {
    console.error("❌ getFailedSearches error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch failed searches"
    });
  }
};

/**
 * 📈 ADMIN: GET TOP SEARCH QUERIES
 * Most searched queries (success + failure)
 */
export const getTopSearchQueries = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;

    const topSearches = await SearchAnalytics.aggregate([
      {
        $group: {
          _id: "$normalizedQuery",
          rawQuery: { $first: "$rawQuery" },
          totalSearches: { $sum: 1 },
          failedCount: {
            $sum: {
              $cond: [{ $eq: ["$isFailedSearch", true] }, 1, 0]
            }
          },
          avgResults: { $avg: "$resultsCount" },
          lastSearchedAt: { $max: "$createdAt" }
        }
      },
      {
        $sort: {
          totalSearches: -1
        }
      },
      {
        $limit: limit
      }
    ]);

    res.status(200).json({
      success: true,
      data: topSearches
    });
  } catch (error) {
    console.error("❌ getTopSearchQueries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top searches"
    });
  }
};

/**
 * 🧠 ADMIN: GET SEARCH CORRECTIONS
 * Known typo → correction mappings
 */
export const getSearchCorrections = async (req, res) => {
  try {
    const corrections = await SearchCorrection.find({})
      .sort({ frequency: -1, updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: corrections
    });
  } catch (error) {
    console.error("❌ getSearchCorrections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch search corrections"
    });
  }
};

/**
 * 📉 ADMIN: FAILED SEARCH ACTIONS SUMMARY
 * What users did AFTER failed search
 */
export const getFailedSearchActionsSummary = async (req, res) => {
  try {
    const summary = await failedSearchAction.aggregate([
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error("❌ getFailedSearchActionsSummary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch failed search actions"
    });
  }
};

// searchAdminAnalytics.controller.js
export const getSearchSynonyms = async (req, res) => {
  const synonyms = await searchSynonym.find().sort({ updatedAt: -1 });
  res.json({ success: true, data: synonyms });
};

