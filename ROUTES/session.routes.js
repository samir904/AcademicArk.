// =====================================
// 📊 ROUTES/session.routes.js
// =====================================

import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import sessionController from "../CONTROLLERS/session.controller.js";

const router = Router();

// ✅ SESSION MANAGEMENT ROUTES

// Start a new session
router.post("/start", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.startSession)
);

// End session
router.post("/end", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.endSession)
);

// Get active session
router.get("/active/:userId", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.getActiveSession)
);

// Keep session alive (ping)
router.post("/ping", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.pingSession)
);

// ✅ ENGAGEMENT TRACKING ROUTES

// Track page view
router.post("/track/page-view", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.trackPageView)
);

router.post("/track/page-exit", sessionController.trackPageExit);

// Track note interaction (view, download, bookmark, rate, click)
router.post("/track/note-interaction", 
    asyncWrap(optionalAuth),
    asyncWrap(sessionController.trackNoteInteraction)
);

// Track click event (CTR tracking)
router.post("/track/click", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.trackClickEvent)
);

// ✅ ANALYTICS ROUTES

// Get session analytics
router.get("/analytics/summary", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.getSessionAnalytics)
);

// Get page engagement metrics
router.get("/analytics/page-metrics", 
    asyncWrap(isLoggedIn),
    asyncWrap(sessionController.getPageMetrics)
);

export default router;