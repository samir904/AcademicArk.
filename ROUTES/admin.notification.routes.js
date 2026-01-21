import { Router } from 'express';
import {
  createBanner, 
  getActiveBanner, 
  getActiveBannerForUser,
  listBanners, 
  hideBanner, 
  deleteBanner,
  updateBanner
} from '../CONTROLLERS/notification.controller.js';
import { isLoggedIn, authorizedRoles, optionalAuth } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

// ADMIN ROUTES - PUT FIRST (more specific)
router.post('/banner', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(createBanner));
router.get('/banners', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(listBanners));
router.put('/banner/:id', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(updateBanner));
router.put('/banner/:id/hide', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(hideBanner));
router.delete('/banner/:id', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(deleteBanner));

// PUBLIC ROUTES - PUT LAST (more generic)
router.post('/banner/user', asyncWrap(isLoggedIn), asyncWrap(getActiveBannerForUser));
router.get('/banner', optionalAuth, asyncWrap(getActiveBanner));

export default router;
