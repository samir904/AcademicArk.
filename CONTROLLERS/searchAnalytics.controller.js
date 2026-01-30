// CONTROLLERS/searchAnalytics.controller.js
import SearchAnalytics from "../MODELS/searchAnalytics.model.js";
import mongoose from "mongoose";

/**
 * 🔍 LOG SEARCH ANALYTICS
 * INTERNAL USE ONLY
 * Called asynchronously from search controller
 */
export const logSearchAnalytics = async (req, res) => {
  try {
    const {
      rawQuery,
      normalizedQuery,
      resultsCount = 0,
      intent = {}
    } = req.body;

    // 🛡️ Guard: ignore junk
    if (!rawQuery || rawQuery.trim().length < 2) {
      return res.status(200).json({ success: true });
    }

    const analytics = await SearchAnalytics.create({
      rawQuery,
      normalizedQuery,

      intent,

      resultsCount,
      isFailedSearch: resultsCount === 0,

      userId: req.user?.id || null,

      device: req.headers["user-agent"]?.includes("Mobile")
        ? "mobile"
        : "desktop",

      university: "AKTU",
      course: "BTECH"
    });

    // Analytics should NEVER block
    return res.status(200).json({ success: true,searchAnalyticsId: analytics._id });
  } catch (error) {
    // Silent fail
    console.error("⚠️ Search analytics log failed:", error.message);
    return res.status(200).json({ success: true });
  }
};

/**
 * 🕘 GET RECENT SEARCHES
 */
export const getRecentSearches = async (req, res) => {
  try {
    const userId = req.user?.id;

    // console.log("USER ID (string):", userId);

    if (!userId) {
      return res.status(200).json({
        success: true,
        searches: []
      });
    }

    // ✅ IMPORTANT FIX
    const objectUserId = new mongoose.Types.ObjectId(userId);

    const recent = await SearchAnalytics.aggregate([
      {
        $match: {
          userId: objectUserId, // ✅ ObjectId now
          rawQuery: { $exists: true, $ne: "" }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$normalizedQuery",
          rawQuery: { $first: "$rawQuery" },
          createdAt: { $first: "$createdAt" }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: 8
      }
    ]);

    // console.log("RECENT SEARCHES:", recent);

    return res.status(200).json({
      success: true,
      searches: recent.map(item => ({
        query: item.rawQuery,
        normalized: item._id
      }))
    });
  } catch (error) {
    console.error("⚠️ Recent search fetch failed:", error.message);
    return res.status(200).json({
      success: true,
      searches: []
    });
  }
};
