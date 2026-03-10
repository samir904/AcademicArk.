// MIDDLEWARE/skipDevAnalytics.middleware.js
import mongoose from "mongoose";
import { EXCLUDED_ANALYTICS_USER_IDS } from "../CONSTANTS/analyticsConfig.js";

// ✅ Pre-build a Set of strings for O(1) lookup — no ObjectId comparison overhead
const EXCLUDED_IDS_SET = new Set(
  EXCLUDED_ANALYTICS_USER_IDS.map(id => id.toString())
);

/**
 * Drops the request silently for dev/admin users.
 * Client gets a 200/201 so UI behaves normally — no data written to DB.
 */
export const skipDevAnalytics = (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) return next();                          // unauthenticated — let it pass

  if (EXCLUDED_IDS_SET.has(userId.toString())) {
    // Mimic real responses so frontend doesn't break
    const method = req.method.toUpperCase();
    const status = method === 'POST' ? 201 : 200;
    return res.status(status).json({ success: true, _dev: true });
  }

  next();
};
