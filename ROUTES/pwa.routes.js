// ROUTES/pwa.routes.js
import express from "express";
import {
  recordPromptShown,
  recordPromptAction,
  recordInstall,
  recordSession,
  getInstallStats,
  checkShouldPrompt,
  recordPageView,
  getAdminUsersList,
  getAdminUserPWAProfile,
  getUserPWAProfile,
} from "../CONTROLLERS/pwa.controller.js";
import {  optionalAuth, isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";

const router = express.Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// ── Public / Optional Auth ─────────────────────────────────────────
router.post("/prompt/shown",   optionalAuth, recordPromptShown);   // modal became visible
router.post("/prompt/action",  optionalAuth, recordPromptAction);  // installed / dismissed / ignored
router.post("/install",        optionalAuth, recordInstall);       // browser appinstalled event
router.post("/session",        optionalAuth, recordSession);       // session start ping
router.post("/pageview",      optionalAuth, recordPageView);    // ✅ ADD
// ── Needs auth ─────────────────────────────────────────────────────
router.get("/should-prompt",   optionalAuth, checkShouldPrompt);   // should we show modal?

// ── Logged-in user sees their own data ────────────────────────────
router.get("/me",             isLoggedIn,   getUserPWAProfile);   // ✅ own profile

// ── Admin only ─────────────────────────────────────────────────────
router.get("/stats",           ...isAdmin, getInstallStats);
router.get("/admin/users",         ...isAdmin, getAdminUsersList);          // ✅ paginated list
router.get("/admin/user/:userId",  ...isAdmin, getAdminUserPWAProfile);     // ✅ single user
export default router;
