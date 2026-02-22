// CONSTANTS/analyticsConfig.js
import mongoose from "mongoose";

// ✅ Developer / tester IDs — excluded from all homepage analytics
export const EXCLUDED_ANALYTICS_USER_IDS = [
  "689a32f44e5a37ebf499c13a",
  "689a3a547090deaab4194f84",
  "689ca5ea039ecc341b1ab1f9",
].map((id) => new mongoose.Types.ObjectId(id));

// ✅ Ready-to-use $match filter — drop into any aggregate
export const EXCLUDE_DEV_USERS_FILTER = {
  userId: { $nin: EXCLUDED_ANALYTICS_USER_IDS },
};
