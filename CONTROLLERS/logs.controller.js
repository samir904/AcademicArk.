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
