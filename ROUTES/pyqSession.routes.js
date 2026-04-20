import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

import {
  startPYQSession,
  trackPYQInteraction,
  endPYQSession,
  getPYQSourceBreakdown,
  getPYQSessionStats,
  getPYQConversionStats,
  getPYQEngagementByNote,
} from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQEngagementDepth } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQInteractionHeatmap } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQUserBehavior } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQUnitPopularity } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQFunnelAnalysis } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQRetentionBySubject } from "../CONTROLLERS/pyqSession.controller.js";
import { getSyllabusFunnelAnalysis } from "../CONTROLLERS/pyqSession.controller.js";
import { getSyllabusUnitPopularity } from "../CONTROLLERS/pyqSession.controller.js";
import { getPYQDailyTrend } from "../CONTROLLERS/pyqSession.controller.js";
import { skipDevAnalytics } from "../MIDDLEWARES/skipDevAnalytics.middleware.js";

const router = Router();

// ── Student / Client routes (fire-and-forget) ─────────────────────

// Start a new PYQ or Syllabus session (sheet open / page enter)
router.post("/start",       optionalAuth, skipDevAnalytics,asyncWrap(startPYQSession));

// Track an interaction event inside an active session
router.post("/:sessionId/event", optionalAuth, skipDevAnalytics,asyncWrap(trackPYQInteraction));

// End a session (sheet close / page unmount)
router.post("/:sessionId/end",   optionalAuth,skipDevAnalytics, asyncWrap(endPYQSession));

// ── Admin analytics routes ─────────────────────────────────────────
router.use(isLoggedIn);
router.use(authorizedRoles("ADMIN"));
// Which entry sources drive most opens?
router.get("/admin/sources",     asyncWrap(getPYQSourceBreakdown));

// General session stats (avg duration, interactions, conversion rate)
router.get("/admin/stats",       asyncWrap(getPYQSessionStats));

// Sheet → full page conversion breakdown
router.get("/admin/conversions", asyncWrap(getPYQConversionStats));

// Which notes trigger most PYQ/Syllabus exploration?
router.get("/admin/by-note",     asyncWrap(getPYQEngagementByNote));
// ── New Admin Analytics Routes ─────────────────────────────────────
router.get("/admin/engagement-depth",   asyncWrap(getPYQEngagementDepth));
router.get("/admin/interaction-heatmap", asyncWrap(getPYQInteractionHeatmap));
router.get("/admin/user-behavior",      asyncWrap(getPYQUserBehavior));
router.get("/admin/unit-popularity",    asyncWrap(getPYQUnitPopularity));
router.get("/admin/syllabus-unit-popularity", asyncWrap(getSyllabusUnitPopularity));
router.get("/admin/funnel",             asyncWrap(getPYQFunnelAnalysis));
router.get("/admin/syllabus-funnel", asyncWrap(getSyllabusFunnelAnalysis));
router.get("/admin/retention",          asyncWrap(getPYQRetentionBySubject));
router.get("/admin/daily-trend", asyncWrap(getPYQDailyTrend));
export default router;