import express from 'express';
import { isLoggedIn } from '../MIDDLEWARES/auth.middleware.js';
import {
  createStudyPlan,
  getStudyPlans,
  getStudyPlanById,
  updateChapterProgress,
  getRecommendations,
  deleteStudyPlan,
  getSubjectMaterials
} from '../CONTROLLERS/studyPlanner.controller.js';

const router = express.Router();

// All routes require authentication
router.use(isLoggedIn);

// Create new study plan
router.post('/create', createStudyPlan);

router.get('/:id/subjects/:subjectId/materials',  getSubjectMaterials);

// Get all study plans
router.get('/all', getStudyPlans);

// Get study plan by ID
router.get('/:id', getStudyPlanById);

// Update chapter progress
router.patch('/:id/update-progress', updateChapterProgress);

// Get recommendations for a subject
router.get('/:id/:subjectId/recommendations', getRecommendations);

// Delete study plan
router.delete('/:id', deleteStudyPlan);

export default router;
