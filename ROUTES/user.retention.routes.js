import express from 'express';
import {
    getUserRetentionData,
    getRetentionFunnel,
    getCohortAnalysis,
    getEngagementMetrics,
    getUserActivityTimeline,
    getRetentionStatus,
    getChurnRiskUsers
} from '../CONTROLLERS/retention.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';

const router = express.Router();

// Admin only routes
router.use(isLoggedIn, authorizedRoles('ADMIN'));

// Get retention data for specific user
router.get('/user/:userId', getUserRetentionData);

// Get funnel conversion rates
router.get('/funnel', getRetentionFunnel);

// Get cohort analysis
router.get('/cohort', getCohortAnalysis);

// Get engagement metrics
router.get('/engagement', getEngagementMetrics);

// Get user activity timeline
router.get('/activity/:userId', getUserActivityTimeline);

// Get retention status
router.get('/status', getRetentionStatus);

// Get churn risk users (for intervention)
router.get('/churn-risk', getChurnRiskUsers);

export default router;
