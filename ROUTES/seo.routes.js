import express from "express";
import {
  getSeoPageBySlug,
  getAllSeoPages,
  trackSeoPageClick
} from "../controllers/seo.controller.js";
import {
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
  getSeoPageById,
  getAllSeoPagesAdmin,
  previewSeoPage,
  bulkUpdateStatus
} from "../CONTROLLERS/seoAdmin.controller.js";
import { authorizedRoles, isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";

const router = express.Router();

// ========================================
// 🔥 ADMIN ROUTES (Protected)
// ========================================
router.post(
  "/admin/create",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  createSeoPage
);

router.put(
  "/admin/update/:id",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  updateSeoPage
);

router.delete(
  "/admin/delete/:id",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  deleteSeoPage
);

router.get(
  "/admin/page/:id",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  getSeoPageById
);

router.get(
  "/admin/all",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  getAllSeoPagesAdmin
);

router.post(
  "/admin/preview",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  previewSeoPage
);

router.post(
  "/admin/bulk-status",
  isLoggedIn,
  authorizedRoles("ADMIN"),
  bulkUpdateStatus
);

// ========================================
// 🌐 PUBLIC ROUTES
// ========================================

// Get all SEO pages (for sitemap)
router.get("/pages", getAllSeoPages);

// Track click (analytics)
router.post("/track/:slug", trackSeoPageClick);

// Dynamic SEO page by slug (MUST BE LAST)
router.get("/:slug", getSeoPageBySlug);

export default router;
