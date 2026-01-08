// BACKEND/ROUTES/mongoDbHealth.routes.js

import { Router } from 'express';
import {
    getMongoDBHealth,
    getDatabaseStats,
    getPerformanceMetrics,
    getConnectionDetails
} from '../CONTROLLERS/mongoDbHealth.Controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

/**
 * Get MongoDB health status
 * GET /api/v1/db/health
 */
router.get(
    '/health',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getMongoDBHealth)
);

/**
 * Get database statistics
 * GET /api/v1/db/stats
 */
router.get(
    '/stats',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getDatabaseStats)
);

/**
 * Get performance metrics
 * GET /api/v1/db/performance
 */
router.get(
    '/performance',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getPerformanceMetrics)
);

/**
 * Get connection details
 * GET /api/v1/db/connection
 */
router.get(
    '/connection',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getConnectionDetails)
);

export default router;