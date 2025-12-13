import express from 'express';
import { 
  createRequest, 
  getMyRequests, 
  upvoteRequest, 
  getAllRequests,
  getAdminRequests,
  updateRequestStatus,
  deleteRequest,
  getRequestAnalytics
} from '../CONTROLLERS/userRequest.controller.js';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';

const router = express.Router();

router.use(isLoggedIn);

// Public/admin routes
router.post('/create',  createRequest);
router.get('/my-requests',  getMyRequests);
router.post('/:requestId/upvote',  upvoteRequest);
router.get('/all', getAllRequests);

// Admin routes
router.get('/admin/all', authorizedRoles('ADMIN'), getAdminRequests);
router.put('/admin/:requestId', authorizedRoles('ADMIN'), updateRequestStatus);
router.delete('/admin/:requestId', authorizedRoles('ADMIN'), deleteRequest);
router.get('/admin/analytics',  authorizedRoles('ADMIN'),getRequestAnalytics);

export default router;