import express from "express";
import {
  getExamInsightBySubjectUnit,
  getExamInsightsBySubject,
  getAllExamInsights
} from "../CONTROLLERS/examInsight.controller.js";

// OPTIONAL security (enable later)
// import { isLoggedIn, optionalAuth, authorizedRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * 📌 GET exam insight for a specific subject + unit
 * Used by:
 * - Unit heatmap
 * - Exam Mode
 * - Note ranking logic
 *
 * Example:
 * GET /api/exam/insight?subject=DAA&unit=2
 */
router.get(
  "/",
  // optionalAuth,
  getExamInsightBySubjectUnit
);

/**
 * 📌 GET all exam insights for a subject
 * Used by:
 * - Subject overview heatmap
 * - Unit comparison UI
 *
 * Example:
 * GET /api/exam/insight/subject/DAA
 */
router.get(
  "/subject/:subject",
  // optionalAuth,
  getExamInsightsBySubject
);

/**
 * 📌 GET all exam insights (ADMIN / DEBUG)
 * ⚠️ Do not expose publicly in production
 *
 * Example:
 * GET /api/exam/insight/all
 */
router.get(
  "/all",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getAllExamInsights
);

export default router;
