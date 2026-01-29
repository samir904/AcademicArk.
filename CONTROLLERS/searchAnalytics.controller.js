// CONTROLLERS/searchAnalytics.controller.js
import SearchAnalytics from "../MODELS/searchAnalytics.model.js";

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
