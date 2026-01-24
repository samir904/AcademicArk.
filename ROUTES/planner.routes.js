import { Router } from "express";
import {
  saveStudyPreferences,
  getTodayPlan,
  getStudyStats,
  updateProgress,
  getPreferences,
  getAllProgress,
  updateStudyPreferences,
  getPlannerNotes,
  getSubjectSuggestions
} from "../CONTROLLERS/planner.controller.js";
import { isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import asyncWrap from "../UTIL/asyncWrap.js";

const router = Router();

router.get(
  "/subjects",
  asyncWrap(optionalAuth),
  asyncWrap(getSubjectSuggestions)
);
// Apply auth middleware to all routes
router.use(isLoggedIn);

// Preferences
router.post("/preferences", saveStudyPreferences);
router.get("/preferences", getPreferences);
//one more to update there study prefernce ok r
// ✅ ADD THIS
router.patch("/preferences", updateStudyPreferences);
// Today's plan
router.get("/today", getTodayPlan);

// Progress
router.patch("/progress", updateProgress);
router.get("/progress", getAllProgress);

// Statistics
router.get("/stats", getStudyStats);

// get notes for today planner
router.get('/notes',getPlannerNotes)

export default router;
