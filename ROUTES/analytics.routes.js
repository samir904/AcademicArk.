import { Router } from 'express'
import {
  getAnalytics,
  getTopPages,
  getTrafficSources
} from '../CONTROLLERS/analytics.controller.js'
import { isLoggedIn, authorizedRoles } from '../MIDDLEWARES/auth.middleware.js'
import asyncWrap from '../UTIL/asyncWrap.js'

const router = Router()

// Only admins can access
router.get('/overview', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(getAnalytics))
router.get('/top-pages', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(getTopPages))
router.get('/traffic-sources', asyncWrap(isLoggedIn), asyncWrap(authorizedRoles('ADMIN')), asyncWrap(getTrafficSources))

export default router
