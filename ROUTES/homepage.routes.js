// ROUTES/homepage.routes.js
import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
import {
    getPersonalizedHomepage,
    invalidateHomepageCache,
    clearUserCache
} from "../CONTROLLERS/homepage.controller.js";

const router = Router();

/**
 * GET /api/v1/homepage/personalized
 * 
 * Get complete personalized homepage data
 * Auth: Required
 * Cache: 5 minutes (Redis)
 */
router.get(
    '/personalized',
    asyncWrap(isLoggedIn),
    asyncWrap(getPersonalizedHomepage)
);

/**
 * POST /api/v1/homepage/cache/invalidate
 * 
 * Manually invalidate cache (admin/internal use)
 * Auth: Required
 */
router.post(
    '/cache/invalidate',
    asyncWrap(isLoggedIn),
    asyncWrap(async (req, res) => {
        const userId = req.user.id;
        await invalidateHomepageCache(userId);
        
        res.status(200).json({
            success: true,
            message: "Cache invalidated"
        });
    })
);

export default router;
