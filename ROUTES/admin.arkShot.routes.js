// ROUTES/admin.arkShot.routes.js
import { Router } from "express";
import {
  createShot, updateShot, deleteShot,
  publishShot, archiveShot, bulkPublish,
  getAllShots, getShotStats,
  createCollection, updateCollection, deleteCollection,
  getAnalytics, getShotAnalyticsById,
  getCollections,
  getSubjectsBySemester,
  getNotesByFilter,
  bulkUploadShots,
} from "../CONTROLLERS/adminArkShot.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import upload from "../MIDDLEWARES/multer.middleware.js";

const router  = Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// ── RULE: ALL static routes BEFORE any /:id routes ────────────────────────

// ── Meta (subjects dropdown) ──────────────────────────────────────────────
router.get("/meta/subjects",              getSubjectsBySemester);  // ← MOVED UP

// ── Notes search ──────────────────────────────────────────────────────────
router.get("/notes/search",              ...isAdmin, getNotesByFilter);

// ── Collections ───────────────────────────────────────────────────────────
router.get   ("/collections",            ...isAdmin, getCollections);
router.post  ("/collections",            ...isAdmin, upload.single("coverImage"), createCollection);  // ← multipart
router.put   ("/collections/:id",        ...isAdmin, upload.single("coverImage"), updateCollection);  // ← multipart
router.delete("/collections/:id",        ...isAdmin, deleteCollection);

// ── Analytics ─────────────────────────────────────────────────────────────
router.get("/analytics",                 ...isAdmin, getAnalytics);

// ── Bulk actions ──────────────────────────────────────────────────────────
router.patch("/bulk/publish",            ...isAdmin, bulkPublish);

// ── Base CRUD ─────────────────────────────────────────────────────────────
router.get  ("/",                        ...isAdmin, getAllShots);
router.post ("/",                        ...isAdmin, upload.single("diagram"), createShot);
// ── Add BEFORE /:id routes ─────────────────────────────────────────────────
router.post("/bulk/upload",   ...isAdmin, bulkUploadShots);   // ✅ JSON body — no multer
// ── /:id routes LAST ──────────────────────────────────────────────────────
router.get   ("/:id/analytics",          ...isAdmin, getShotAnalyticsById);
router.get   ("/:id/stats",              ...isAdmin, getShotStats);
router.patch ("/:id/publish",            ...isAdmin, publishShot);
router.patch ("/:id/archive",            ...isAdmin, archiveShot);
router.put   ("/:id",                    ...isAdmin, upload.single("diagram"), updateShot);
router.delete("/:id",                    ...isAdmin, deleteShot);

export default router;
