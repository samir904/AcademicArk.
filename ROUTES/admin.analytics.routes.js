import express from 'express';
import adminAnalyticsController from '../CONTROLLERS/admin.analytics.controller.js';
import { authorizedRoles, isLoggedIn } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = express.Router();

// 🔒 All routes protected - must be logged in AND admin
router.use(asyncWrap(isLoggedIn));
router.use(asyncWrap(authorizedRoles("ADMIN")));

// ═══════════════════════════════════════
// TAB 1: OVERVIEW (Health of platform)
// ═══════════════════════════════════════
router.get('/overview', 
    asyncWrap(adminAnalyticsController.getOverview)
);

// ═══════════════════════════════════════
// TAB 2: SESSIONS & USERS
// ═══════════════════════════════════════
router.get('/sessions/timeline', 
    asyncWrap(adminAnalyticsController.getSessionsTimeline)
);

router.get('/users/returning', 
    asyncWrap(adminAnalyticsController.getReturningUsers)
);

router.get('/users/new', 
    asyncWrap(adminAnalyticsController.getNewUsers)
);

// ═══════════════════════════════════════
// TAB 3: PAGE ANALYTICS
// ═══════════════════════════════════════
router.get('/pages/top', 
    asyncWrap(adminAnalyticsController.getTopPages)
);

router.get('/pages/engagement', 
    asyncWrap(adminAnalyticsController.getPageEngagement)
);

// ═══════════════════════════════════════
// TAB 4: NOTES ANALYTICS
// ═══════════════════════════════════════
router.get('/notes/top-viewed', 
    asyncWrap(adminAnalyticsController.getTopViewedNotes)
);

router.get('/notes/top-downloaded', 
    asyncWrap(adminAnalyticsController.getTopDownloadedNotes)
);

router.get('/notes/funnel', 
    asyncWrap(adminAnalyticsController.getNotesFunnel)
);

router.get('/notes/dead-content', 
    asyncWrap(adminAnalyticsController.getDeadContent)
);

// ═══════════════════════════════════════
// TAB 5: FUNNEL & CONVERSIONS
// ═══════════════════════════════════════
router.get('/funnel/download', 
    asyncWrap(adminAnalyticsController.getDownloadFunnel)
);

router.get('/conversions/summary', 
    asyncWrap(adminAnalyticsController.getConversionsSummary)
);

// ═══════════════════════════════════════
// TAB 6: ENGAGEMENT & CTR
// ═══════════════════════════════════════
router.get('/ctr/by-section', 
    asyncWrap(adminAnalyticsController.getCTRBySection)
);

router.get('/engagement/summary', 
    asyncWrap(adminAnalyticsController.getEngagementSummary)
);

// ═══════════════════════════════════════
// TAB 7: DEVICES & TECH
// ═══════════════════════════════════════
router.get('/devices/breakdown', 
    asyncWrap(adminAnalyticsController.getDeviceBreakdown)
);

router.get('/browsers/breakdown', 
    asyncWrap(adminAnalyticsController.getBrowserBreakdown)
);

router.get('/os/breakdown', 
    asyncWrap(adminAnalyticsController.getOSBreakdown)
);

// TAB 8: ACQUISITION / TRAFFIC SOURCES
router.get('/acquisition/sources', asyncWrap(adminAnalyticsController.getTrafficSources));
router.get('/acquisition/entry-pages', asyncWrap(adminAnalyticsController.getEntryPagesBySource));
router.get('/acquisition/referrers', asyncWrap(adminAnalyticsController.getTopReferrers));

export default router;
