// routes/admin.routes.js
import { Router } from 'express';
import { 
    getDashboardStats, 
    getAllUsers, 
    getAllNotes, 
    deleteUser, 
    deleteNote,
    updateUserRole,
    getRecentActivity 
} from '../CONTROLLERS/admin.controller.js';
import { authorizedRoles, isLoggedIn } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

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

export default router;
