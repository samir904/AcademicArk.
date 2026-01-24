import UserActivity from "../MODELS/userActivity.model.js";
import UserRetentionMilestone from "../MODELS/userRetentionMilestone.model.js";
import { updateProgressFromActivity } from "../services/studyProgressUpdater.service.js";

// Log user activity
export const logUserActivity = async (userId, activityType, metadata = {}) => {
    try {
        // Extract device type from user agent
        const userAgent = metadata.userAgent || "";
        let deviceType = "DESKTOP";

        if (/mobile/i.test(userAgent)) deviceType = "MOBILE";
        else if (/tablet/i.test(userAgent)) deviceType = "TABLET";

        // Create activity log
        await UserActivity.create({
            userId,
            activityType,
            resourceId: metadata.resourceId || null,
            resourceType: metadata.resourceType || null,
            metadata: {
                ipAddress: metadata.ipAddress,
                userAgent,
                deviceType,
                viewDuration: metadata.viewDuration,
                downloadSize: metadata.downloadSize,
                ratingValue: metadata.ratingValue
            },
            sessionId: metadata.sessionId,
            location: metadata.location || {}
        });
        // 🔥 AUTO SYNC LEARNING STATE
        await updateProgressFromActivity({
            userId,
            activityType,
            resourceId: metadata.resourceId,
            subject: metadata.subject,
            unit: metadata.unit,
            metadata
        });

        // Update retention milestone metrics
        await updateRetentionMetrics(userId, activityType);

    } catch (error) {
        console.error('Activity logging error:', error);
    }
};

// Update retention metrics
export const updateRetentionMetrics = async (userId, activityType) => {
    try {
        let retentionMilestone = await UserRetentionMilestone.findOne({ userId });

        if (!retentionMilestone) {
            // Create new milestone if not exists
            retentionMilestone = await UserRetentionMilestone.create({
                userId,
                registrationDate: new Date(),
                milestones: {
                    registered: {
                        completed: true,
                        completedAt: new Date()
                    }
                }
            });
        }

        // Update metrics based on activity type
        const now = new Date();
        const daysSinceRegistration = Math.floor(
            (now - retentionMilestone.registrationDate) / (1000 * 60 * 60 * 24)
        );

        switch (activityType) {
            case "LOGIN":
                retentionMilestone.metrics.totalLogins += 1;

                // Mark first login
                if (!retentionMilestone.milestones.firstLogin?.completed) {
                    retentionMilestone.milestones.firstLogin = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration
                    };
                }
                break;

            case "NOTE_VIEWED":
                retentionMilestone.metrics.totalNoteViews += 1;

                // Mark first note view
                if (!retentionMilestone.milestones.firstNoteView?.completed) {
                    retentionMilestone.milestones.firstNoteView = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration
                    };
                }
                break;

            case "NOTE_DOWNLOADED":
                retentionMilestone.metrics.totalNoteDownloads += 1;

                // Mark first download
                if (!retentionMilestone.milestones.firstNoteDownload?.completed) {
                    retentionMilestone.milestones.firstNoteDownload = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration
                    };
                }

                // Check for multiple downloads
                if (retentionMilestone.metrics.totalNoteDownloads >= 5 &&
                    !retentionMilestone.milestones.multipleDownloads?.completed) {
                    retentionMilestone.milestones.multipleDownloads = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration,
                        downloadCount: retentionMilestone.metrics.totalNoteDownloads
                    };
                }
                break;

            case "NOTE_RATED":
                retentionMilestone.metrics.totalRatings += 1;

                if (!retentionMilestone.milestones.firstInteraction?.completed) {
                    retentionMilestone.milestones.firstInteraction = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration,
                        interactionType: "RATING"
                    };
                }
                break;

            case "NOTE_REVIEWED":
                retentionMilestone.metrics.totalReviews += 1;

                if (!retentionMilestone.milestones.firstInteraction?.completed) {
                    retentionMilestone.milestones.firstInteraction = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration,
                        interactionType: "REVIEW"
                    };
                }
                break;

            case "NOTE_BOOKMARKED":
                retentionMilestone.metrics.totalBookmarks += 1;

                if (!retentionMilestone.milestones.firstInteraction?.completed) {
                    retentionMilestone.milestones.firstInteraction = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration,
                        interactionType: "BOOKMARK"
                    };
                }
                break;

            case "PROFILE_COMPLETED":
                if (!retentionMilestone.milestones.profileCompleted?.completed) {
                    retentionMilestone.milestones.profileCompleted = {
                        completed: true,
                        completedAt: now,
                        daysSinceRegistration
                    };
                }
                break;
        }

        // Update engagement score (0-100)
        retentionMilestone.metrics.engagementScore = calculateEngagementScore(
            retentionMilestone.metrics
        );

        // Update retention status
        retentionMilestone.metrics.lastActivityAt = now;
        retentionMilestone.retentionStatus = determineRetentionStatus(
            retentionMilestone.metrics.lastActivityAt
        );

        // Update churn probability
        retentionMilestone.churnProbability = calculateChurnProbability(
            retentionMilestone
        );

        retentionMilestone.lastUpdated = now;

        await retentionMilestone.save();

    } catch (error) {
        console.error('Error updating retention metrics:', error);
    }
};

// Calculate engagement score
export const calculateEngagementScore = (metrics) => {
    // Weight different activities
    const weights = {
        login: 5,           // Logins worth 5 points each
        noteView: 10,       // Views worth 10 points each
        download: 20,       // Downloads worth 20 points each
        rating: 15,         // Ratings worth 15 points each
        review: 25,         // Reviews worth 25 points each
        bookmark: 10        // Bookmarks worth 10 points each
    };

    let score = 0;
    score += Math.min(metrics.totalLogins * weights.login, 200);     // Cap at 200
    score += Math.min(metrics.totalNoteViews * weights.noteView, 300);  // Cap at 300
    score += Math.min(metrics.totalNoteDownloads * weights.download, 500);  // Cap at 500
    score += Math.min(metrics.totalRatings * weights.rating, 150);    // Cap at 150
    score += Math.min(metrics.totalReviews * weights.review, 200);    // Cap at 200
    score += Math.min(metrics.totalBookmarks * weights.bookmark, 100); // Cap at 100

    // Normalize to 0-100
    return Math.min(Math.floor(score / 20), 100);
};

// Determine retention status
export const determineRetentionStatus = (lastActivityAt) => {
    if (!lastActivityAt) return "CHURNED";

    const daysSinceLastActivity = Math.floor(
        (new Date() - lastActivityAt) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActivity <= 1) return "HIGHLY_ACTIVE";
    if (daysSinceLastActivity <= 7) return "ACTIVE";
    if (daysSinceLastActivity <= 14) return "AT_RISK";
    return "CHURNED";
};

// Calculate churn probability (0-1)
export const calculateChurnProbability = (milestone) => {
    const daysSinceRegistration = Math.floor(
        (new Date() - milestone.registrationDate) / (1000 * 60 * 60 * 24)
    );

    const daysSinceLastActivity = milestone.metrics.lastActivityAt
        ? Math.floor((new Date() - milestone.metrics.lastActivityAt) / (1000 * 60 * 60 * 24))
        : daysSinceRegistration;

    // Factors that increase churn probability
    let churnScore = 0;

    // Days inactive
    churnScore += Math.min(daysSinceLastActivity / 30, 0.4);  // 40% weight for inactivity

    // Low engagement score
    churnScore += (1 - milestone.metrics.engagementScore / 100) * 0.3;  // 30% weight

    // Didn't complete profile
    churnScore += !milestone.milestones.profileCompleted?.completed ? 0.2 : 0;  // 20% weight

    // Didn't interact with notes
    churnScore += !milestone.milestones.firstNoteDownload?.completed ? 0.1 : 0;  // 10% weight

    return Math.min(churnScore, 1);
};

// Export activity statistics
export const getUserActivityStats = async (userId, daysBack = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const activities = await UserActivity.find({
            userId,
            createdAt: { $gte: startDate }
        }).lean();

        const stats = {
            totalActivities: activities.length,
            byType: {},
            byDay: {}
        };

        // Group by activity type
        activities.forEach(activity => {
            if (!stats.byType[activity.activityType]) {
                stats.byType[activity.activityType] = 0;
            }
            stats.byType[activity.activityType] += 1;

            // Group by day
            const day = activity.createdAt.toISOString().split('T');
            if (!stats.byDay[day]) {
                stats.byDay[day] = 0;
            }
            stats.byDay[day] += 1;
        });

        return stats;

    } catch (error) {
        console.error('Error getting activity stats:', error);
        return null;
    }
};

