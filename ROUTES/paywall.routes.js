import express from "express";
import { trackPaywallEvent } from "../CONTROLLERS/paywall.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * POST /api/v1/paywall/event
 * Tracks funnel behavior
 */
router.post("/event", optionalAuth, trackPaywallEvent);

export default router;
