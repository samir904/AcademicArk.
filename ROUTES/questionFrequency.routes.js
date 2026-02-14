import express from "express";
import {
  getFrequencyBySubjectUnit,
  getFrequencyBySubject,
  getAllFrequencies
} from "../CONTROLLERS/questionFrequency.controller.js";

// OPTIONAL: add admin middleware later
// import { isLoggedIn, authorizedRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * 📌 GET frequency for a specific subject + unit
 * Used by: ExamInsight builder, Debug UI
 *
 * Example:
 * GET /api/exam/frequency?subject=DAA&unit=2
 */
router.get(
  "/",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getFrequencyBySubjectUnit
);

/**
 * 📌 GET all frequency data for a subject
 * Used by: Heatmap, Analytics
 *
 * Example:
 * GET /api/exam/frequency/subject/DAA
 */
router.get(
  "/subject/:subject",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getFrequencyBySubject
);

/**
 * 📌 GET all frequency records (ADMIN / DEBUG)
 * ⚠️ Should NOT be exposed publicly in future
 *
 * Example:
 * GET /api/exam/frequency/all
 */
router.get(
  "/all",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getAllFrequencies
);

export default router;
