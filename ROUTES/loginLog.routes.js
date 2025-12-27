import { Router } from 'express';
import {
  getMyLoginHistory,
  getLoginAnalytics,
  getAllLoginLogs,
  getLoginsByDevice,
  getLoginsByBrowser,
  getSuspiciousLogins,
  getUserIPs
} from '../CONTROLLERS/loginLog.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

// User routes (authenticated)
router.get(
  '/my-history',
  asyncWrap(isLoggedIn),
  asyncWrap(getMyLoginHistory)
);

router.get(
  '/my-ips',
  asyncWrap(isLoggedIn),
  asyncWrap(getUserIPs)
);

// Admin routes
router.get(
  '/all',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getAllLoginLogs)
);

router.get(
  '/analytics',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getLoginAnalytics)
);

router.get(
  '/by-device',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getLoginsByDevice)
);

router.get(
  '/by-browser',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getLoginsByBrowser)
);

router.get(
  '/suspicious',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  asyncWrap(getSuspiciousLogins)
);

export default router;
