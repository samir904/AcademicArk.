import RequestLog from '../MODELS/RequestLog.model.js';
import ConsoleLog from '../MODELS/ConsoleLog.model.js';
import { getRequestLogs, getConsoleLogs, getLogStats } from '../services/logCapture.service.js';

/**
 * Get request logs
 */
export const getRequestLogsController = async (req, res) => {
  try {
    const { method, statusCode, userId, startDate, endDate, limit = 50, page = 1 } = req.query;

    const logs = await getRequestLogs(
      { method, statusCode, userId, startDate, endDate },
      parseInt(limit),
      parseInt(page)
    );

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error getting request logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching request logs',
      error: error.message
    });
  }
};

/**
 * Get console logs
 */
export const getConsoleLogsController = async (req, res) => {
  try {
    const { level, context, userId, startDate, endDate, limit = 50, page = 1 } = req.query;

    const logs = await getConsoleLogs(
      { level, context, userId, startDate, endDate },
      parseInt(limit),
      parseInt(page)
    );

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error getting console logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching console logs',
      error: error.message
    });
  }
};

/**
 * Get log statisticsr
 */
export const getLogStatsController = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await getLogStats(parseInt(days));

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error getting log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching log statistics',
      error: error.message
    });
  }
};

// ===================== NEW: DELETE CONTROLLERS =====================

/**
 * Delete single request log
 * @param {string} logId - Log ID to delete
 */
export const deleteRequestLog = async (req, res) => {
  try {
    const { logId } = req.params;

    const deleted = await RequestLog.findByIdAndDelete(logId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Request log deleted successfully',
      data: deleted
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error deleting request log:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting log',
      error: error.message
    });
  }
};

/**
 * Delete single console log
 * @param {string} logId - Log ID to delete
 */
export const deleteConsoleLog = async (req, res) => {
  try {
    const { logId } = req.params;

    const deleted = await ConsoleLog.findByIdAndDelete(logId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Console log deleted successfully',
      data: deleted
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error deleting console log:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting log',
      error: error.message
    });
  }
};

/**
 * Delete all request logs older than X days
 * @param {number} days - Delete logs older than this many days
 */
export const deleteOldRequestLogs = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await RequestLog.deleteMany({
      timestamp: { $lt: dateThreshold }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} request logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error deleting old request logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting logs',
      error: error.message
    });
  }
};

/**
 * Delete all console logs older than X days
 * @param {number} days - Delete logs older than this many days
 */
export const deleteOldConsoleLogs = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await ConsoleLog.deleteMany({
      timestamp: { $lt: dateThreshold }
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} console logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error deleting old console logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting logs',
      error: error.message
    });
  }
};

/**
 * Delete all logs by status code
 * @param {number} statusCode - Status code to delete
 */
export const deleteRequestLogsByStatus = async (req, res) => {
  try {
    const { statusCode } = req.query;

    if (!statusCode) {
      return res.status(400).json({
        success: false,
        message: 'Status code required'
      });
    }

    const result = await RequestLog.deleteMany({
      statusCode: parseInt(statusCode)
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} logs with status ${statusCode}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error deleting logs by status:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting logs',
      error: error.message
    });
  }
};

/**
 * Clear all logs (WARNING: Permanent!)
 */
export const clearAllLogs = async (req, res) => {
  try {
    // Request confirmation
    const { confirm } = req.query;
    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'Please add ?confirm=true to confirm deletion'
      });
    }

    const requestResult = await RequestLog.deleteMany({});
    const consoleResult = await ConsoleLog.deleteMany({});

    res.status(200).json({
      success: true,
      message: 'All logs cleared',
      deletedRequestLogs: requestResult.deletedCount,
      deletedConsoleLogs: consoleResult.deletedCount
    });
  } catch (error) {
    console.error('[LOGS_CONTROLLER] Error clearing all logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing logs',
      error: error.message
    });
  }
};


// In logs.controller.js — add all of these:

// ─────────────────────────────────────────────
// 📊 1. OVERVIEW ANALYTICS
// GET /api/v1/logs/analytics?hours=6
// ─────────────────────────────────────────────
export const getRequestAnalytics = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [overview, methodBreakdown, statusBreakdown, timelineData] =
      await Promise.all([

        // ── Overall stats
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id:             null,
              totalRequests:   { $sum: 1 },
              avgResponseTime: { $avg: "$responseTime" },
              maxResponseTime: { $max: "$responseTime" },
              minResponseTime: { $min: "$responseTime" },
              totalErrors:     {
                $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
              },
              total5xx: {
                $sum: { $cond: [{ $gte: ["$statusCode", 500] }, 1, 0] }
              },
              total4xx: {
                $sum: {
                  $cond: [
                    { $and: [
                      { $gte: ["$statusCode", 400] },
                      { $lt:  ["$statusCode", 500] }
                    ]},
                    1, 0
                  ]
                }
              },
              totalRequestSize:  { $sum: "$requestSize"  },
              totalResponseSize: { $sum: "$responseSize" },
              uniqueUsers:       { $addToSet: "$userEmail"  },
              uniqueIPs:         { $addToSet: "$ipAddress" },
            },
          },
          {
            $project: {
              _id:             0,
              totalRequests:   1,
              avgResponseTime: { $round: ["$avgResponseTime", 2] },
              maxResponseTime: 1,
              minResponseTime: 1,
              totalErrors:     1,
              total5xx:        1,
              total4xx:        1,
              errorRate: {
                $cond: [
                  { $gt: ["$totalRequests", 0] },
                  { $round: [{ $multiply: [{ $divide: ["$totalErrors", "$totalRequests"] }, 100] }, 2] },
                  0,
                ]
              },
              totalRequestSize:  1,
              totalResponseSize: 1,
              uniqueUsers:  { $size: "$uniqueUsers" },
              uniqueIPs:    { $size: "$uniqueIPs"   },
            },
          },
        ]),

        // ── Method breakdown (GET/POST/PUT/DELETE)
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id:             "$method",
              count:           { $sum: 1 },
              avgResponseTime: { $avg: "$responseTime" },
              errors: {
                $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
              },
            },
          },
          {
            $project: {
              _id:    0,
              method: "$_id",
              count:  1,
              avgResponseTime: { $round: ["$avgResponseTime", 2] },
              errors: 1,
            },
          },
          { $sort: { count: -1 } },
        ]),

        // ── Status code breakdown
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id:   "$statusCode",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id:        0,
              statusCode: "$_id",
              count:      1,
            },
          },
          { $sort: { count: -1 } },
        ]),

        // ── Timeline: requests per 30-minute bucket
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format:   "%Y-%m-%dT%H:%M",
                  date:     "$timestamp",
                  timezone: "Asia/Kolkata",
                },
              },
              requests: { $sum: 1 },
              errors: {
                $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
              },
              avgResponseTime: { $avg: "$responseTime" },
            },
          },
          {
            $project: {
              _id:    0,
              time:   "$_id",
              requests: 1,
              errors:   1,
              avgResponseTime: { $round: ["$avgResponseTime", 2] },
            },
          },
          { $sort: { time: 1 } },
        ]),
      ]);

    res.status(200).json({
      success: true,
      hours,
      data: {
        overview:        overview[0] || {},
        methodBreakdown,
        statusBreakdown,
        timeline:        timelineData,
      },
    });

  } catch (err) {
    console.error("[getRequestAnalytics] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 🐌 2. SLOW ENDPOINTS
// GET /api/v1/logs/slow-endpoints?hours=6&threshold=1000
// ─────────────────────────────────────────────
export const getSlowEndpoints = async (req, res) => {
  try {
    const hours     = parseInt(req.query.hours)     || 6;
    const threshold = parseInt(req.query.threshold) || 1000; // ms
    const since     = new Date(Date.now() - hours * 60 * 60 * 1000);

    const slow = await RequestLog.aggregate([
      {
        $match: {
          timestamp:    { $gte: since },
          responseTime: { $gte: threshold },
        },
      },
      {
        $group: {
          _id:             { method: "$method", path: "$path" },
          count:           { $sum: 1 },
          avgResponseTime: { $avg:  "$responseTime" },
          maxResponseTime: { $max:  "$responseTime" },
          minResponseTime: { $min:  "$responseTime" },
          // P95 approximation — max of sorted 95th slice
          responseTimes:   { $push: "$responseTime" },
        },
      },
      {
        $project: {
          _id:    0,
          method: "$_id.method",
          path:   "$_id.path",
          count:  1,
          avgResponseTime: { $round: ["$avgResponseTime", 2] },
          maxResponseTime: 1,
          minResponseTime: 1,
        },
      },
      { $sort:  { avgResponseTime: -1 } },
      { $limit: 15 },
    ]);

    res.status(200).json({
      success: true,
      data:      slow,
      threshold,
      hours,
    });

  } catch (err) {
    console.error("[getSlowEndpoints] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 💥 3. ERROR BREAKDOWN
// GET /api/v1/logs/error-breakdown?hours=6
// ─────────────────────────────────────────────
export const getErrorBreakdown = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [errorsByEndpoint, errorsByType, recentErrors] = await Promise.all([

      // ── Which endpoints throw most errors
      RequestLog.aggregate([
        {
          $match: {
            timestamp:  { $gte: since },
            statusCode: { $gte: 400 },
          },
        },
        {
          $group: {
            _id:          { method: "$method", path: "$path", statusCode: "$statusCode" },
            count:        { $sum: 1 },
            lastOccurred: { $max: "$timestamp" },
            // ✅ Sample error message
            errorMessage: { $first: "$error.message" },
          },
        },
        {
          $project: {
            _id:          0,
            method:       "$_id.method",
            path:         "$_id.path",
            statusCode:   "$_id.statusCode",
            count:        1,
            lastOccurred: 1,
            errorMessage: 1,
          },
        },
        { $sort:  { count: -1 } },
        { $limit: 20 },
      ]),

      // ── 4xx vs 5xx counts
      RequestLog.aggregate([
        {
          $match: {
            timestamp:  { $gte: since },
            statusCode: { $gte: 400 },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $gte: ["$statusCode", 500] }, then: "5xx" },
                  { case: { $gte: ["$statusCode", 400] }, then: "4xx" },
                ],
                default: "other",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: { _id: 0, type: "$_id", count: 1 },
        },
      ]),

      // ── 10 most recent errors with full detail
      RequestLog.find({
        timestamp:  { $gte: since },
        statusCode: { $gte: 400 },
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .select("method path statusCode error timestamp userId userEmail responseTime")
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      hours,
      data: {
        errorsByEndpoint,
        errorsByType,
        recentErrors,
      },
    });

  } catch (err) {
    console.error("[getErrorBreakdown] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 🕐 4. TRAFFIC HEATMAP (hour × weekday)
// GET /api/v1/logs/traffic-heatmap?hours=6
// ─────────────────────────────────────────────
export const getTrafficHeatmap = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const raw = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            hour:    { $hour:      { date: "$timestamp", timezone: "Asia/Kolkata" } },
            weekday: { $dayOfWeek: { date: "$timestamp", timezone: "Asia/Kolkata" } },
          },
          requests:        { $sum: 1 },
          errors:          { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
      {
        $project: {
          _id:     0,
          hour:    "$_id.hour",
          weekday: "$_id.weekday",
          requests: 1,
          errors:   1,
          avgResponseTime: { $round: ["$avgResponseTime", 2] },
        },
      },
      { $sort: { weekday: 1, hour: 1 } },
    ]);

    res.status(200).json({ success: true, hours, data: raw });

  } catch (err) {
    console.error("[getTrafficHeatmap] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 🔝 5. TOP ENDPOINTS
// GET /api/v1/logs/top-endpoints?hours=6&limit=15
// ─────────────────────────────────────────────
export const getTopEndpoints = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const limit = parseInt(req.query.limit) || 15;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const top = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id:             { method: "$method", path: "$path" },
          count:           { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
          errorCount: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
          },
          successCount: {
            $sum: { $cond: [{ $lt: ["$statusCode", 400] }, 1, 0] }
          },
          uniqueUsers: { $addToSet: "$userEmail" },
        },
      },
      {
        $project: {
          _id:    0,
          method: "$_id.method",
          path:   "$_id.path",
          count:  1,
          avgResponseTime: { $round: ["$avgResponseTime", 2] },
          maxResponseTime: 1,
          errorCount:  1,
          successCount: 1,
          errorRate: {
            $cond: [
              { $gt: ["$count", 0] },
              { $round: [{ $multiply: [{ $divide: ["$errorCount", "$count"] }, 100] }, 1] },
              0,
            ],
          },
          uniqueUsers: { $size: "$uniqueUsers" },
        },
      },
      { $sort:  { count: -1 } },
      { $limit: limit },
    ]);

    res.status(200).json({ success: true, hours, data: top });

  } catch (err) {
    console.error("[getTopEndpoints] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 👥 6. TOP USERS BY REQUEST COUNT
// GET /api/v1/logs/top-users?hours=6&limit=10
// ─────────────────────────────────────────────
export const getTopUsers = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const limit = parseInt(req.query.limit) || 10;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 🔍 DEBUG — log this in console once to verify, remove after fix confirmed
    // const debug = await RequestLog.aggregate([
    //   { $match: { timestamp: { $gte: since } } },
    //   {
    //     $group: {
    //       _id:           null,
    //       total:         { $sum: 1 },
    //       withUserId:    { $sum: { $cond: [{ $gt: ['$userId',    null] }, 1, 0] } },
    //       withUserEmail: { $sum: { $cond: [{ $gt: ['$userEmail', null] }, 1, 0] } },
    //     },
    //   },
    // ]);
    // console.log('[getTopUsers] field audit:', JSON.stringify(debug));
    // Expected: withUserId << withUserEmail (confirms the bug)

    const top = await RequestLog.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          userEmail: { $exists: true, $ne: null }, // ✅ userEmail is always reliable
        },
      },
      {
        $group: {
          _id:             '$userEmail',   // ✅ group by email, not userId
          userId:          { $first: '$userId' },
          userEmail:       { $first: '$userEmail' },
          totalRequests:   { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          errorCount: {
            $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
          },
          uniquePaths: { $addToSet: '$path' },      // ✅ unique set
          uniqueIPs:   { $addToSet: '$ipAddress' },
          lastActive:  { $max: '$timestamp' },
        },
      },
      {
        $project: {
          _id:             0,
          userId:          1,
          userEmail:       1,
          totalRequests:   1,
          errorCount:      1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          lastActive:      1,
          uniqueIPs:       { $size: '$uniqueIPs' },
          pathCount:       { $size: '$uniquePaths' }, // ✅ unique paths count
        },
      },
      { $sort:  { totalRequests: -1 } },
      { $limit: limit },
    ]);

    res.status(200).json({ success: true, hours, data: top });

  } catch (err) {
    console.error('[getTopUsers] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 🚨 7. SUSPICIOUS ACTIVITY DETECTION
// GET /api/v1/logs/suspicious?hours=6
// ─────────────────────────────────────────────
export const getSuspiciousActivity = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // ── Thresholds
    const HIGH_FREQ_THRESHOLD  = 200; // requests per IP
    const ABUSE_401_THRESHOLD  = 10;  // 401s per IP
    const ABUSE_404_THRESHOLD  = 20;  // 404s per IP
    const RPM_SPIKE_THRESHOLD  = 30;  // requests per minute from single IP

    const [
      highFreqIPs,
      abuse401IPs,
      abuse404IPs,
      rpmSpikes,
      suspiciousPaths,
    ] = await Promise.all([

      // ── 1. High frequency IPs (too many requests total)
      RequestLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id:           "$ipAddress",
            totalRequests: { $sum: 1 },
            uniquePaths:   { $addToSet: "$path" },
            uniqueUsers:   { $addToSet: "$userEmail" },
            errorCount: {
              $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
            },
            firstSeen: { $min: "$timestamp" },
            lastSeen:  { $max: "$timestamp" },
          },
        },
        { $match: { totalRequests: { $gte: HIGH_FREQ_THRESHOLD } } },
        {
          $project: {
            _id:           0,
            ipAddress:     "$_id",
            totalRequests: 1,
            uniquePaths:   { $size: "$uniquePaths" },
            uniqueUsers:   { $size: "$uniqueUsers" },
            errorCount:    1,
            firstSeen:     1,
            lastSeen:      1,
            // ✅ Time window in minutes
            windowMinutes: {
              $round: [
                { $divide: [
                  { $subtract: ["$lastSeen", "$firstSeen"] },
                  60000
                ]},
                1
              ]
            },
          },
        },
        { $sort: { totalRequests: -1 } },
        { $limit: 20 },
      ]),

      // ── 2. 401 Abuse (repeated unauthorized — credential stuffing / brute force)
      RequestLog.aggregate([
        {
          $match: {
            timestamp:  { $gte: since },
            statusCode: 401,
          },
        },
        {
          $group: {
            _id:      "$ipAddress",
            count:    { $sum: 1 },
            paths:    { $addToSet: "$path" },
            users:    { $addToSet: "$userEmail" },
            lastSeen: { $max: "$timestamp" },
          },
        },
        { $match: { count: { $gte: ABUSE_401_THRESHOLD } } },
        {
          $project: {
            _id:      0,
            ipAddress:"$_id",
            count:    1,
            uniquePaths: { $size: "$paths" },
            attemptedUsers: "$users",
            lastSeen: 1,
            threat:   "BRUTE_FORCE",
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ── 3. 404 Scanners (path enumeration / scraping)
      RequestLog.aggregate([
        {
          $match: {
            timestamp:  { $gte: since },
            statusCode: 404,
          },
        },
        {
          $group: {
            _id:   "$ipAddress",
            count: { $sum: 1 },
            paths: { $addToSet: "$path" },
            lastSeen: { $max: "$timestamp" },
          },
        },
        { $match: { count: { $gte: ABUSE_404_THRESHOLD } } },
        {
          $project: {
            _id:         0,
            ipAddress:   "$_id",
            count:       1,
            uniquePaths: { $size: "$paths" },
            samplePaths: { $slice: ["$paths", 5] },
            lastSeen:    1,
            threat:      "PATH_SCANNING",
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ── 4. RPM Spikes — per IP per minute
      RequestLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: {
              ip:     "$ipAddress",
              minute: {
                $dateToString: {
                  format:   "%Y-%m-%dT%H:%M",
                  date:     "$timestamp",
                  timezone: "Asia/Kolkata",
                },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gte: RPM_SPIKE_THRESHOLD } } },
        {
          $project: {
            _id:       0,
            ipAddress: "$_id.ip",
            minute:    "$_id.minute",
            rpm:       "$count",
          },
        },
        { $sort:  { rpm: -1 } },
        { $limit: 20 },
      ]),

      // ── 5. Suspicious paths (common attack vectors)
      RequestLog.aggregate([
        {
          $match: {
            timestamp:  { $gte: since },
            statusCode: { $gte: 400 },
            path: {
              $regex:
                /wp-admin|\.env|\.git|phpmy|admin\.php|config\.php|shell|eval\(|base64/i,
            },
          },
        },
        {
          $group: {
            _id:   { path: "$path", ip: "$ipAddress" },
            count: { $sum: 1 },
            lastSeen: { $max: "$timestamp" },
          },
        },
        {
          $project: {
            _id:       0,
            path:      "$_id.path",
            ipAddress: "$_id.ip",
            count:     1,
            lastSeen:  1,
            threat:    "ATTACK_PROBE",
          },
        },
        { $sort:  { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    // ── Build risk summary
    const riskScore = Math.min(
      100,
      highFreqIPs.length * 5 +
      abuse401IPs.length * 15 +
      abuse404IPs.length * 10 +
      rpmSpikes.length * 8 +
      suspiciousPaths.length * 20
    );

    const riskLevel =
      riskScore >= 70 ? "HIGH" :
      riskScore >= 30 ? "MEDIUM" : "LOW";

    res.status(200).json({
      success: true,
      hours,
      riskScore,
      riskLevel,
      data: {
        highFreqIPs,
        abuse401IPs,
        abuse404IPs,
        rpmSpikes,
        suspiciousPaths,
        summary: {
          totalSuspiciousIPs: new Set([
            ...highFreqIPs.map(x => x.ipAddress),
            ...abuse401IPs.map(x => x.ipAddress),
            ...abuse404IPs.map(x => x.ipAddress),
          ]).size,
          bruteForceAttempts: abuse401IPs.reduce((s, x) => s + x.count, 0),
          pathScanAttempts:   abuse404IPs.reduce((s, x) => s + x.count, 0),
          peakRPM: rpmSpikes[0]?.rpm ?? 0,
          attackProbes: suspiciousPaths.length,
        },
      },
    });

  } catch (err) {
    console.error("[getSuspiciousActivity] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────
// 📱 8. DEVICE INTELLIGENCE
// GET /api/v1/logs/device-intelligence?hours=6
// ─────────────────────────────────────────────
export const getDeviceIntelligence = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [deviceBreakdown, browserBreakdown, osBreakdown, mobileVsDesktop] =
      await Promise.all([

        // ── Device type (Desktop / Mobile / Tablet)
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since }, "deviceInfo.device": { $ne: null } } },
          { $group: { _id: "$deviceInfo.device", count: { $sum: 1 } } },
          { $project: { _id: 0, device: "$_id", count: 1 } },
          { $sort: { count: -1 } },
        ]),

        // ── Browser breakdown
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since }, "deviceInfo.browser": { $ne: null } } },
          {
            $group: {
              _id:    "$deviceInfo.browser",
              count:  { $sum: 1 },
              errors: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
              avgResponseTime: { $avg: "$responseTime" },
            },
          },
          {
            $project: {
              _id:     0,
              browser: "$_id",
              count:   1,
              errors:  1,
              avgResponseTime: { $round: ["$avgResponseTime", 2] },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // ── OS breakdown
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since }, "deviceInfo.os": { $ne: null } } },
          { $group: { _id: "$deviceInfo.os", count: { $sum: 1 } } },
          { $project: { _id: 0, os: "$_id", count: 1 } },
          { $sort: { count: -1 } },
        ]),

        // ── Mobile vs Desktop ratio
        RequestLog.aggregate([
          { $match: { timestamp: { $gte: since } } },
          {
            $group: {
              _id:   null,
              total: { $sum: 1 },
              mobile: {
                $sum: { $cond: [{ $eq: ["$deviceInfo.isMobile", true] }, 1, 0] }
              },
              desktop: {
                $sum: { $cond: [{ $eq: ["$deviceInfo.isMobile", false] }, 1, 0] }
              },
            },
          },
          {
            $project: {
              _id:     0,
              total:   1,
              mobile:  1,
              desktop: 1,
              mobilePct: {
                $round: [{ $multiply: [{ $divide: ["$mobile", "$total"] }, 100] }, 1]
              },
              desktopPct: {
                $round: [{ $multiply: [{ $divide: ["$desktop", "$total"] }, 100] }, 1]
              },
            },
          },
        ]),
      ]);

    // ── Compute percentages for device + browser
    const totalRequests = deviceBreakdown.reduce((s, d) => s + d.count, 0) || 1;

    const deviceWithPct = deviceBreakdown.map(d => ({
      ...d,
      percentage: parseFloat(((d.count / totalRequests) * 100).toFixed(1)),
    }));

    const totalBrowser = browserBreakdown.reduce((s, b) => s + b.count, 0) || 1;
    const browserWithPct = browserBreakdown.map(b => ({
      ...b,
      percentage: parseFloat(((b.count / totalBrowser) * 100).toFixed(1)),
    }));

    res.status(200).json({
      success: true,
      hours,
      data: {
        deviceBreakdown:  deviceWithPct,
        browserBreakdown: browserWithPct,
        osBreakdown,
        mobileVsDesktop:  mobileVsDesktop[0] || {},
        // ✅ Key insight for UI decisions
        insight: buildDeviceInsight(mobileVsDesktop[0], browserBreakdown[0]),
      },
    });

  } catch (err) {
    console.error("[getDeviceIntelligence] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

function buildDeviceInsight(ratio, topBrowser) {
  if (!ratio) return "Not enough data yet.";
  const dominant = ratio.mobilePct > 60 ? "mobile-first" : "desktop-first";
  return `Traffic is ${dominant} (${ratio.mobilePct}% mobile). `
    + `Top browser: ${topBrowser?.browser ?? "Unknown"} at ${topBrowser?.count ?? 0} requests.`;
}


// ─────────────────────────────────────────────
// 👤 9. USER BEHAVIOR SIGNALS
// GET /api/v1/logs/user-behavior?hours=6
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 👤 9. USER BEHAVIOR SIGNALS — FIXED
// GET /api/v1/logs/user-behavior?hours=6
// ─────────────────────────────────────────────
export const getUserBehaviorSignals = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 6;
    const limit = parseInt(req.query.limit) || 10;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      anonVsAuth,
      abuseSignals,
      topActiveUsers,
      perUserStats,
    ] = await Promise.all([

      // ── 1. Anonymous vs Authenticated ratio
      // ✅ Use userEmail instead of userId (userId is null even for auth users)
      RequestLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id:   null,
            total: { $sum: 1 },
            authenticated: {
              $sum: { $cond: [{ $ne: ['$userEmail', null] }, 1, 0] } // ✅
            },
            anonymous: {
              $sum: { $cond: [{ $eq: ['$userEmail', null] }, 1, 0] } // ✅
            },
          },
        },
        {
          $project: {
            _id:           0,
            total:         1,
            authenticated: 1,
            anonymous:     1,
            authPct: {
              $round: [{ $multiply: [{ $divide: ['$authenticated', '$total'] }, 100] }, 1],
            },
            anonPct: {
              $round: [{ $multiply: [{ $divide: ['$anonymous', '$total'] }, 100] }, 1],
            },
          },
        },
      ]),

      // ── 2. Abuse signals — users with very high error rates
      // ✅ Group by userEmail, filter by userEmail
      RequestLog.aggregate([
        {
          $match: {
            timestamp: { $gte: since },
            userEmail: { $exists: true, $ne: null }, // ✅ was: userId: { $ne: null }
          },
        },
        {
          $group: {
            _id:           '$userEmail',             // ✅ was: "$userId"
            userEmail:     { $first: '$userEmail' },
            userId:        { $first: '$userId' },    // keep if present
            totalRequests: { $sum: 1 },
            errorCount: {
              $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
            },
            count401: {
              $sum: { $cond: [{ $eq: ['$statusCode', 401] }, 1, 0] },
            },
            count403: {
              $sum: { $cond: [{ $eq: ['$statusCode', 403] }, 1, 0] },
            },
            uniquePaths: { $addToSet: '$path' },
            lastActive:  { $max: '$timestamp' },
          },
        },
        {
          $addFields: {
            errorRate: {
              $cond: [
                { $gt: ['$totalRequests', 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ['$errorCount', '$totalRequests'] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $match: {
            errorRate:     { $gte: 30 },
            totalRequests: { $gte: 10 },
          },
        },
        {
          $project: {
            _id:           0,
            userId:        1,
            userEmail:     1,
            totalRequests: 1,
            errorCount:    1,
            errorRate:     1,
            count401:      1,
            count403:      1,
            uniquePaths:   { $size: '$uniquePaths' },
            lastActive:    1,
          },
        },
        { $sort:  { errorRate: -1 } },
        { $limit: 10 },
      ]),

      // ── 3. Most active users (top N)
      // ✅ Group by userEmail, filter by userEmail
      RequestLog.aggregate([
        {
          $match: {
            timestamp: { $gte: since },
            userEmail: { $exists: true, $ne: null }, // ✅
          },
        },
        {
          $group: {
            _id:             '$userEmail',           // ✅
            userEmail:       { $first: '$userEmail' },
            userId:          { $first: '$userId' },
            totalRequests:   { $sum: 1 },
            uniquePaths:     { $addToSet: '$path' },
            lastActive:      { $max: '$timestamp' },
            avgResponseTime: { $avg: '$responseTime' },
          },
        },
        {
          $project: {
            _id:             0,
            userId:          1,
            userEmail:       1,
            totalRequests:   1,
            uniquePaths:     { $size: '$uniquePaths' },
            lastActive:      1,
            avgResponseTime: { $round: ['$avgResponseTime', 2] },
          },
        },
        { $sort:  { totalRequests: -1 } },
        { $limit: limit },
      ]),

      // ── 4. Per-user distribution (for abuse pattern detection)
      // ✅ Group by userEmail, filter by userEmail
      RequestLog.aggregate([
        {
          $match: {
            timestamp: { $gte: since },
            userEmail: { $exists: true, $ne: null }, // ✅
          },
        },
        {
          $group: {
            _id:           '$userEmail',             // ✅
            totalRequests: { $sum: 1 },
          },
        },
        {
          $group: {
            _id:          null,
            avgPerUser:   { $avg: '$totalRequests' },
            maxPerUser:   { $max: '$totalRequests' },
            minPerUser:   { $min: '$totalRequests' },
            totalUsers:   { $sum: 1 },
            highActivity: {
              $sum: {
                $cond: [{ $gte: ['$totalRequests', 50] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id:          0,
            avgPerUser:   { $round: ['$avgPerUser', 1] },
            maxPerUser:   1,
            minPerUser:   1,
            totalUsers:   1,
            highActivity: 1,
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      hours,
      data: {
        anonVsAuth:     anonVsAuth[0] || {},
        abuseSignals,
        topActiveUsers,
        distribution:   perUserStats[0] || {},
      },
    });

  } catch (err) {
    console.error('[getUserBehaviorSignals] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

