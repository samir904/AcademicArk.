import express from "express";
import {
  startSession,
  endSession,
  trackPageView,
  trackEvent,
  trackPageExit
} from "../CONTROLLERS/session.v2.controller.js";

import { optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

const router = express.Router();

/**
 * =========================
 * SESSION START
 * =========================
 */
router.post("/start", optionalAuth, startSession);

/**
 * =========================
 * SESSION END
 * =========================
 */
router.post("/end", optionalAuth, endSession);

/**
 * =========================
 * PAGE VIEW TRACKING
 * =========================
 */
router.post("/track/page-view", optionalAuth, trackPageView);

router.post("/track/page-exit", optionalAuth, trackPageExit);


/**
 * =========================
 * EVENT TRACKING
 * =========================
 */
router.post("/track/event", optionalAuth, trackEvent);

export default router;
