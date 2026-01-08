// BACKEND/ROUTES/redisHealth.routes.js

import { Router } from 'express';
import {
    getRedisHealth,
    getMemoryStats,
    getKeyStats,
    getHitMissStats,
    getCachePerformance
} from '../CONTROLLERS/redisHealth.Controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

/**
 * Get Redis health status
 * GET /api/v1/cache/health
 */
router.get(
    '/health',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getRedisHealth)
);

/**
 * Get memory statistics
 * GET /api/v1/cache/memory
 */
router.get(
    '/memory',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getMemoryStats)
);

/**
 * Get key statistics
 * GET /api/v1/cache/keys
 */
router.get(
    '/keys',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getKeyStats)
);

/**
 * Get hit/miss statistics
 * GET /api/v1/cache/hits
 */
router.get(
    '/hits',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getHitMissStats)
);

/**
 * Get cache performance
 * GET /api/v1/cache/performance
 */
router.get(
    '/performance',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getCachePerformance)
);

export default router;