import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn,  authorizedRoles, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

import {
  trackFilterEvent,
  markDownloadAfterFilter,
  checkPresetSuggestion,
  getFilterAnalyticsOverview,
  getAdminDashboard,
  getMostViewedNotes,
  getContentGaps,
  getSubjectPerformance,
  getDeviceAnalytics,
  getPeakUsageTimes,
  getPopularFilterCombinations
} from "../CONTROLLERS/filterAnalytics.controller.js";
import { getHybridFilters } from "../CONTROLLERS/filterAnalytics.controller.js";
import { getTrendingFiltersBySemester } from "../CONTROLLERS/filterAnalytics.controller.js";
import { getTopDownloadedNotes } from "../CONTROLLERS/filterAnalytics.controller.js";
import { getConversionFunnel } from "../CONTROLLERS/filterAnalytics.controller.js";
import { trackNoteView } from "../CONTROLLERS/filterAnalytics.controller.js";
import { markFilterSavedAsPreset } from "../CONTROLLERS/filterAnalytics.controller.js";
import { updateEngagementMetrics } from "../CONTROLLERS/filterAnalytics.controller.js";

const router = Router();

/**
 * 🔹 Track filter usage
 * Called whenever filters are applied
 */
router.post(
  "/track",
  optionalAuth,
  asyncWrap(trackFilterEvent)
);

/**
 * 🔹 Mark that a download happened after filtering
 * Called inside download controller
 */
router.post(
  "/mark-download",
  optionalAuth,
  asyncWrap(markDownloadAfterFilter)
);
router.post(
    '/track-view',
    optionalAuth,
    asyncWrap(trackNoteView)
)
/**
 * 🔹 Update engagement metrics (scroll depth, time on results)
 */
router.post(
  "/update-engagement",
  optionalAuth,
  asyncWrap(updateEngagementMetrics)
);

/**
 * 🔹 Mark that filter was saved as preset
 */
router.post(
  "/mark-saved-preset",
  optionalAuth,
  asyncWrap(markFilterSavedAsPreset)
);


/**
 * 🔹 Check if preset suggestion should be shown
 * Triggered after tracking filter
 */
router.get(
  "/suggest",
  isLoggedIn,
  asyncWrap(checkPresetSuggestion)
);

router.get(
  "/trending",
  isLoggedIn,
  asyncWrap(getTrendingFiltersBySemester)
);
router.get(
  "/hybrid",
  isLoggedIn,
  asyncWrap(getHybridFilters)
);

/**
 * 🔹 Admin analytics overview
 */
router.get(
  "/admin/overview",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  asyncWrap(getFilterAnalyticsOverview)
);
router.use(isLoggedIn,authorizedRoles('ADMIN'));
router.get(
    '/admin/top-download',
    asyncWrap(getTopDownloadedNotes)
)
router.get(
    '/admin/conversion-funnel',
    asyncWrap(getConversionFunnel)
)
// Admin-only routes
router.get('/admin/dashboard',  getAdminDashboard);
router.get('/admin/most-viewed',  getMostViewedNotes);
router.get('/admin/content-gaps',  getContentGaps);
router.get('/admin/subject-performance', getSubjectPerformance);
router.get('/admin/device-analytics',  getDeviceAnalytics);
router.get('/admin/peak-usage',  getPeakUsageTimes);
router.get('/admin/filter-combinations',  getPopularFilterCombinations);
export default router;
