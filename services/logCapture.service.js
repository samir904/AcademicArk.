import RequestLog from '../MODELS/RequestLog.model.js';
import ConsoleLog from '../MODELS/ConsoleLog.model.js';

/**
 * Capture HTTP request logs
 */
export const captureRequestLog = async (req, res, responseTime) => {
  try {
    const requestLog = new RequestLog({
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      responseTime: responseTime,
      userId: req.user?._id || null,
      userEmail: req.user?.email || null,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date()
    });

    await requestLog.save();
  } catch (error) {
    console.error('[LOG_CAPTURE] Error capturing request log:', error);
  }
};

/**
 * Capture console logs
 */
export const captureConsoleLog = async (level, message, data = null, context = 'general') => {
  try {
    const consoleLog = new ConsoleLog({
      level,
      message,
      data,
      source: 'console',
      context,
      timestamp: new Date()
    });

    await consoleLog.save();
  } catch (error) {
    // Don't log error to avoid infinite loop
    console.error('[LOG_CAPTURE] Error capturing console log:', error);
  }
};

/**
 * Get request logs with filters
 */
export const getRequestLogs = async (filters = {}, limit = 100, page = 1) => {
  try {
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.method) query.method = filters.method;
    if (filters.statusCode) query.statusCode = filters.statusCode;
    if (filters.userId) query.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }

    const logs = await RequestLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email fullName');

    const total = await RequestLog.countDocuments(query);

    return {
      logs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error('[LOG_CAPTURE] Error fetching request logs:', error);
    throw error;
  }
};

/**
 * Get console logs with filters
 */
export const getConsoleLogs = async (filters = {}, limit = 100, page = 1) => {
  try {
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.level) query.level = filters.level;
    if (filters.context) query.context = filters.context;
    if (filters.userId) query.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }

    const logs = await ConsoleLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email fullName');

    const total = await ConsoleLog.countDocuments(query);

    return {
      logs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error('[LOG_CAPTURE] Error fetching console logs:', error);
    throw error;
  }
};

/**
 * Get log statistics
 * 🔥 NOW INCLUDES: slowestRoutes (by avg response time, grouped by method + path)
 */
export const getLogStats = async (days = 7) => {
  try {
    const dateAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);


    // Request log stats (by status code)
    const requestStats = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: dateAgo } } },
      {
        $group: {
          _id: '$statusCode',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { count: -1 } }
    ]);


    // Console log stats (by level)
    const consoleStats = await ConsoleLog.aggregate([
      { $match: { timestamp: { $gte: dateAgo } } },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);


    // Top paths (by hit count)
    const topPaths = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: dateAgo } } },
      {
        $group: {
          _id: '$path',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);


    // 🔥 NEW: Slowest routes (method + path) by average response time
    const slowestRoutes = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: dateAgo } } },
      {
        $group: {
          _id: { method: '$method', path: '$path' },
          avgResponseTime: { $avg: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          count: { $sum: 1 }
        }
      },
      // Filter: only routes with at least 5 hits (remove noise/outliers)
      { $match: { count: { $gte: 5 } } },
      // Sort by slowest first
      { $sort: { avgResponseTime: -1 } },
      // Limit to top 20 slowest
      { $limit: 20 }
    ]);


    return {
      requestStats,
      consoleStats,
      topPaths,
      slowestRoutes
    };
  } catch (error) {
    console.error('[LOG_CAPTURE] Error getting log stats:', error);
    throw error;
  }
};
