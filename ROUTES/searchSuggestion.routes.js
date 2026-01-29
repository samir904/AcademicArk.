// routes/searchSuggestion.routes.js
import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { getSearchSuggestions } from "../CONTROLLERS/searchSuggestion.controller.js";
import { optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

const router = Router();

/**
 * ✨ GET SEARCH SUGGESTIONS
 * Example:
 * /search/suggestions?q=data+structre
 */
router.use(optionalAuth);
router.get(
  "/",
  asyncWrap(getSearchSuggestions)
);

export default router;
