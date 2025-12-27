import LoginLog from '../MODELS/LoginLog.model.js';
import { getUserLoginHistory, getLoginStats } from '../services/loginLog.service.js';
// import Apperror from '../UTIL/Apperror.js';

/**
 * Get current user's login history
 */
export const getMyLoginHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const history = await LoginLog.find({
      userId,
      status: 'success'
    })
      .sort({ loginTime: -1 })
      .limit(limit)
      .select('-userAgent'); // Hide raw user agent

    res.json({
      success: true,
      data: history,
      message: 'Login history retrieved'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin login stats
 */
export const getLoginAnalytics = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await getLoginStats(days);

    res.json({
      success: true,
      data: stats,
      message: 'Login analytics retrieved'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all login logs (Admin only)
 */
export const getAllLoginLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'success';
    const userId = req.query.userId;

    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const logs = await LoginLog.find(query)
      .populate('userId', 'fullName email')
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limit)
      .select('-userAgent');

    const total = await LoginLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get login activity by device
 */
export const getLoginsByDevice = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const dateAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await LoginLog.aggregate([
      {
        $match: {
          loginTime: { $gte: dateAgo },
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$device',
          count: { $sum: 1 },
          lastLogin: { $max: '$loginTime' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get login activity by browser
 */
export const getLoginsByBrowser = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const dateAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await LoginLog.aggregate([
      {
        $match: {
          loginTime: { $gte: dateAgo },
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$browser.name',
          count: { $sum: 1 },
          lastLogin: { $max: '$loginTime' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get suspicious login attempts
 */
export const getSuspiciousLogins = async (req, res, next) => {
  try {
    const logs = await LoginLog.find({
      status: 'failed',
      loginTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .populate('userId', 'fullName email')
      .sort({ loginTime: -1 })
      .limit(50);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unique IPs for user
 */
export const getUserIPs = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const ips = await LoginLog.aggregate([
      {
        $match: {
          userId: userId,
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          count: { $sum: 1 },
          lastLogin: { $max: '$loginTime' },
          browser: { $first: '$browser.name' },
          os: { $first: '$os.name' },
          device: { $first: '$device' },
          location: { $first: '$location' }
        }
      },
      { $sort: { lastLogin: -1 } }
    ]);

    res.json({
      success: true,
      data: ips
    });
  } catch (error) {
    next(error);
  }
};
