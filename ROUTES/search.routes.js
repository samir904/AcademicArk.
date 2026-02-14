// routes/search.routes.js
import { Router } from 'express';
import { searchNotes, getTrendingNotes, getPopularNotes } from '../CONTROLLERS/search.controller.js';
import { cacheNotes } from '../MIDDLEWARES/cache.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';
import { optionalAuth } from '../MIDDLEWARES/auth.middleware.js';

const router = Router();

router.use(optionalAuth);
router.get('/search', 
    asyncWrap(cacheNotes),
    asyncWrap(searchNotes)
);

router.get('/trending', 
    asyncWrap(cacheNotes),
    asyncWrap(getTrendingNotes)
);

router.get('/popular', 
    asyncWrap(cacheNotes),
    asyncWrap(getPopularNotes)
);

export default router;
