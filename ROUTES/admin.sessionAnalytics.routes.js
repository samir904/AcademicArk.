// ROUTES/admin.sessionAnalytics.routes.js
import { Router } from "express";
import {
  getSessionOverview,
  getSessionTimeline,
  getEngagementAnalytics,
  getBehaviourAnalytics,
  getViewModeAnalytics,
  getABTestAnalytics,
  getEntrySourceAnalytics,
  getTopShotsAnalytics,
  getDropOffAnalytics,
  getDeviceAnalytics,
} from "../CONTROLLERS/sessionAnalytics.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

const router  = Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// All accept ?days=30 query param unless noted

// ── Overview KPIs ─────────────────────────────────────────────────────────
router.get("/overview",       ...isAdmin, getSessionOverview);

// ── Daily volume + duration trend ─────────────────────────────────────────
router.get("/timeline",       ...isAdmin, getSessionTimeline);

// ── Per-shot engagement (pause, read depth, hesitation) ───────────────────
router.get("/engagement",     ...isAdmin, getEngagementAnalytics);

// ── Scroll behaviour (velocity, fast-swipes, deep reads) ──────────────────
router.get("/behaviour",      ...isAdmin, getBehaviourAnalytics);

// ── Snap vs List mode breakdown ───────────────────────────────────────────
router.get("/viewmode",       ...isAdmin, getViewModeAnalytics);

// ── A/B test results ──────────────────────────────────────────────────────
router.get("/abtest",         ...isAdmin, getABTestAnalytics);

// ── Entry source funnel ───────────────────────────────────────────────────
router.get("/entrysource",    ...isAdmin, getEntrySourceAnalytics);

// ── Top shots by time-spent / engagement ──────────────────────────────────
router.get("/topshots",       ...isAdmin, getTopShotsAnalytics);

// ── Drop-off reasons + patterns ───────────────────────────────────────────
router.get("/dropoff",        ...isAdmin, getDropOffAnalytics);

// ── Device breakdown ──────────────────────────────────────────────────────
router.get("/device",         ...isAdmin, getDeviceAnalytics);

export default router;