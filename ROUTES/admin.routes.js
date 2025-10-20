// routes/admin.routes.js
import { Router } from 'express';
import { 
    getDashboardStats, 
    getAllUsers, 
    getAllNotes, 
    deleteUser, 
    deleteNote,
    updateUserRole,
    getRecentActivity, 
    getServerMetrics,
    getSessionMetrics,
    getTrafficPattern,
    getSessionHistory,
    getWeeklyComparison
} from '../CONTROLLERS/admin.controller.js';
import { authorizedRoles, isLoggedIn } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';
import notificationRoutes from './admin.notification.routes.js';

const router = Router();

// In admin.routes.js
router.use('/', notificationRoutes);


router.get('/dashboard/stats', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getDashboardStats)
);

router.get('/users', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getAllUsers)
);

router.get('/notes', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getAllNotes)
);

router.delete('/users/:id', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(deleteUser)
);

router.delete('/notes/:id', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(deleteNote)
);

router.put('/users/:id/role', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(updateUserRole)
);

router.get('/activity', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getRecentActivity)
);

router.get('/server-metrics',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getServerMetrics)
)

router.get('/session-metrics',
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getSessionMetrics)
)

// Add these routes
router.get('/session-history', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getSessionHistory)
);

router.get('/weekly-comparison', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getWeeklyComparison)
);

router.get('/traffic-pattern', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getTrafficPattern)
);

export default router;
