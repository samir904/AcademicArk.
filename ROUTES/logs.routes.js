// logs.router.js — final complete version

import { Router } from 'express';
import {
  getRequestLogsController,
  getConsoleLogsController,
  getLogStatsController,
  clearAllLogs,
  deleteRequestLogsByStatus,
  deleteOldConsoleLogs,
  deleteOldRequestLogs,
  deleteConsoleLog,
  deleteRequestLog,
  getRequestAnalytics,
  getSlowEndpoints,
  getErrorBreakdown,
  getTrafficHeatmap,
  getTopEndpoints,
  getTopUsers,
  // ✅ NEW
  getSuspiciousActivity,
  getDeviceIntelligence,
  getUserBehaviorSignals,
} from '../CONTROLLERS/logs.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router   = Router();
const adminOnly = [asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN'))];

// ── Read routes
router.get('/requests',           ...adminOnly, asyncWrap(getRequestLogsController));
router.get('/console',            ...adminOnly, asyncWrap(getConsoleLogsController));
router.get('/stats',              ...adminOnly, asyncWrap(getLogStatsController));
router.get('/analytics',          ...adminOnly, asyncWrap(getRequestAnalytics));
router.get('/slow-endpoints',     ...adminOnly, asyncWrap(getSlowEndpoints));
router.get('/error-breakdown',    ...adminOnly, asyncWrap(getErrorBreakdown));
router.get('/traffic-heatmap',    ...adminOnly, asyncWrap(getTrafficHeatmap));
router.get('/top-endpoints',      ...adminOnly, asyncWrap(getTopEndpoints));
router.get('/top-users',          ...adminOnly, asyncWrap(getTopUsers));
// ✅ NEW
router.get('/suspicious',         ...adminOnly, asyncWrap(getSuspiciousActivity));
router.get('/device-intelligence',...adminOnly, asyncWrap(getDeviceIntelligence));
router.get('/user-behavior',      ...adminOnly, asyncWrap(getUserBehaviorSignals));

// ── Delete routes
router.delete('/requests/:logId',         ...adminOnly, asyncWrap(deleteRequestLog));
router.delete('/console/:logId',          ...adminOnly, asyncWrap(deleteConsoleLog));
router.delete('/requests/cleanup/old',    ...adminOnly, asyncWrap(deleteOldRequestLogs));
router.delete('/console/cleanup/old',     ...adminOnly, asyncWrap(deleteOldConsoleLogs));
router.delete('/requests/cleanup/status', ...adminOnly, asyncWrap(deleteRequestLogsByStatus));
router.delete('/cleanup/all',             ...adminOnly, asyncWrap(clearAllLogs));

export default router;
