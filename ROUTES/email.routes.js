import { Router } from 'express';
import { sendBroadcastEmail, getEmailStats } from '../CONTROLLERS/email.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';

const router = Router();

// Admin only routes
router.post('/broadcast-email', isLoggedIn, authorizedRoles('ADMIN'), sendBroadcastEmail);
router.get('/email-stats', isLoggedIn, authorizedRoles('ADMIN'), getEmailStats);

export default router;


