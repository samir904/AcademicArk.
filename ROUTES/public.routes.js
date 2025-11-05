import { Router } from 'express';
import { getPublicStats } from '../CONTROLLERS/public.controller.js';

const router = Router();
router.get('/stats', getPublicStats);
export default router;
