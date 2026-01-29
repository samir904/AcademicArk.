import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { logFailedSearchAction } from "../CONTROLLERS/failedSearchAction.controller.js";
import { isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";

const router = Router();


router.use(optionalAuth);
/**
 * 📉 LOG ACTION AFTER FAILED SEARCH
 * Example:
 * POST /search/failed-action
 */
router.post(
  "/failed-action",
  asyncWrap(logFailedSearchAction)
);

export default router;
