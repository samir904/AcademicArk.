// MIDDLEWARES/requestLogger.middleware.js
import { captureRequestLog } from '../services/logCapture.service.js';

// ─────────────────────────────────────────────
// 🔧 SKIP CONFIG — full mounted paths only
// ─────────────────────────────────────────────
// Exact matches (no startsWith)
const SKIP_EXACT = new Set([
  '/health',
  '/sitemap.xml',
  '/sitemap-index.xml',
  '/robots.txt',
  '/google87d7a8fb5b2c4434.html',
]);

// Prefix matches — must be specific, never skip entire /admin
const SKIP_PREFIXES = [
  // ✅ Logs viewer — prevent self-logging infinite loop
  '/api/v1/logs/',

  // ✅ DB / Cache health checks
  '/api/v1/db/',
  '/api/v1/cache/',
  '/api/v1/query-metrics/',

  // ✅ Session polling (high-frequency, no value in logging)
  '/api/v1/admin/server-metrics',
  '/api/v1/admin/session-metrics',
  '/api/v1/admin/traffic-pattern',
  '/api/v1/admin/weekly-comparison',
  '/api/v1/admin/activity',
  '/api/v1/admin/session-history',
  '/api/v1/sessionV2/',

  // ✅ Admin analytics dashboards (pure read, high-freq)
  '/api/v1/admin/analytics/',
  '/api/v1/admin/dashboard/stats',
  '/api/v1/admin/banner',
  '/api/v1/admin/conversion-funnel',
  '/api/v1/admin/top-download',
  '/api/v1/admin/filter-combinations',
  '/api/v1/admin/peak-usage',
  '/api/v1/admin/device-analytics',
  '/api/v1/admin/subject-performance',
  '/api/v1/admin/content-gaps',
  '/api/v1/admin/most-viewed',

  // ✅ Homepage analytics
  '/api/v1/home/analytics/',
  '/api/v1/home/banner',

  // ✅ Analytics read dashboards
  '/api/v1/analytics/overview',
  '/api/v1/analytics/academic-analytics',
  '/api/v1/filter-analytics/',

  // ✅ Retention heavy reads
  '/api/v1/retention/cohorts',
  '/api/v1/retention/ltv-metrics',
  '/api/v1/retention/churn-analysis',
  '/api/v1/retention/retention-metrics',

  // ✅ Public high-freq
  '/api/v1/public/colleges/list',
  '/api/v1/user/academic-profile/check',
  '/api/v1/user/all',
  '/api/v1/admin/all',

  // ✅ Paywall reads
  '/api/v1/paywall/',
  '/api/v1/admin/paywall/',

  // ✅ Search suggestions + analytics (fire-and-forget)
  '/api/v1/search/suggestions/',
  '/api/v1/search/analytics/',
  '/api/v1/analytics/track/page-exit',
  '/api/v1/analytics/track/click',
  '/api/v1/analytics/update-engagement',
  '/api/v1/analytics/event',
  '/api/v1/analytics/personalized',
  '/api/v1/analytics/hybrid',
  '/api/v1/analytics/cache/invalidate',
 '/api/v1/admin/'

];

// ─────────────────────────────────────────────
// 🔧 HELPER
// ─────────────────────────────────────────────
const shouldSkipPath = (req) => {
  // ✅ baseUrl + path = full mounted path (e.g. /api/v1/logs/device-intelligence)
  const routePath = req.baseUrl + req.path;
  if (SKIP_EXACT.has(routePath))                                       return true;
  if (SKIP_PREFIXES.some(prefix => routePath.startsWith(prefix)))      return true;
  return false;
};

// ─────────────────────────────────────────────
// 🚀 MIDDLEWARE
// ─────────────────────────────────────────────
export const requestLoggerMiddleware = (req, res, next) => {
  // ✅ Early skip — before any overhead
  if (shouldSkipPath(req)) return next();

  const startTime = Date.now();

  // ✅ Snapshot BEFORE Express mutates baseUrl/path during routing
  const fullPath = req.baseUrl + req.path;
  const query    = { ...req.query }; // shallow clone

  let responseSize = 0;

  // ── Override res.write to track streaming response size
  const originalWrite = res.write.bind(res);
  const originalEnd   = res.end.bind(res);

  res.write = function (chunk, ...args) {
    try {
      // ✅ Safe type check before Buffer.byteLength
      if (chunk != null) {
        if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
          responseSize += Buffer.byteLength(chunk);
        } else if (chunk instanceof Uint8Array) {
          responseSize += chunk.byteLength;
        }
      }
    } catch (_) { /* never crash the app */ }
    return originalWrite(chunk, ...args);
  };

  res.end = function (chunk, ...args) {
    try {
      if (chunk != null) {
        if (Buffer.isBuffer(chunk) || typeof chunk === 'string') {
          responseSize += Buffer.byteLength(chunk);
        } else if (chunk instanceof Uint8Array) {
          responseSize += chunk.byteLength;
        }
      }
    } catch (_) {}

    const responseTime = Date.now() - startTime;

    // ✅ Correct signature — single meta object, no confusion
    captureRequestLog(req, res, responseTime, {
      fullPath,
      query,
      responseSize,
    }).catch(err => console.error('[REQUEST_LOGGER]', err.message));

    return originalEnd(chunk, ...args);
  };

  next();
};

export default requestLoggerMiddleware;
