import { captureRequestLog } from '../services/logCapture.service.js';

/**
 * List of paths to SKIP logging
 * These are high-frequency requests that shouldn't be logged
 */
const SKIP_PATHS = [
  '/server-metrics',           // ✅ Now matches!
  '/session-metrics',          // ✅ Now matches!
  '/academic-profile/check',
  '/activity',
  '/weekly-comparison',
  '/traffic-pattern',
  '/banner',
  '/dashboard/stats',
  '/session-history',
  '/api/v1/health',
  '/colleges/list',
  '/all',
  '/api/v1/admin/dashboard/stats',
  '/api/v1/admin/banner',
  '/console',
  '/requests',
  '/stats',
  '/analytics',
  '/users'
];


/**
 * Check if path should be skipped
 */
const shouldSkipPath = (path) => {
  return SKIP_PATHS.some(skipPath => path.startsWith(skipPath));
};

/**
 * Middleware to capture all HTTP requests (except metrics)
 */
export const requestLoggerMiddleware = async (req, res, next) => {
  const startTime = Date.now();

  // Capture original send function
  const originalSend = res.send;

  // Override send to capture response
  res.send = function (data) {
    res.send = originalSend;

    const responseTime = Date.now() - startTime;

    // SKIP logging for certain paths
    if (!shouldSkipPath(req.path)) {
      // Capture the request (async, don't wait)
      captureRequestLog(req, res, responseTime).catch(error => {
        console.error('[REQUEST_LOGGER] Error capturing log:', error);
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

export default requestLoggerMiddleware;
