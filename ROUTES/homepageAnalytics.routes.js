import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

import {
  logHomepageEvent,
  getHomepageAnalytics,
  getHomepageCTRBySection,
  getHomepageTopCards,
  getHomepageDeviceBreakdown,
  getHomepageDailyTrend,
  getHomepageSectionDropoff,
  generateDailySnapshot,
  getHomepagePeakTimes,
  getCTABreakdown,
} from "../CONTROLLERS/homepageAnalytics.controller.js";

const router = Router();

// ============================================
// 📥 FRONTEND → BACKEND (logged-in users)
// ============================================

/**
 * Log impression + click events (batched)
 * POST /api/v1/home/analytics/event
 * Body: { events: [...] }
 */
router.post(
  "/event",
  isLoggedIn,
  asyncWrap(logHomepageEvent)
);

// ============================================
// 🔐 ADMIN ONLY — apply auth to all below
// ============================================
router.use(isLoggedIn, authorizedRoles("ADMIN"));

/**
 * Overall CTR summary
 * GET /api/v1/home/analytics/overview?days=7
 * Returns: totalImpressions, totalClicks, overallCTR, uniqueVisitors
 */
router.get(
  "/overview",
  asyncWrap(getHomepageAnalytics)
);

/**
 * Per-section CTR breakdown
 * GET /api/v1/home/analytics/sections?days=7
 * Returns: section name, impressions, clicks, CTR — sorted by CTR
 */
router.get(
  "/sections",
  asyncWrap(getHomepageCTRBySection)
);
/**
 * CTA / Button click breakdown
 * GET /api/v1/home/analytics/cta-breakdown?days=7
 * Returns: which buttons clicked most, per section + overall
 */
router.get(
  "/cta-breakdown",
  asyncWrap(getCTABreakdown)
);
/**
 * Top clicked cards across all sections
 * GET /api/v1/home/analytics/top-cards?days=7&limit=10
 * Returns: note title, section, click count, rank
 */
router.get(
  "/top-cards",
  asyncWrap(getHomepageTopCards)
);
/**
 * Peak active hours + weekday pattern
 * GET /api/v1/home/analytics/peak-times?days=14
 * Returns: hourly[], weekdays[], peakHour, peakSlot, insight
 */
router.get(
  "/peak-times",
  asyncWrap(getHomepagePeakTimes)
);

/**
 * Device breakdown (mobile vs desktop vs tablet)
 * GET /api/v1/home/analytics/devices?days=7
 * Returns: mobile%, desktop%, tablet% + counts
 */
router.get(
  "/devices",
  asyncWrap(getHomepageDeviceBreakdown)
);

/**
 * Daily CTR trend — for line chart on admin dashboard
 * GET /api/v1/home/analytics/trend?days=30
 * Returns: array of { date, impressions, clicks, ctr }
 */
router.get(
  "/trend",
  asyncWrap(getHomepageDailyTrend)
);

/**
 * Section scroll dropoff — how far users scroll
 * GET /api/v1/home/analytics/dropoff?days=7
 * Returns: ordered sections with impression dropoff %
 * Shows: greeting=100%, continue=89%, recommended=61%, leaderboard=12%
 */
router.get(
  "/dropoff",
  asyncWrap(getHomepageSectionDropoff)
);

/**
 * Manually trigger snapshot generation (for testing)
 * POST /api/v1/home/analytics/generate-snapshot
 */
router.post(
  "/generate-snapshot",
  asyncWrap(async (req, res) => {
    await generateDailySnapshot();
    res.status(200).json({ success: true, message: "Snapshot generated" });
  })
);

export default router;
