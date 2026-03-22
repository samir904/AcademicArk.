// BACKEND/ROUTES/clientError.routes.js
import { Router } from "express";
import {
  // Public — frontend posts errors here (no auth required)
  trackClientError,

  // Admin — view + manage errors
  getAllClientErrors,
  getClientErrorById,
  getClientErrorStats,
  getTopErrors,
  updateErrorStatus,
  deleteClientError,
  bulkUpdateStatus,
  deleteResolved,
} from "../CONTROLLERS/clientError.controller.js";

import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

const router = Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// ══════════════════════════════════════════════
// PUBLIC — frontend reports errors here
// No auth — a crash may happen before auth loads
// Rate-limited in controller to prevent abuse
// ══════════════════════════════════════════════
router.post("/track", trackClientError);

// ══════════════════════════════════════════════
// ADMIN — all management routes
// STATIC routes BEFORE /:id (your existing pattern)
// ══════════════════════════════════════════════

// ── Aggregate stats (for dashboard panel) ────
router.get("/stats",     ...isAdmin, getClientErrorStats);

// ── Top errors by frequency (fingerprint) ────
router.get("/top",       ...isAdmin, getTopErrors);

// ── Bulk actions ──────────────────────────────
router.patch("/bulk",    ...isAdmin, bulkUpdateStatus);

// ── Cleanup — delete all resolved ────────────
router.delete("/resolved", ...isAdmin, deleteResolved);

// ── List all errors (paginated + filtered) ───
router.get("/",          ...isAdmin, getAllClientErrors);

// ══════════════════════════════════════════════
// /:id routes LAST — your existing pattern
// ══════════════════════════════════════════════
router.get   ("/:id",        ...isAdmin, getClientErrorById);
router.patch ("/:id/status", ...isAdmin, updateErrorStatus);
router.delete("/:id",        ...isAdmin, deleteClientError);

export default router;
