// CONTROLLERS/admin.controller.js
import User from '../MODELS/user.model.js';
import Note from '../MODELS/note.model.js';
import mongoose from 'mongoose';
import Apperror from '../UTIL/error.util.js';
import serverMetrics from '../UTIL/serverMetrics.js';
import sessionTracker from '../UTIL/sessionTracker.js';
import SessionLog from '../MODELS/SessionLog.model.js';
import AdminLog from '../MODELS/adminLog.model.js';
import UserCohort from '../MODELS/UserCohort.model.js';
// import SessionLog from '../MODELS/SessionLog.model.js';

// ✅ CORRECTED: Helper function to create admin logs
async function createAdminLog(logData) {
    try {
        // Make sure all required fields are present
        if (!logData.adminId || !logData.adminName) {
            console.warn('Missing admin info for log:', logData);
            return;
        }
        await AdminLog.create(logData);
    } catch (error) {
        console.error('Error creating admin log:', error);
    }
}


export const getDashboardStats = async (req, res, next) => {
    try {
        // Get total counts
        const totalUsers = await User.countDocuments();
        const totalNotes = await Note.countDocuments();
        const totalDownloads = await Note.aggregate([
            { $group: { _id: null, total: { $sum: '$downloads' } } }
        ]);

        // Get user distribution by role
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // Get notes by category
        const notesByCategory = await Note.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        // Get notes by semester
        const notesBySemester = await Note.aggregate([
            { $group: { _id: '$semester', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Get top rated notes
        const topRatedNotes = await Note.aggregate([
            {
                $addFields: {
                    avgRating: { $avg: '$rating.rating' },
                    ratingCount: { $size: '$rating' }
                }
            },
            { $match: { ratingCount: { $gt: 0 } } },
            { $sort: { avgRating: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'uploadedBy',
                    foreignField: '_id',
                    as: 'uploadedBy'
                }
            },
            { $unwind: '$uploadedBy' },
            {
                $project: {
                    title: 1,
                    avgRating: 1,
                    ratingCount: 1,
                    downloads: 1,
                    'uploadedBy.fullName': 1
                }
            }
        ]);

        // Get recent registrations (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            message: 'Dashboard stats retrieved successfully',
            data: {
                totalUsers,
                totalNotes,
                totalDownloads: totalDownloads[0]?.total || 0,
                recentUsers,
                usersByRole,
                notesByCategory,
                notesBySemester,
                topRatedNotes
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return next(new Apperror('Failed to get dashboard stats', 500));
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const searchQuery = search ? {
            $or: [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const users = await User.find(searchQuery)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: {
                users,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalUsers / limit),
                    totalUsers
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        return next(new Apperror('Failed to get users', 500));
    }
};

export const getAllNotes = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const searchQuery = search ? {
            $or: [
                { title: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const notes = await Note.find(searchQuery)
            .populate('uploadedBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalNotes = await Note.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            message: 'Notes retrieved successfully',
            data: {
                notes,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalNotes / limit),
                    totalNotes
                }
            }
        });
    } catch (error) {
        console.error('Get notes error:', error);
        return next(new Apperror('Failed to get notes', 500));
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid user ID', 400));
        }

        const user = await User.findById(id);
        if (!user) {
            return next(new Apperror('User not found', 404));
        }

        // Delete user's notes first
        await Note.deleteMany({ uploadedBy: id });

        // Then delete user
        await User.findByIdAndDelete(id);
        // ✅ Log the action
       // ✅ CORRECTED: Check if res.locals.adminLog exists before using it
        if (res.locals.adminLog) {
            await createAdminLog({
                ...res.locals.adminLog,
                targetId: id,
                targetName: user.fullName,
                status: 'SUCCESS'
            });
        } else {
            console.warn('adminLog not available for deleteUser');
        }
        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        // ✅ CORRECTED: Log failures too
        if (res.locals.adminLog) {
            await createAdminLog({
                ...res.locals.adminLog,
                targetId: req.params.id,
                status: 'FAILED',
                errorMessage: error.message
            });
        }

        return next(new Apperror('Failed to delete user', 500));
    }
};

export const deleteNote = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid note ID', 400));
        }

        const note = await Note.findByIdAndDelete(id);
        if (!note) {
            return next(new Apperror('Note not found', 404));
        }

        // ✅ CORRECTED: Use note title, not user fullName
        if (res.locals.adminLog) {
            await createAdminLog({
                ...res.locals.adminLog,
                targetId: id,
                targetName: note.title,  // ✅ FIXED: was user?.fullName (undefined)
                status: 'SUCCESS'
            });
        } else {
            console.warn('adminLog not available for deleteNote');
        }

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Delete note error:', error);
        return next(new Apperror('Failed to delete note', 500));
    }
};

// ✅ CORRECTED: updateUserRole with proper logging
export const updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror('Invalid user ID', 400));
        }

        if (!['USER', 'TEACHER', 'ADMIN'].includes(role)) {
            return next(new Apperror('Invalid role', 400));
        }

        // ✅ CORRECTED: Get old role BEFORE update
        const user = await User.findById(id);
        const oldRole = user?.role;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return next(new Apperror('User not found', 404));
        }

        // ✅ CORRECTED: Log with old and new role
        if (res.locals.adminLog) {
            await createAdminLog({
                ...res.locals.adminLog,
                targetId: id,
                targetName: updatedUser.fullName,
                details: {
                    oldValue: { role: oldRole },
                    newValue: { role: updatedUser.role }
                },
                status: 'SUCCESS'
            });
        } else {
            console.warn('adminLog not available for updateUserRole');
        }

        res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: updatedUser
        });
    } catch (error) {
        console.error('Update user role error:', error);
        return next(new Apperror('Failed to update user role', 500));
    }
};
export const getRecentActivity = async (req, res, next) => {
    try {
        // Get recent users (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const recentUsers = await User.find({
            createdAt: { $gte: sevenDaysAgo }
        })
            .select('fullName email createdAt')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent notes (last 7 days)
        const recentNotes = await Note.find({
            createdAt: { $gte: sevenDaysAgo }
        })
            .populate('uploadedBy', 'fullName')
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            success: true,
            message: 'Recent activity retrieved successfully',
            data: {
                recentUsers,
                recentNotes
            }
        });
    } catch (error) {
        console.error('Get recent activity error:', error);
        return next(new Apperror('Failed to get recent activity', 500));
    }
};

export const getServerMetrics = async (req, res, next) => {
    try {
        const metrics = await serverMetrics.getMetrics();

        res.status(200).json({
            success: true,
            message: 'Server metrics retrieved successfully',
            data: metrics
        })
    } catch (err) {
        console.error('server metrics error', err);
        return next(new Apperror('Failed to get server metrics', 500));
    }
}

export const getSessionMetrics=async(req,res,next)=>{
    
        const metrics=sessionTracker.getMetrics();

        //get user details for active users
        const activeUserDetails=await User.find({
            _id:{$in: metrics.activeUsers}//what is this line meaning what is metrics.activeusers
        }).select('fullName email avatar role');

    res.status(200).json({
        success: true,
        message: 'session metrics retrieved successfully',
        data: {
            ...metrics,
            activeUserDetails
        }
    });

}

// Get session history (last 30 days)
export const getSessionHistory = async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const history = await SessionLog.find({
            date: { $gte: startDate }
        }).sort({ date: 1 });

        res.status(200).json({
            success: true,
            message: 'Session history retrieved successfully',
            data: history
        });
    } catch (error) {
        console.error('Session history error:', error);
        return next(new Apperror('Failed to get session history', 500));
    }
};


/// Get weekly comparison
export const getWeeklyComparison = async (req, res, next) => {
    try {
        const thisWeekStart = new Date();
        thisWeekStart.setDate(thisWeekStart.getDate() - 7);
        thisWeekStart.setHours(0, 0, 0, 0);

        const lastWeekStart = new Date();
        lastWeekStart.setDate(lastWeekStart.getDate() - 14);
        lastWeekStart.setHours(0, 0, 0, 0);
        
        const thisWeek = await SessionLog.find({
            date: { $gte: thisWeekStart }
        });
        
        const lastWeek = await SessionLog.find({
            date: { $gte: lastWeekStart, $lt: thisWeekStart }
        });
        
        const thisWeekAvg = thisWeek.length > 0
            ? thisWeek.reduce((sum, day) => sum + day.maxConcurrent, 0) / thisWeek.length
            : 0;
            
        const lastWeekAvg = lastWeek.length > 0
            ? lastWeek.reduce((sum, day) => sum + day.maxConcurrent, 0) / lastWeek.length
            : 0;

        const growth = lastWeekAvg > 0
            ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100
            : 0;

        res.status(200).json({
            success: true,
            message: 'Weekly comparison retrieved successfully',
            data: {
                thisWeekAvg: Math.round(thisWeekAvg),
                lastWeekAvg: Math.round(lastWeekAvg),
                growth: growth.toFixed(2),
                thisWeekData: thisWeek,
                lastWeekData: lastWeek
            }
        });
    } catch (error) {
        console.error('Weekly comparison error:', error);
        return next(new Apperror('Failed to get weekly comparison', 500));
    }
};

// Get traffic pattern by day of week
export const getTrafficPattern = async (req, res, next) => {
    try {
        const pattern = await SessionLog.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: '$date' },
                    avgPeak: { $avg: '$maxConcurrent' },
                    avgConcurrent: { $avg: '$avgConcurrent' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        const formattedPattern = pattern.map(day => ({
            day: dayNames[day._id - 1],
            avgPeak: Math.round(day.avgPeak),
            avgConcurrent: Math.round(day.avgConcurrent),
            dataPoints: day.count
        }));
        
        res.status(200).json({
            success: true,
            message: 'Traffic pattern retrieved successfully',
            data: formattedPattern
        });
    } catch (error) {
        console.error('Traffic pattern error:', error);
        return next(new Apperror('Failed to get traffic pattern', 500));
    }
};

export const getAdminLogs = async (req, res, next) => {
    try {
        const { days = 7, action, page = 1, limit = 20 } = req.query;
        
        const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        let query = { timestamp: { $gte: daysAgo } };
        if (action) query.action = action;
        
        const logs = await AdminLog.find(query)
            .populate('adminId', 'fullName email')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await AdminLog.countDocuments(query);
        
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
        return next(error);
    }
};
// Get overall retention metrics
export const getRetentionMetrics = async (req, res, next) => {
  try {
    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Last month start and end
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    lastMonthStart.setHours(0, 0, 0, 0);
    
    const lastMonthEnd = new Date(currentYear, currentMonth, 1);
    lastMonthEnd.setHours(0, 0, 0, 0);
    
    console.log('📅 Date Range:');
    console.log('Start:', lastMonthStart.toISOString());
    console.log('End:', lastMonthEnd.toISOString());
    
    // Users at start of month
    const usersStartOfMonth = await User.countDocuments({
      createdAt: { $lt: lastMonthStart }
    });
    
    console.log('👥 Users at month start:', usersStartOfMonth);
    
    // New users in month
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd }
    });
    
    console.log('⭐ New users this month:', newUsersThisMonth);
    
    // Active users in month (from SessionLog)
    let activeUsersCount = 0;
    
    // Check if SessionLog collection has data
    const sessionCount = await SessionLog.countDocuments();
    console.log('📊 Total SessionLogs:', sessionCount);
    
    if (sessionCount > 0) {
      // Try to get active users
      const activeUsersResult = await SessionLog.aggregate([
        {
          $match: {
            date: { $gte: lastMonthStart, $lt: lastMonthEnd }
          }
        },
        {
          $group: {
            _id: null,
            uniqueUsers: { $addToSet: '$userId' }
          }
        }
      ]);
      
      console.log('Active users result:', activeUsersResult);
      
      // ✅ FIX: Safely extract count
      if (activeUsersResult && activeUsersResult.length > 0 && activeUsersResult.uniqueUsers) {
        activeUsersCount = activeUsersResult.uniqueUsers.length;
      }
    }
    
    console.log('💼 Active users:', activeUsersCount);
    
    // Calculate retention rate
    let retentionRate = '0';
    if (usersStartOfMonth > 0) {
      const retained = activeUsersCount - newUsersThisMonth;
      const rate = (retained / usersStartOfMonth) * 100;
      retentionRate = Math.max(0, rate).toFixed(2); // Prevent negative
    }
    
    // Get churn rate
    const churnRate = Math.min(100, (100 - parseFloat(retentionRate))).toFixed(2);
    
    // Get cohorts
    const cohorts = await UserCohort.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    
    // ✅ FIX: Safely map cohorts with fallbacks
    const formattedCohorts = cohorts.map(c => ({
      _id: c._id,
      name: c.cohortName || c.name || 'Unknown',
      totalUsers: c.totalUsers || 0,
      week0: c.retention?.week0 || c.week0 || 100,
      week1: c.retention?.week1 || c.week1 || 0,
      week2: c.retention?.week2 || c.week2 || 0,
      month1: c.retention?.month1 || c.month1 || 0,
      month3: c.retention?.month3 || c.month3 || 0
    }));
    
    const responseData = {
      retentionRate: `${retentionRate}%`,
      churnRate: `${churnRate}%`,
      usersStartOfMonth,
      newUsersThisMonth,
      activeUsersThisMonth: activeUsersCount,
      cohorts: formattedCohorts
    };
    
    console.log('✅ Final response:', responseData);
    
    res.status(200).json({
      success: true,
      message: 'Retention metrics retrieved successfully',
      data: responseData
    });
  } catch (error) {
    console.error('❌ Retention metrics error:', error);
    console.error('Stack:', error.stack);
    return next(new Apperror('Failed to get retention metrics', 500));
  }
};

// Get user churn analysis
export const getChurnAnalysis = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    console.log('📅 Churn analysis period:', days, 'days');
    console.log('Start date:', startDate.toISOString());
    
    // Get active users in this period
    let activeUsers = [];
    const sessionCount = await SessionLog.countDocuments();
    
    if (sessionCount > 0) {
      activeUsers = await SessionLog.find({
        date: { $gte: startDate }
      }).distinct('userId');
    }
    
    activeUsers = activeUsers || [];
    console.log('👥 Active users:', activeUsers.length);
    
    // Get total users (created before this period)
    const totalUsers = await User.countDocuments({
      createdAt: { $lt: startDate }
    });
    
    console.log('📊 Total users:', totalUsers);
    
    // Calculate churn
    let churnedUsers = 0;
    let churnRate = '0';
    
    if (totalUsers > 0) {
      churnedUsers = totalUsers - activeUsers.length;
      churnRate = ((churnedUsers / totalUsers) * 100).toFixed(2);
    }
    
    console.log('❌ Churned users:', churnedUsers);
    console.log('📉 Churn rate:', churnRate, '%');
    
    // Get at-risk users (inactive for 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);
    
    let atRiskUsers = [];
    
    if (sessionCount > 0) {
      const atRiskResult = await SessionLog.aggregate([
        {
          $match: {
            date: { $gte: threeDaysAgo }
          }
        },
        {
          $group: {
            _id: '$userId',
            lastActive: { $max: '$date' }
          }
        },
        {
          $match: {
            lastActive: { $lt: threeDaysAgo }
          }
        }
      ]);
      
      atRiskUsers = atRiskResult || [];
    }
    
    console.log('⚠️ At-risk users:', atRiskUsers.length);
    
    const responseData = {
      period: `${days} days`,
      totalUsers,
      activeUsers: activeUsers.length,
      churnedUsers,
      churnRate: `${churnRate}%`,
      atRiskCount: atRiskUsers.length,
      atRiskUsers: atRiskUsers.map(u => u._id)
    };
    
    console.log('✅ Churn analysis response:', responseData);
    
    res.status(200).json({
      success: true,
      message: 'Churn analysis retrieved successfully',
      data: responseData
    });
  } catch (error) {
    console.error('❌ Churn analysis error:', error);
    return next(new Apperror('Failed to get churn analysis', 500));
  }
};

// Get user lifetime value (LTV) estimate
export const getUserLifetimeValue = async (req, res, next) => {
  try {
    // Calculate average session duration
    let avgSessionDuration = 0;
    const sessionCount = await SessionLog.countDocuments();
    
    if (sessionCount > 0) {
      const avgSessionResult = await SessionLog.aggregate([
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$sessionDuration' }
          }
        }
      ]);
      
      if (avgSessionResult && avgSessionResult.length > 0) {
        avgSessionDuration = avgSessionResult.avgDuration || 0;
      }
    }
    
    console.log('⏱️ Average session duration:', avgSessionDuration);
    
    // Calculate average engagement (downloads per note)
    let avgEngagement = 0;
    const noteCount = await Note.countDocuments();
    
    if (noteCount > 0) {
      const totalDownloads = await Note.aggregate([
        {
          $group: {
            _id: null,
            totalDownloads: { $sum: '$downloads' }
          }
        }
      ]);
      
      if (totalDownloads && totalDownloads.length > 0) {
        avgEngagement = (totalDownloads.totalDownloads || 0) / noteCount;
      }
    }
    
    console.log('📊 Average engagement:', avgEngagement);
    
    // Calculate average user lifetime
    let avgUserLifetime = 0;
    const userCount = await User.countDocuments();
    
    if (userCount > 0) {
      const userLifetimesResult = await User.aggregate([
        {
          $lookup: {
            from: 'sessionlogs',
            localField: '_id',
            foreignField: 'userId',
            as: 'sessions'
          }
        },
        {
          $addFields: {
            lifetime: {
              $cond: [
                { $gt: [{ $size: '$sessions' }, 0] },
                {
                  $divide: [
                    {
                      $subtract: [
                        { $max: '$sessions.date' },
                        '$createdAt'
                      ]
                    },
                    1000 * 60 * 60 * 24 // Convert to days
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgLifetime: { $avg: '$lifetime' }
          }
        }
      ]);
      
      if (userLifetimesResult && userLifetimesResult.length > 0) {
        avgUserLifetime = userLifetimesResult.avgLifetime || 0;
      }
    }
    
    console.log('📅 Average user lifetime:', avgUserLifetime);
    
    // ✅ FIX: Ensure all values are numbers
    const responseData = {
      avgSessionDuration: Number(avgSessionDuration) || 0,
      avgEngagement: Number(avgEngagement) || 0,
      avgUserLifetime: Number(avgUserLifetime) || 0,
      estimatedLTV: 'Custom calculation based on your monetization model'
    };
    
    console.log('✅ LTV response:', responseData);
    
    res.status(200).json({
      success: true,
      message: 'User LTV retrieved successfully',
      data: responseData
    });
  } catch (error) {
    console.error('❌ LTV error:', error);
    return next(new Apperror('Failed to get LTV', 500));
  }
};
