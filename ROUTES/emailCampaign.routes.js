import { Router } from 'express';
import {
createCampaign,
sendDailyCampaignEmails,
getCampaigns,
getCampaignDetails,
pauseCampaign,
resumeCampaign,
sendPersonalEmail
} from '../CONTROLLERS/emailCampaign.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';

const router = Router();

// Admin only routes
router.post('/create', isLoggedIn, authorizedRoles('ADMIN'), createCampaign);
router.post('/send-daily', isLoggedIn, authorizedRoles('ADMIN'), sendDailyCampaignEmails);
router.get('/list', isLoggedIn, authorizedRoles('ADMIN'), getCampaigns);
router.get('/:campaignId', isLoggedIn, authorizedRoles('ADMIN'), getCampaignDetails);
router.put('/:campaignId/pause', isLoggedIn, authorizedRoles('ADMIN'), pauseCampaign);
router.put('/:campaignId/resume', isLoggedIn, authorizedRoles('ADMIN'), resumeCampaign);
// ✅ ADD this route
router.post(
  '/send-personal',
  isLoggedIn,
  authorizedRoles('ADMIN'),
  sendPersonalEmail
);
export default router;