// ROUTES/pyq.routes.js
import { Router } from "express";
import {
  getSubjectAnalytics,
  getUnitAnalytics,
  getUnitQuestions,
  getTopicQuestions,
  getYearMatrix,
  getInsightCards,
  getAllSubjects,
  getSubjectBrief,
  getSubjectSyllabus,
  getUnitBrief,
} from "../CONTROLLERS/pyq.controller.js";
import { isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";

const router = Router();

// ── All routes require login ──────────────────────────────────────

// ── Subjects list (for subject picker UI)
router.get("/subjects",                        isLoggedIn, getAllSubjects);
// ROUTES/pyq.routes.js — ADD THIS
router.get("/subject-brief", isLoggedIn, getSubjectBrief);
// GET /api/pyq/unit-brief?subjectCode=CS-401&unitId=OS-U2
router.get("/unit-brief", isLoggedIn, getUnitBrief);
// ROUTES/pyq.routes.js — add this
router.get("/syllabus", isLoggedIn, getSubjectSyllabus);

// ── Subject-level analytics (overview dashboard)
router.get("/:subjectCode/analytics",          isLoggedIn, getSubjectAnalytics);

// ── Unit-level analytics (unit deep dive)
router.get("/:subjectCode/units/:unitId",      isLoggedIn, getUnitAnalytics);

// ── All questions for a unit across years (grouped by topic)
// Query params: ?markType=SEVEN&year=2025&isRepeat=true&topicId=CN-U3-TCP
router.get("/:subjectCode/units/:unitId/questions", isLoggedIn, getUnitQuestions);

// ── All questions for a specific topic across years
router.get("/:subjectCode/topics/:topicId/questions", isLoggedIn, getTopicQuestions);

// ── Year comparison heatmap matrix
router.get("/:subjectCode/units/:unitId/matrix", isLoggedIn, getYearMatrix);

// ── Insight cards (with paywall enforcement)
// Query params: ?unitId=CN-U3
router.get("/:subjectCode/insights",           isLoggedIn, getInsightCards);

export default router;