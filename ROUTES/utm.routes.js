import { Router } from "express";
import {
  trackEvent,
  trackPixel,
  getCampaignBySlug,
} from "../CONTROLLERS/utm.controller.js";
import { optionalAuth }      from "../MIDDLEWARES/auth.middleware.js";
import {
  utmTrackLimiter,
  utmPixelLimiter,
} from "../MIDDLEWARES/utmRateLimit.middleware.js";

const router = Router();

router.use(optionalAuth);

// ── Pixel ─────────────────────────────────────────────────
router.get("/pixel/:campaignId", utmPixelLimiter, trackPixel);

// ── Event tracking ────────────────────────────────────────
router.post("/track", utmTrackLimiter, trackEvent);

// ── Campaign lookup ───────────────────────────────────────
router.get("/c/:slug", getCampaignBySlug);

export default router;
