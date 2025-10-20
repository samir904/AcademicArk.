// routes/admin.notification.routes.js
import { Router } from 'express';
import {
  createBanner, getActiveBanner, listBanners, hideBanner, deleteBanner
} from '../CONTROLLERS/notification.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import asyncWrap from '../UTIL/asyncWrap.js';

const router = Router();

router.post('/banner', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(createBanner));
router.get('/banners', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(listBanners));
router.get('/banner', asyncWrap(getActiveBanner)); // No auth, available to all users
router.put('/banner/:id/hide', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(hideBanner));
router.delete('/banner/:id', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(deleteBanner));

export default router;
