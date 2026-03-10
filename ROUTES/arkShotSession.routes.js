// ROUTES/arkShotSession.routes.js
import { Router } from "express";
import {
  startArkShotSession,
  endArkShotSession,
  getMySessionHistory,
  getAdminSessionAnalytics,
} from "../CONTROLLERS/arkShotSession.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import { updateSessionContext } from "../CONTROLLERS/arkShotSession.controller.js";

const router = Router();

// ── User session ──────────────────────────────────────────────────────────
router.post("/start",                isLoggedIn, startArkShotSession);
router.patch("/:sessionId/end",      isLoggedIn, endArkShotSession);
router.get("/my/history",            isLoggedIn, getMySessionHistory);
// ROUTES/arkShotSession.routes.js — ADD this
router.patch(
  "/:sessionId/context",
  isLoggedIn,
  updateSessionContext      // ✅ new controller
);

// ── Admin session analytics ───────────────────────────────────────────────
router.get(
  "/admin/analytics",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  getAdminSessionAnalytics
);

export default router;
