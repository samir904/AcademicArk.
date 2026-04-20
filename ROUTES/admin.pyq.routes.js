// ROUTES/admin.pyq.routes.js
import { Router } from "express";
import {
  // Subject meta
  createSubjectMeta,
  updateSubjectMeta,
  getSubjectMeta,
  getAllSubjectsMeta,

  // Paper upload
  uploadPaper,
  getPaperUploadStatus,
  getAllUploadLogs,

  // Unmapped queue
  getUnmappedQueue,
  resolveUnmappedQuestion,
  ignoreUnmappedQuestion,

  // Analytics
  triggerRecalculation,
  getAnalyticsStatus,

  // Insight cards
  getInsightsFeed,
  updateInsightCard,
  toggleCardLock,
  toggleCardVisibility,
  regenerateInsightCards,
  deleteInsightFeed,
} from "../CONTROLLERS/admin.pyq.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import { deletePaper } from "../CONTROLLERS/pyq.controller.js";

const router  = Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// ── RULE: ALL static routes BEFORE any /:id routes ───────────────

// ── Subject Meta ─────────────────────────────────────────────────
router.get   ("/subjects",               ...isAdmin, getAllSubjectsMeta);
router.post  ("/subjects",               ...isAdmin, createSubjectMeta);
router.get   ("/subjects/:subjectCode",  ...isAdmin, getSubjectMeta);
router.put   ("/subjects/:subjectCode",  ...isAdmin, updateSubjectMeta);

// ── Upload Logs ───────────────────────────────────────────────────
router.get("/upload-logs",               ...isAdmin, getAllUploadLogs);
router.get("/upload-logs/:subjectCode",  ...isAdmin, getPaperUploadStatus);

// ── Paper Delete ──────────────────────────────────────────────────
router.delete("/paper/:subjectCode/:year/:examType", ...isAdmin, deletePaper);

// ── Paper Upload (paste Claude JSON) ─────────────────────────────
router.post("/upload",                   ...isAdmin, uploadPaper);

// ── Unmapped Queue ────────────────────────────────────────────────
router.get  ("/unmapped/:subjectCode",   ...isAdmin, getUnmappedQueue);
router.patch("/unmapped/resolve",        ...isAdmin, resolveUnmappedQuestion);
router.patch("/unmapped/ignore",         ...isAdmin, ignoreUnmappedQuestion);

// ── Analytics Trigger ─────────────────────────────────────────────
router.get  ("/analytics-status",        ...isAdmin, getAnalyticsStatus);
router.post ("/recalculate/:subjectCode",...isAdmin, triggerRecalculation);

// ── Insight Cards ─────────────────────────────────────────────────
router.get  ("/insights/:subjectCode",               ...isAdmin, getInsightsFeed);
router.post ("/insights/:subjectCode/regenerate",    ...isAdmin, regenerateInsightCards);
router.patch("/insights/:subjectCode/cards/:cardId", ...isAdmin, updateInsightCard);
router.patch("/insights/:subjectCode/cards/:cardId/lock",    ...isAdmin, toggleCardLock);
router.patch("/insights/:subjectCode/cards/:cardId/visible", ...isAdmin, toggleCardVisibility);
// ✅ ADD THIS LINE
router.delete("/insights/:subjectCode/:unitId", ...isAdmin, deleteInsightFeed);
export default router;