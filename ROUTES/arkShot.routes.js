// ROUTES/arkShot.routes.js
import { Router } from "express";
import {
  getFeed, getHomepageTeaser, getShotById,
  getCollections, getCollectionById,
  recordView, toggleLike, toggleMastered, toggleBookmark,
  startSession, endSession,
  getMyProgress, getMySavedShots, getMyMasteredShots,
  updateSessionContext,
  updateSessionMode,
  trackCollectionListView,
  trackCollectionOpen,
  recordScrollBehaviour,
  recordMicroFeedback,
  getCollectionsForNotes,
} from "../CONTROLLERS/arkShot.controller.js";
import { authorizedRoles, isLoggedIn, isLoggedInViaQuery, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import { skipDevAnalytics } from "../MIDDLEWARES/skipDevAnalytics.middleware.js";

const router = Router();
import { v4 as uuidv4 } from "uuid";
import { EXCLUDED_IDS_SET } from "../CONSTANTS/analyticsConfig.js";
import { getFeedbackAnalytics } from "../CONTROLLERS/feedbackAnalytics.controller.js";

// Custom skipper for startSession — must return a sessionId
const skipDevSession = (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) return next();

  if (EXCLUDED_IDS_SET.has(userId.toString())) {
    return res.status(201).json({
      success:   true,
      sessionId: uuidv4(),   // ✅ fake UUID — frontend stores it, subsequent
      _dev:      true,       //    write calls also get short-circuited anyway
    });
  }
  next();
};

router.use(optionalAuth);

// ════════════════════════════════════════════════════
// ✅ STATIC ROUTES FIRST
// ════════════════════════════════════════════════════
router.post('/feedback/micro', isLoggedIn, recordMicroFeedback);
router.get('/feedback/analytics', isLoggedIn, authorizedRoles('ADMIN'), getFeedbackAnalytics);

// ── Public ────────────────────────────────────────
router.get("/teaser",                    getHomepageTeaser);
router.get("/collections",               getCollections);
// ── ADD in the "STATIC ROUTES FIRST" section ─────────────────
// Must be before /collections/:id to avoid conflict
router.get(
  "/collections/for-notes",
  isLoggedIn,
  getCollectionsForNotes
);

// ── Feed (static) ─────────────────────────────────
router.get("/feed",                      isLoggedIn, getFeed);

// ── My Progress (static /my/*) ────────────────────
router.get("/my/progress",               isLoggedIn, getMyProgress);
router.get("/my/saved",                  isLoggedIn, getMySavedShots);
router.get("/my/mastered",               isLoggedIn, getMyMasteredShots);


// ── Session (static /session/*) ───────────────────
router.post("/session/start",            isLoggedIn,skipDevSession, startSession);
router.patch("/session/:sessionId/end",  isLoggedIn, skipDevAnalytics,endSession);
router.patch("/session/:sessionId/context",isLoggedIn,skipDevAnalytics, updateSessionContext); // ✅ NEW
router.patch("/session/:sessionId/mode",          isLoggedIn,skipDevAnalytics, updateSessionMode); // ✅ NEW

// ✅ NEW — flush scroll behaviour signals at session end
// Called once when user leaves, not per-card
// Body: { avgVelocityMs, avgPauseSeconds, totalHesitations, fastSwipeCount,
//         deepReadCount, avgReadDepthPercent }
router.patch(
  "/session/:sessionId/scroll-behaviour",
  isLoggedIn,skipDevAnalytics,
  recordScrollBehaviour
);

// ✅ ADD — beacon-specific route, auth via query param token
router.post("/session/:sessionId/end-beacon", isLoggedInViaQuery,skipDevAnalytics, endSession);


// ✅ ADD — must be BEFORE /collections/:id to avoid route conflict
router.post("/collections/track-list-view",         isLoggedIn, skipDevAnalytics,trackCollectionListView);
router.patch("/collections/:collectionId/track-open", isLoggedIn, skipDevAnalytics,trackCollectionOpen);
// ════════════════════════════════════════════════════
// ✅ DYNAMIC /:id ROUTES LAST
// ════════════════════════════════════════════════════
router.get("/collections/:id",          isLoggedIn, getCollectionById);
router.get("/:id",                       isLoggedIn, getShotById);

// ── Interactions ──────────────────────────────────
router.post("/:id/view",                 isLoggedIn, skipDevAnalytics,recordView);
router.post("/:id/like",                 isLoggedIn, skipDevAnalytics,toggleLike);
router.post("/:id/master",               isLoggedIn,skipDevAnalytics, toggleMastered);
router.post("/:id/bookmark",             isLoggedIn,skipDevAnalytics, toggleBookmark);

export default router;
