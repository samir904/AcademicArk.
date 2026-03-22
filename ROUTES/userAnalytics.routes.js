// src/ROUTES/userAnalytics.routes.js
import { Router } from "express";
import {
  // ── Acquisition ──────────────────────────────
  getMonthlyAcquisition,
  getYearlyAcquisition,
  getDailyAcquisition,
  getAcquisitionByAuthProvider,

  // ── Engagement ───────────────────────────────
  getDailyActiveUsers,
  getWeeklyActiveUsers,
  getMonthlyActiveUsers,
  getReturningUsers,
  getChurnedUsers,
  getHomepageVisitTrend,

  // ── Study Behaviour ──────────────────────────
  getStudyStreakDistribution,
  getStudyTimeDistribution,
  getPlannerAdoptionStats,
  getTopStudyUsers,

  // ── Profile Health ───────────────────────────
  getProfileCompletionFunnel,
  getSocialLinkAdoption,
  getBioAdoptionStats,
  getPublicVsPrivateProfiles,

 

  // ── Paywall / Access ─────────────────────────
  getPaidVsFreeRatio,
  getPlanDistribution,
  getDailyDownloadStats,
  getExpiringSubscriptions,

  // ── Roles ────────────────────────────────────
  getRoleDistribution,
  
  // ── Cohort ───────────────────────────────────
  getCohortRetention,
  getSignupToFirstAction,

  // ── Overview ─────────────────────────────────
  getUserAnalyticsOverview,
} from "../CONTROLLERS/userAnalytics.controller.js";

import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

const router   = Router();
const isAdmin  = [isLoggedIn, authorizedRoles("ADMIN")];

// ══════════════════════════════════════════════════════════
// 📊 OVERVIEW — single endpoint that returns everything
// ══════════════════════════════════════════════════════════
router.get("/overview", ...isAdmin, getUserAnalyticsOverview);

// ══════════════════════════════════════════════════════════
// 📅 ACQUISITION
// Source field: createdAt
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/acquisition/monthly
// Query: ?year=2025  →  12 data points
router.get("/acquisition/monthly",       ...isAdmin, getMonthlyAcquisition);

// GET /api/v1/user-analytics/acquisition/yearly
// Query: ?from=2023&to=2026  →  per-year totals
router.get("/acquisition/yearly",        ...isAdmin, getYearlyAcquisition);

// GET /api/v1/user-analytics/acquisition/daily
// Query: ?days=30  →  last N days
router.get("/acquisition/daily",         ...isAdmin, getDailyAcquisition);

// GET /api/v1/user-analytics/acquisition/auth-provider
// Returns: { email: 820, google: 210, github: 30 }
router.get("/acquisition/auth-provider", ...isAdmin, getAcquisitionByAuthProvider);

// ══════════════════════════════════════════════════════════
// 🔥 ENGAGEMENT
// Source fields: lastHomepageVisit, lastStudyDate
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/engagement/dau
// Query: ?days=30  →  daily active users last N days
// "Active" = lastHomepageVisit within that day
router.get("/engagement/dau",             ...isAdmin, getDailyActiveUsers);

// GET /api/v1/user-analytics/engagement/wau
// Query: ?weeks=8  →  weekly active users
router.get("/engagement/wau",             ...isAdmin, getWeeklyActiveUsers);

// GET /api/v1/user-analytics/engagement/mau
// Query: ?months=6  →  monthly active users
router.get("/engagement/mau",             ...isAdmin, getMonthlyActiveUsers);

// GET /api/v1/user-analytics/engagement/returning
// Returns users who visited homepage AFTER signup day
// Query: ?days=30  →  within last 30 days
router.get("/engagement/returning",       ...isAdmin, getReturningUsers);

// GET /api/v1/user-analytics/engagement/churned
// Users who haven't visited homepage in >N days
// Query: ?inactiveDays=30  (default: 30)
router.get("/engagement/churned",         ...isAdmin, getChurnedUsers);

// GET /api/v1/user-analytics/engagement/homepage-trend
// lastHomepageVisit grouped by day
// Query: ?days=30
router.get("/engagement/homepage-trend",  ...isAdmin, getHomepageVisitTrend);

// ══════════════════════════════════════════════════════════
// 📚 STUDY BEHAVIOUR
// Source: totalStudyTimeMinutes, studyStreak, lastStudyDate,
//         plannerSetup
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/study/streak-distribution
// Returns: { 0: 400, 1-3: 120, 4-7: 80, 8-14: 40, 15+: 20 }
router.get("/study/streak-distribution",  ...isAdmin, getStudyStreakDistribution);

// GET /api/v1/user-analytics/study/time-distribution
// Buckets: 0, 1-60, 61-300, 301-600, 600+ minutes
router.get("/study/time-distribution",    ...isAdmin, getStudyTimeDistribution);

// GET /api/v1/user-analytics/study/planner-adoption
// plannerSetup.isCompleted true/false + completedAt trend
router.get("/study/planner-adoption",     ...isAdmin, getPlannerAdoptionStats);

// GET /api/v1/user-analytics/study/top-users
// Query: ?limit=20  →  ranked by totalStudyTimeMinutes
router.get("/study/top-users",            ...isAdmin, getTopStudyUsers);

// ══════════════════════════════════════════════════════════
// 👤 PROFILE HEALTH
// Source: bio, socialLinks, isProfilePublic,
//         academicProfile.isCompleted
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/profile/completion-funnel
// Step breakdown:
//   Total → Has Avatar → Has Bio → Has Academic Profile
//   → Has Social Link → Full Profile
router.get("/profile/completion-funnel",  ...isAdmin, getProfileCompletionFunnel);

// GET /api/v1/user-analytics/profile/social-links
// Returns: { github: 210, linkedin: 180, twitter: 95, website: 60 }
router.get("/profile/social-links",       ...isAdmin, getSocialLinkAdoption);

// GET /api/v1/user-analytics/profile/bio-adoption
// { hasBio: 340, noBio: 720 }
router.get("/profile/bio-adoption",       ...isAdmin, getBioAdoptionStats);

// GET /api/v1/user-analytics/profile/visibility
// { public: 900, private: 160 }
router.get("/profile/visibility",         ...isAdmin, getPublicVsPrivateProfiles);

// ══════════════════════════════════════════════════════════
// 💳 PAYWALL / ACCESS
// Source: access.plan, access.expiresAt,
//         access.downloadsToday, access.dailyDownloadLimit
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/access/paid-vs-free
// { free: 820, paid: 240, expired: 50 }
router.get("/access/paid-vs-free",        ...isAdmin, getPaidVsFreeRatio);

// GET /api/v1/user-analytics/access/plan-distribution
// Breakdown by plan name + count
router.get("/access/plan-distribution",   ...isAdmin, getPlanDistribution);

// GET /api/v1/user-analytics/access/download-stats
// Query: ?days=7  →  daily downloadsToday totals
router.get("/access/download-stats",      ...isAdmin, getDailyDownloadStats);

// GET /api/v1/user-analytics/access/expiring
// Query: ?withinDays=7  →  subscriptions expiring soon
router.get("/access/expiring",            ...isAdmin, getExpiringSubscriptions);

// ══════════════════════════════════════════════════════════
// 🔐 ROLES
// Source: role, excludeFromLeaderboard
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/roles/distribution
// { USER: 980, TEACHER: 70, ADMIN: 10 }
router.get("/roles/distribution",         ...isAdmin, getRoleDistribution);

// ══════════════════════════════════════════════════════════
// 🔄 COHORT ANALYTICS
// Source: createdAt, lastHomepageVisit, lastStudyDate
// ══════════════════════════════════════════════════════════

// GET /api/v1/user-analytics/cohort/retention
// Query: ?months=6  →  cohort retention table
// Row = signup month, Cols = Week 1 / Week 2 / Month 1 / Month 2
router.get("/cohort/retention",           ...isAdmin, getCohortRetention);

// GET /api/v1/user-analytics/cohort/signup-to-first-action
// How many hours/days from signup → first homepage visit / first download
// Buckets: same day, 1-3d, 4-7d, 1-2w, 2w+, never
router.get("/cohort/signup-to-first-action", ...isAdmin, getSignupToFirstAction);

export default router;
