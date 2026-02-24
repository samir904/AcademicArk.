// services/logCapture.service.js
import RequestLog from '../MODELS/RequestLog.model.js';
import ConsoleLog from '../MODELS/ConsoleLog.model.js';
import { parseUserAgent } from '../UTIL/parseUserAgent.js';

// ─────────────────────────────────────────────
// 🔧 SENSITIVE FIELDS — redacted in body
// ─────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  'password', 'confirmpassword', 'oldpassword', 'newpassword',
  'token', 'accesstoken', 'refreshtoken', 'secret',
  'cardnumber', 'cvv', 'otp', 'pin',
]);

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const clean = {};
  for (const [k, v] of Object.entries(body)) {
    clean[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return clean;
};

// ─────────────────────────────────────────────
// 🚀 CAPTURE REQUEST LOG
// ─────────────────────────────────────────────
/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {number}                     responseTime  — ms
 * @param {{ fullPath: string, query: object, responseSize: number }} meta
 */
export const captureRequestLog = async (req, res, responseTime, meta = {}) => {
  try {
    const {
      fullPath     = req.originalUrl?.split('?')[0] || req.path,
      query        = req.query || {},
      responseSize = 0,
    } = meta;

    const userId    = req.user?._id   || null;
    const userEmail = req.user?.email || null;
    const ua        = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(ua);

    // ✅ Respect x-forwarded-for (trust proxy is set)
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null;

    await RequestLog.create({
      method:        req.method,
      path:          fullPath,       // ✅ always full path e.g. /api/v1/logs/device-intelligence
      query,
      body:          sanitizeBody(req.body),
      statusCode:    res.statusCode,
      statusMessage: res.statusMessage || null,
      responseTime,
      userId,
      userEmail,
      ipAddress,
      userAgent:     ua,
      deviceInfo,
      requestSize:   parseInt(req.headers['content-length'] || '0'),
      responseSize,  // ✅ now correctly tracked
    });
  } catch (err) {
    console.error('[CAPTURE_LOG] Failed:', err.message);
  }
};

// ─────────────────────────────────────────────
// 🚀 CAPTURE CONSOLE LOG
// ─────────────────────────────────────────────
export const captureConsoleLog = async (
  level, message, data = null, context = 'general'
) => {
  try {
    await ConsoleLog.create({
      level,
      message,
      data,
      source:    'console',
      context,
      timestamp: new Date(),
    });
  } catch (err) {
    // intentionally silent — avoid infinite loop
  }
};

// ─────────────────────────────────────────────
// 🚀 GET REQUEST LOGS
// ─────────────────────────────────────────────
export const getRequestLogs = async (filters = {}, limit = 100, page = 1) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {};

    if (filters.method)     query.method     = filters.method;
    if (filters.statusCode) query.statusCode = parseInt(filters.statusCode);
    if (filters.userId)     query.userId     = filters.userId;
    if (filters.path)       query.path       = { $regex: filters.path, $options: 'i' };
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate)   query.timestamp.$lte = new Date(filters.endDate);
    }

    const [logs, total] = await Promise.all([
      RequestLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email fullName')
        .lean(),
      RequestLog.countDocuments(query),
    ]);

    return { logs, total, pages: Math.ceil(total / limit), currentPage: page };
  } catch (err) {
    console.error('[LOG_CAPTURE] getRequestLogs:', err);
    throw err;
  }
};

// ─────────────────────────────────────────────
// 🚀 GET CONSOLE LOGS
// ─────────────────────────────────────────────
export const getConsoleLogs = async (filters = {}, limit = 100, page = 1) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {};

    if (filters.level)   query.level   = filters.level;
    if (filters.context) query.context = filters.context;
    if (filters.userId)  query.userId  = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate)   query.timestamp.$lte = new Date(filters.endDate);
    }

    const [logs, total] = await Promise.all([
      ConsoleLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email fullName')
        .lean(),
      ConsoleLog.countDocuments(query),
    ]);

    return { logs, total, pages: Math.ceil(total / limit), currentPage: page };
  } catch (err) {
    console.error('[LOG_CAPTURE] getConsoleLogs:', err);
    throw err;
  }
};

// ─────────────────────────────────────────────
// 🚀 GET LOG STATS
// ─────────────────────────────────────────────
export const getLogStats = async (days = 7) => {
  try {
    const dateAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [requestStats, consoleStats, topPaths, slowestRoutes] =
      await Promise.all([

        // Request stats by status code
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: dateAgo } } },
          { $group: {
              _id: '$statusCode',
              count:           { $sum: 1 },
              avgResponseTime: { $avg: '$responseTime' },
          }},
          { $sort: { count: -1 } },
        ]),

        // Console stats by level
        ConsoleLog.aggregate([
          { $match: { timestamp: { $gte: dateAgo } } },
          { $group: { _id: '$level', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),

        // Top paths by hit count
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: dateAgo } } },
          { $group: {
              _id:             '$path',
              count:           { $sum: 1 },
              avgResponseTime: { $avg: '$responseTime' },
          }},
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        // Slowest routes (method + path)
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: dateAgo } } },
          { $group: {
              _id:             { method: '$method', path: '$path' },
              avgResponseTime: { $avg: '$responseTime' },
              maxResponseTime: { $max: '$responseTime' },
              minResponseTime: { $min: '$responseTime' },
              count:           { $sum: 1 },
          }},
          { $match: { count: { $gte: 5 } } },
          { $sort: { avgResponseTime: -1 } },
          { $limit: 20 },
        ]),
      ]);

    return { requestStats, consoleStats, topPaths, slowestRoutes };
  } catch (err) {
    console.error('[LOG_CAPTURE] getLogStats:', err);
    throw err;
  }
};
