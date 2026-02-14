// routes/analytics.routes.js

import express from "express";

// Controllers
import {
  // Overview
  getAnalyticsOverview,

  // Traffic
  getTrafficSources,
  getDeviceStats,
  getBrowserStats,
  getOSStats,
  getLocationStats,

  // Engagement
  getPageEngagement,
  getScrollStats,
  getTimeStats,
  getExitPages,

  // Content
  getTopNotes,
  getSearchTerms,
  getFailedSearches,

  // Funnels
  getPreviewToDownloadFunnel,
  getPaywallFunnel,
  getSupportFunnel,

  // Sessions
  getSessions,
  getSessionDetails

} from "../controllers/analytics.controller.js";

// Auth Middlewares
import { isLoggedIn, authorizedRoles} from '../MIDDLEWARES/auth.middleware.js'

const router = express.Router();

/**
 * ===============================
 * Admin Protection Middleware
 * ===============================
 */
const admin = [isLoggedIn, authorizedRoles("ADMIN")];

/**
 * ===============================
 * OVERVIEW (Top Dashboard KPIs)
 * ===============================
 */
router.get("/overview", admin, getAnalyticsOverview);


/**
 * ===============================
 * TRAFFIC INSIGHTS
 * ===============================
 */
router.get("/traffic/sources", admin, getTrafficSources);
router.get("/traffic/devices", admin, getDeviceStats);
router.get("/traffic/browsers", admin, getBrowserStats);
router.get("/traffic/os", admin, getOSStats);
router.get("/traffic/locations", admin, getLocationStats);


/**
 * ===============================
 * ENGAGEMENT INSIGHTS
 * ===============================
 */
router.get("/engagement/pages", admin, getPageEngagement);
router.get("/engagement/scroll", admin, getScrollStats);
router.get("/engagement/time", admin, getTimeStats);
router.get("/engagement/exit-pages", admin, getExitPages);


/**
 * ===============================
 * CONTENT PERFORMANCE
 * ===============================
 */
router.get("/content/top-notes", admin, getTopNotes);
router.get("/content/search-terms", admin, getSearchTerms);
router.get("/content/failed-search", admin, getFailedSearches);


/**
 * ===============================
 * FUNNEL ANALYSIS
 * ===============================
 */
router.get("/funnels/preview-to-download", admin, getPreviewToDownloadFunnel);
router.get("/funnels/paywall", admin, getPaywallFunnel);
router.get("/funnels/support", admin, getSupportFunnel);


/**
 * ===============================
 * SESSION EXPLORER
 * ===============================
 */
router.get("/sessions", admin, getSessions);
router.get("/sessions/:id", admin, getSessionDetails);


export default router;
