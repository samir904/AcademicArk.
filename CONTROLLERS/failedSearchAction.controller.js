import FailedSearchAction from "../MODELS/failedSearchAction.model.js";

/**
 * 📉 LOG WHAT USER DID AFTER FAILED SEARCH
 * This must NEVER break user flow
 */
export const logFailedSearchAction = async (req, res) => {
  try {
    const {
      searchAnalyticsId,
      action,
      value = null
    } = req.body;

    // 🛑 Guard rails
    if (!searchAnalyticsId || !action) {
      return res.status(200).json({ success: true });
    }

    await FailedSearchAction.create({
      searchAnalyticsId,
      action,
      value,
      userId: req.user?.id || null
    });

    // Always succeed (analytics must be silent)
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("⚠️ FailedSearchAction log error:", error.message);
    res.status(200).json({ success: true });
  }
};
