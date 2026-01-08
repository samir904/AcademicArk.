// BACKEND/ROUTES/queryMetrics.routes.js - NEW FILE

import { Router } from 'express';
import {
    getOverallQueryMetrics,
    getQueryMetricsByRoute,
    getQueryMetricsByCollection,
    getSlowQueries,
    getDetailedQueryReport,
    resetQueryMetrics
} from '../CONTROLLERS/queryMetrics.Controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

/**
 * Get overall query metrics
 * GET /api/v1/query-metrics/overall
 */
router.get(
    '/overall',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getOverallQueryMetrics)
);

/**
 * Get query metrics by route (AVG QUERIES PER ROUTE)
 * GET /api/v1/query-metrics/by-route
 */
router.get(
    '/by-route',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getQueryMetricsByRoute)
);

/**
 * Get query metrics by collection
 * GET /api/v1/query-metrics/by-collection
 */
router.get(
    '/by-collection',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getQueryMetricsByCollection)
);

/**
 * Get slow queries (> 100ms)
 * GET /api/v1/query-metrics/slow-queries?limit=20
 */
router.get(
    '/slow-queries',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getSlowQueries)
);

/**
 * Get detailed report (all metrics)
 * GET /api/v1/query-metrics/report
 */
router.get(
    '/report',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getDetailedQueryReport)
);

/**
 * Reset metrics (for testing)
 * POST /api/v1/query-metrics/reset
 */
router.post(
    '/reset',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(resetQueryMetrics)
);

export default router;