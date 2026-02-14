import express from "express";

import { getAllPYQSources, getPYQSourceByNote, getPYQSourceBySubjectUnit, processSinglePYQController } from "../CONTROLLERS/pyqProcessing.controller.js";

// OPTIONAL: secure later
// import { isLoggedIn, authorizedRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * 📌 GET PYQ source mapping by noteId
 * Used to check:
 * - Has this PYQ already been processed?
 * - What topics were extracted?
 *
 * Example:
 * GET /api/exam/pyq-source/note/64fabc123
 */
router.get(
  "/note/:noteId",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getPYQSourceByNote
);

/**
 * POST /api/exam/pyq/process/:noteId
 */
router.post("/process/:noteId", processSinglePYQController);


/**
 * 📌 GET PYQ source mappings by subject + unit
 * Used for:
 * - Debugging
 * - Admin transparency
 *
 * Example:
 * GET /api/exam/pyq-source?subject=DAA&unit=2
 */
router.get(
  "/",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getPYQSourceBySubjectUnit
);

/**
 * 📌 GET all PYQ source mappings (ADMIN / DEBUG)
 * ⚠️ Should never be public
 *
 * Example:
 * GET /api/exam/pyq-source/all
 */
router.get(
  "/all",
  // isLoggedIn,
  // authorizedRoles("ADMIN"),
  getAllPYQSources
);

export default router;
