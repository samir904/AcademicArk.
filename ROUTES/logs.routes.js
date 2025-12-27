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
  deleteRequestLog
} from '../CONTROLLERS/logs.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

// Get request logs
router.get(
  '/requests',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getRequestLogsController)
);

// Get console logs
router.get(
  '/console',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getConsoleLogsController)
);

// Get log statistics
router.get(
  '/stats',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getLogStatsController)
);
// ==================== DELETE ROUTES ====================

// Delete single request log
router.delete(
  '/requests/:logId',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(deleteRequestLog)
);

// Delete single console log
router.delete(
  '/console/:logId',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(deleteConsoleLog)
);

// Delete old request logs
router.delete(
  '/requests/cleanup/old',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(deleteOldRequestLogs)
);

// Delete old console logs
router.delete(
  '/console/cleanup/old',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(deleteOldConsoleLogs)
);

// Delete request logs by status code
router.delete(
  '/requests/cleanup/status',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(deleteRequestLogsByStatus)
);

// Clear all logs (DANGEROUS!)
router.delete(
  '/cleanup/all',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(clearAllLogs)
);
export default router;
