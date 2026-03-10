import { Router } from "express";
import {
  // Campaign CRUD
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaignStatus,

  // Thumbnail
  uploadThumbnail,
  deleteThumbnail,

  // Analytics
  getCampaignAnalytics,
  getCampaignEventBreakdown,
  getABTestResults,

  // Email
  sendEmailCampaign,
  getEmailStats,
} from "../CONTROLLERS/admin.utm.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import upload from "../MIDDLEWARES/multer.middleware.js";
import { generateThumbnailPreview } from "../CONTROLLERS/admin.utm.controller.js";

const router  = Router();
const isAdmin = [isLoggedIn, authorizedRoles("ADMIN")];

// ── RULE: ALL static routes BEFORE /:id routes ────────────

// ── List all campaigns ────────────────────────────────────
router.get("/", ...isAdmin, getAllCampaigns);

// ── Create campaign ───────────────────────────────────────
router.post(
  "/",
  ...isAdmin,
  upload.single("thumbnail"),   // optional — canvas-generated thumbnail
  createCampaign
);

// ── Email blast ───────────────────────────────────────────
router.post("/email/send",        ...isAdmin, sendEmailCampaign);
router.get ("/email/stats",       ...isAdmin, getEmailStats);

// ── /:id routes LAST ──────────────────────────────────────
router.get   ("/:id",                   ...isAdmin, getCampaignById);
router.put   ("/:id",                   ...isAdmin, upload.single("thumbnail"), updateCampaign);
router.delete("/:id",                   ...isAdmin, deleteCampaign);

// Status toggle — active / paused / archived
router.patch ("/:id/status",            ...isAdmin, updateCampaignStatus);

// Thumbnail — generate server-side previews (Satori + Sharp)
router.get  ("/:id/thumbnail/generate",  ...isAdmin, generateThumbnailPreview);

// Thumbnail — upload selected variant to Cloudinary
router.post  ("/:id/thumbnail",         ...isAdmin, upload.single("thumbnail"), uploadThumbnail);
router.delete("/:id/thumbnail",         ...isAdmin, deleteThumbnail);

// Analytics
router.get   ("/:id/analytics",         ...isAdmin, getCampaignAnalytics);
router.get   ("/:id/events",            ...isAdmin, getCampaignEventBreakdown);
router.get   ("/:id/ab-test",           ...isAdmin, getABTestResults);

export default router;
