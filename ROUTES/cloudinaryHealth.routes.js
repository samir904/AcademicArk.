// ROUTES/cloudinaryHealth.routes.js
import { Router } from 'express';
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js';
import {
  getCloudinaryHealth,
  getCloudinaryResources,
  getCloudinarySnapshots,
  getLatestSnapshot,
  triggerSnapshot,
} from '../CONTROLLERS/cloudinaryHealth.controller.js';

const router = Router();

router.use(isLoggedIn, authorizedRoles('ADMIN'));

router.get('/health',    getCloudinaryHealth);
router.get('/resources', getCloudinaryResources);
// ── Historical snapshots
router.get('/snapshots',           getCloudinarySnapshots);   // ?days=7|30
router.get('/snapshots/latest',    getLatestSnapshot);
router.post('/snapshots/trigger',  triggerSnapshot);          // manual save

export default router;
