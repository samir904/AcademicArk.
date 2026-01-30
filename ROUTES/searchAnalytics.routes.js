// routes/searchAnalytics.routes.js
import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { getRecentSearches, logSearchAnalytics } from "../CONTROLLERS/searchAnalytics.controller.js";
import { optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

const router = Router();

/**
 * 🔍 SEARCH ANALYTICS — LOG SEARCH EVENT
 *
 * INTERNAL USE ONLY
 * Called from search controller (fire-and-forget)
 */
router.use(optionalAuth);
router.post(
  "/log",
  asyncWrap(logSearchAnalytics)
);

/**
 * 🕘 RECENT SEARCHES — USER SPECIFIC
 */
router.get(
  "/recent",
  asyncWrap(getRecentSearches)
);


export default router;
