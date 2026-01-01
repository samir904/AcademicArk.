import UserRetentionMilestone from "../MODELS/userRetentionMilestone.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import CohortAnalysis from "../MODELS/cohortAnalysis.model.js";
import Apperror from "../UTIL/error.util.js";

/**
 * GET RETENTION DATA FOR SPECIFIC USER
 * Shows all milestones and metrics
 */
export const getUserRetentionData = async (req, res, next) => {
    const { userId } = req.params;

    try {
        const retentionData = await UserRetentionMilestone.findOne({ userId })
            .populate('userId', 'fullName email avatar');

        if (!retentionData) {
            return next(new Apperror("Retention data not found", 404));
        }

        res.status(200).json({
            success: true,
            message: "Retention data fetched",
            data: {
                user: retentionData.userId,
                registrationDate: retentionData.registrationDate,
                milestones: retentionData.milestones,
                metrics: retentionData.metrics,
                retentionStatus: retentionData.retentionStatus,
                churnProbability: retentionData.churnProbability
            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET RETENTION FUNNEL (Conversion Rates)
 * Shows what % of users complete each milestone
 */
export const getRetentionFunnel = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.registrationDate = {};
            if (startDate) query.registrationDate.$gte = new Date(startDate);
            if (endDate) query.registrationDate.$lte = new Date(endDate);
        }

        const allUsers = await UserRetentionMilestone.find(query).lean();
        const totalUsers = allUsers.length;

        if (totalUsers === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalUsers: 0,
                    funnel: []
                }
            });
        }

        // Count milestone completions
        const funnel = [
            {
                stage: 1,
                name: "Registration",
                usersCompleted: totalUsers,
                percentage: 100,
                description: "Users who registered"
            },
            {
                stage: 2,
                name: "First Login",
                usersCompleted: allUsers.filter(u => u.milestones.firstLogin?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.firstLogin?.completed).length / totalUsers) * 100,
                description: "Users who logged in after registration",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.firstLogin?.completed)
                        .map(u => u.milestones.firstLogin?.daysSinceRegistration)
                )
            },
            {
                stage: 3,
                name: "Profile Completed",
                usersCompleted: allUsers.filter(u => u.milestones.profileCompleted?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.profileCompleted?.completed).length / totalUsers) * 100,
                description: "Users who completed their profile",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.profileCompleted?.completed)
                        .map(u => u.milestones.profileCompleted?.daysSinceRegistration)
                )
            },
            {
                stage: 4,
                name: "First Note View",
                usersCompleted: allUsers.filter(u => u.milestones.firstNoteView?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.firstNoteView?.completed).length / totalUsers) * 100,
                description: "Users who viewed their first note",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.firstNoteView?.completed)
                        .map(u => u.milestones.firstNoteView?.daysSinceRegistration)
                )
            },
            {
                stage: 5,
                name: "First Download",
                usersCompleted: allUsers.filter(u => u.milestones.firstNoteDownload?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.firstNoteDownload?.completed).length / totalUsers) * 100,
                description: "Users who downloaded their first note",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.firstNoteDownload?.completed)
                        .map(u => u.milestones.firstNoteDownload?.daysSinceRegistration)
                )
            },
            {
                stage: 6,
                name: "First Interaction",
                usersCompleted: allUsers.filter(u => u.milestones.firstInteraction?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.firstInteraction?.completed).length / totalUsers) * 100,
                description: "Users who rated, reviewed, or bookmarked",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.firstInteraction?.completed)
                        .map(u => u.milestones.firstInteraction?.daysSinceRegistration)
                )
            },
            {
                stage: 7,
                name: "Multiple Downloads",
                usersCompleted: allUsers.filter(u => u.milestones.multipleDownloads?.completed).length,
                percentage: (allUsers.filter(u => u.milestones.multipleDownloads?.completed).length / totalUsers) * 100,
                description: "Users with 5+ downloads (sustained engagement)",
                avgDaysSinceRegistration: calculateAvgDays(
                    allUsers.filter(u => u.milestones.multipleDownloads?.completed)
                        .map(u => u.milestones.multipleDownloads?.daysSinceRegistration)
                )
            }
        ];

        // Calculate drop-off rates
        funnel.forEach((stage, index) => {
            if (index > 0) {
                stage.dropoffFromPrevious = funnel[index - 1].percentage - stage.percentage;
            }
        });

        res.status(200).json({
            success: true,
            message: "Retention funnel calculated",
            data: {
                totalUsers,
                funnel,
                summary: {
    registrationToFirstLogin: funnel[1].percentage.toFixed(1),
    registrationToFirstDownload: funnel[4].percentage.toFixed(1),
    registrationToSustainedEngagement: funnel[6].percentage.toFixed(1)
}

            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET COHORT ANALYSIS
 * Shows retention by week of registration
 */
export const getCohortAnalysis = async (req, res, next) => {
    try {
        const { weeksBack = 12 } = req.query;

        const cohorts = await CohortAnalysis.find({})
            .sort({ startDate: -1 })
            .limit(parseInt(weeksBack))
            .lean();

        if (cohorts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No cohort data available yet",
                data: { cohorts: [] }
            });
        }

        res.status(200).json({
            success: true,
            message: "Cohort analysis fetched",
            data: {
                cohorts: cohorts.reverse(),
                summary: {
                    totalCohorts: cohorts.length,
                    averageRetentionWeek1: calculateAverage(
                        cohorts.map(c => c.retentionByWeek?.week1?.percentage || 0)
                    ),
                    averageRetentionWeek4: calculateAverage(
                        cohorts.map(c => c.retentionByWeek?.week4?.percentage || 0)
                    ),
                    averageRetentionWeek12: calculateAverage(
                        cohorts.map(c => c.retentionByWeek?.week12?.percentage || 0)
                    )
                }
            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET ENGAGEMENT METRICS
 * Shows overall engagement statistics
 */
export const getEngagementMetrics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.registrationDate = {};
            if (startDate) query.registrationDate.$gte = new Date(startDate);
            if (endDate) query.registrationDate.$lte = new Date(endDate);
        }

        const allMetrics = await UserRetentionMilestone.find(query)
            .select('metrics retentionStatus')
            .lean();

        if (allMetrics.length === 0) {
            return res.status(200).json({
                success: true,
                data: { metrics: {} }
            });
        }

        // Calculate aggregates
        const avgEngagementScore = calculateAverage(
            allMetrics.map(m => m.metrics.engagementScore)
        );
        
        const avgLogins = calculateAverage(
            allMetrics.map(m => m.metrics.totalLogins)
        );
        
        const avgDownloads = calculateAverage(
            allMetrics.map(m => m.metrics.totalNoteDownloads)
        );
        
        const avgViews = calculateAverage(
            allMetrics.map(m => m.metrics.totalNoteViews)
        );

        // Count retention statuses
        const statusCounts = {
            HIGHLY_ACTIVE: allMetrics.filter(m => m.retentionStatus === 'HIGHLY_ACTIVE').length,
            ACTIVE: allMetrics.filter(m => m.retentionStatus === 'ACTIVE').length,
            AT_RISK: allMetrics.filter(m => m.retentionStatus === 'AT_RISK').length,
            CHURNED: allMetrics.filter(m => m.retentionStatus === 'CHURNED').length
        };

        res.status(200).json({
            success: true,
            message: "Engagement metrics calculated",
            data: {
                totalUsers: allMetrics.length,
                averages: {
                    engagementScore: avgEngagementScore.toFixed(2),
                    logins: avgLogins.toFixed(2),
                    downloads: avgDownloads.toFixed(2),
                    noteViews: avgViews.toFixed(2)
                },
                retentionDistribution: {
                    highlyActive: {
                        count: statusCounts.HIGHLY_ACTIVE,
                        percentage: (statusCounts.HIGHLY_ACTIVE / allMetrics.length * 100).toFixed(2)
                    },
                    active: {
                        count: statusCounts.ACTIVE,
                        percentage: (statusCounts.ACTIVE / allMetrics.length * 100).toFixed(2)
                    },
                    atRisk: {
                        count: statusCounts.AT_RISK,
                        percentage: (statusCounts.AT_RISK / allMetrics.length * 100).toFixed(2)
                    },
                    churned: {
                        count: statusCounts.CHURNED,
                        percentage: (statusCounts.CHURNED / allMetrics.length * 100).toFixed(2)
                    }
                }
            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET USER ACTIVITY TIMELINE
 * Shows activity history for a specific user
 */
export const getUserActivityTimeline = async (req, res, next) => {
    const { userId } = req.params;
    const { daysBack = 30 } = req.query;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(daysBack));

        const activities = await UserActivity.find({
            userId,
            createdAt: { $gte: startDate }
        })
        .sort({ createdAt: -1 })
        .lean();

        // Group by activity type
        const activityStats = {};
        activities.forEach(activity => {
            if (!activityStats[activity.activityType]) {
                activityStats[activity.activityType] = 0;
            }
            activityStats[activity.activityType]++;
        });

        res.status(200).json({
            success: true,
            message: "Activity timeline fetched",
            data: {
                period: `Last ${daysBack} days`,
                totalActivities: activities.length,
                activityBreakdown: activityStats,
                timeline: activities
            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET RETENTION STATUS
 * Shows overall retention metrics across all users
 */
export const getRetentionStatus = async (req, res, next) => {
    try {
        const allMetrics = await UserRetentionMilestone.find({}).lean();

        const retentionStatus = {
            totalUsers: allMetrics.length,
            byStatus: {
                highlyActive: allMetrics.filter(m => m.retentionStatus === 'HIGHLY_ACTIVE').length,
                active: allMetrics.filter(m => m.retentionStatus === 'ACTIVE').length,
                atRisk: allMetrics.filter(m => m.retentionStatus === 'AT_RISK').length,
                churned: allMetrics.filter(m => m.retentionStatus === 'CHURNED').length
            },
            weeklyRetention: calculateWeeklyRetention(allMetrics),
            monthlyRetention: calculateMonthlyRetention(allMetrics)
        };

        res.status(200).json({
            success: true,
            message: "Retention status calculated",
            data: retentionStatus
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * GET CHURN RISK USERS
 * Shows users at high risk of churning (for intervention)
 */
export const getChurnRiskUsers = async (req, res, next) => {
    try {
        const { limit = 50, minChurnProbability = 0.5 } = req.query;

        const riskUsers = await UserRetentionMilestone.find({
            churnProbability: { $gte: parseFloat(minChurnProbability) },
            retentionStatus: { $in: ['AT_RISK', 'CHURNED'] }
        })
        .populate('userId', 'fullName email avatar.secure_url')
        .select('userId metrics churnProbability retentionStatus')
        .sort({ churnProbability: -1 })
        .limit(parseInt(limit))
        .lean();

        res.status(200).json({
            success: true,
            message: "Churn risk users fetched",
            data: {
                totalAtRisk: riskUsers.length,
                users: riskUsers.map(user => ({
                    userId: user.userId._id,
                    userName: user.userId.fullName,
                    email: user.userId.email,
                    churnProbability: (user.churnProbability * 100).toFixed(1) + '%',
                    retentionStatus: user.retentionStatus,
                    lastActivity: user.metrics.lastActivityAt,
                    daysSinceLastActivity: Math.floor(
                        (new Date() - new Date(user.metrics.lastActivityAt)) / (1000 * 60 * 60 * 24)
                    ),
                    engagementScore: user.metrics.engagementScore
                }))
            }
        });

    } catch (error) {
        return next(new Apperror(error.message, 500));
    }
};

/**
 * HELPER FUNCTIONS
 */

function calculateAvgDays(days) {
    const filtered = days.filter(d => typeof d === 'number');
    if (filtered.length === 0) return 0;
    return (filtered.reduce((a, b) => a + b, 0) / filtered.length).toFixed(1);
}

function calculateAverage(numbers) {
    const filtered = numbers.filter(n => typeof n === 'number');
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function calculateWeeklyRetention(metrics) {
    // Returns week-over-week retention
    const weeks = {};
    
    metrics.forEach(m => {
        const week = getWeekString(m.registrationDate);
        if (!weeks[week]) {
            weeks[week] = { total: 0, active: 0 };
        }
        weeks[week].total++;
        if (m.retentionStatus !== 'CHURNED') {
            weeks[week].active++;
        }
    });

    return Object.keys(weeks)
        .sort()
        .slice(-12)
        .map(week => ({
            week,
            retention: ((weeks[week].active / weeks[week].total) * 100).toFixed(1)
        }));
}

function calculateMonthlyRetention(metrics) {
    const months = {};
    
    metrics.forEach(m => {
        const month = m.registrationDate.toISOString().slice(0, 7);
        if (!months[month]) {
            months[month] = { total: 0, active: 0 };
        }
        months[month].total++;
        if (m.retentionStatus !== 'CHURNED') {
            months[month].active++;
        }
    });

    return Object.keys(months)
        .sort()
        .slice(-12)
        .map(month => ({
            month,
            retention: ((months[month].active / months[month].total) * 100).toFixed(1)
        }));
}

function getWeekString(date) {
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}
