// ROUTES/retention.routes.js
import { Router } from 'express';
import asyncWrap from '../UTIL/asyncWrap.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import Apperror from '../UTIL/error.util.js';
import {
  getCohortByMonth,
  calculateCohortRetention,
  saveCohort,
  getAllCohorts
} from '../UTIL/retentionCalculator.js';
import UserCohortModel from '../MODELS/UserCohort.model.js';

const router = Router();

// Get all cohorts and retention data
router.get(
  '/cohorts',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  async (req, res, next) => {
    try {
      const cohorts = await getAllCohorts();
      
      res.status(200).json({
        success: true,
        message: 'Cohorts retrieved successfully',
        data: cohorts
      });
    } catch (error) {
      console.error('Get cohorts error:', error);
      return next(new Apperror('Failed to get cohorts', 500));
    }
  }
);

// Calculate retention for specific month
router.post(
  '/calculate/:year/:month',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  async (req, res, next) => {
    try {
      const { year, month } = req.params;
      
      // Validate inputs
      if (month < 1 || month > 12) {
        return next(new Apperror('Invalid month (1-12)', 400));
      }
      
      // Get cohort data
      const cohortData = await getCohortByMonth(parseInt(year), parseInt(month));
      
      if (cohortData.totalUsers === 0) {
        return res.status(200).json({
          success: true,
          message: 'No users in this cohort',
          data: null
        });
      }
      
      // Calculate retention
      const retention = await calculateCohortRetention(cohortData);
      
      // Save to database
      const cohort = await saveCohort(cohortData, retention);
      
      res.status(200).json({
        success: true,
        message: 'Cohort retention calculated successfully',
        data: {
          cohort,
          totalUsers: cohortData.totalUsers,
          retention
        }
      });
    } catch (error) {
      console.error('Calculate retention error:', error);
      return next(new Apperror('Failed to calculate retention', 500));
    }
  }
);

// Get specific cohort details
router.get(
  '/cohorts/:cohortName',
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles('ADMIN')),
  async (req, res, next) => {
    try {
      const { cohortName } = req.params;
      
      const cohort = await UserCohortModel.findOne({ cohortName })
        .populate('userIds', 'fullName email createdAt');
      
      if (!cohort) {
        return next(new Apperror('Cohort not found', 404));
      }
      
      res.status(200).json({
        success: true,
        message: 'Cohort details retrieved successfully',
        data: cohort
      });
    } catch (error) {
      console.error('Get cohort error:', error);
      return next(new Apperror('Failed to get cohort', 500));
    }
  }
);

export default router;
