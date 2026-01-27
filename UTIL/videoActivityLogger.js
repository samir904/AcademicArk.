import UserActivity from "../MODELS/userActivity.model.js";
import geoip from "geoip-lite";
// import UAParser from "ua-parser-js";

/**
 * LOG VIDEO VIEW ACTIVITY
 * Tracks: User views, watch time, location, device info
 */
export const logVideoViewActivity = async (userId, videoId, videoData = {}) => {
  try {
    if (!userId) return; // Skip for anonymous users

    const activity = await UserActivity.create({
      userId,
      activityType: "NOTE_VIEWED", // Reusing NOTE_VIEWED for video
      resourceId: videoId,
      resourceType: "VIDEO",
      metadata: {
        viewDuration: 0, // Will be updated as user watches
        ...videoData.metadata,
      },
      createdAt: new Date(),
    });

    return activity;
  } catch (error) {
    console.error("❌ Error logging video view:", error);
    // Don't throw - activity logging shouldn't break main flow
  }
};

/**
 * LOG VIDEO WATCH PROGRESS
 * Tracks: Watch time, percentage, completion status
 */
export const logVideoWatchProgress = async (userId, videoId, watchData) => {
  try {
    if (!userId) return;

    const { watchTimeSeconds, watchPercentage, completed } = watchData;

    // Only log significant progress updates (every 30 seconds or milestone)
    const activity = await UserActivity.create({
      userId,
      activityType: "NOTE_VIEWED",
      resourceId: videoId,
      resourceType: "VIDEO",
      metadata: {
        viewDuration: watchTimeSeconds,
        watchPercentage: watchPercentage,
        completed: completed || false,
      },
      createdAt: new Date(),
    });

    return activity;
  } catch (error) {
    console.error("❌ Error logging watch progress:", error);
  }
};

/**
 * LOG VIDEO RATING ACTIVITY
 * Tracks: User rates video with 1-5 stars
 */
export const logVideoRatingActivity = async (userId, videoId, rating, review) => {
  try {
    if (!userId) return;

    const activity = await UserActivity.create({
      userId,
      activityType: "NOTE_RATED",
      resourceId: videoId,
      resourceType: "VIDEO",
      metadata: {
        ratingValue: rating,
        reviewLength: review ? review.length : 0,
      },
      createdAt: new Date(),
    });

    return activity;
  } catch (error) {
    console.error("❌ Error logging video rating:", error);
  }
};

/**
 * LOG VIDEO BOOKMARK ACTIVITY
 * Tracks: User bookmarks or removes bookmark
 */
export const logVideoBookmarkActivity = async (userId, videoId, action) => {
  try {
    if (!userId) return;

    const activityType =
      action === "added" ? "ADDED_VIDEO_BOOKMARK" : "REMOVED_VIDEO_BOOKMARK";

    const activity = await UserActivity.create({
      userId,
      activityType,
      resourceId: videoId,
      resourceType: "VIDEO",
      createdAt: new Date(),
    });V

    return activity;
  } catch (error) {
    console.error("❌ Error logging bookmark activity:", error);
  }
};

/**
 * LOG VIDEO SEARCH ACTIVITY
 * Tracks: User searches for videos with filters
 */
export const logVideoSearchActivity = async (userId, searchQuery, filters) => {
  try {
    const activity = await UserActivity.create({
      userId: userId || null,
      activityType: "SEARCH_PERFORMED",
      resourceType: "VIDEO",
      metadata: {
        searchQuery: searchQuery.substring(0, 100),
        filters: {
          subject: filters?.subject,
          semester: filters?.semester,
          difficulty: filters?.difficulty,
          language: filters?.language,
        },
        resultsCount: filters?.resultsCount || 0,
      },
      createdAt: new Date(),
    });

    return activity;
  } catch (error) {
    console.error("❌ Error logging search activity:", error);
  }
};

/**
 * LOG VIDEO SHARE ACTIVITY
 * Tracks: User shares video (via link/email/social)
 */
export const logVideoShareActivity = async (userId, videoId, platform) => {
  try {
    if (!userId) return;

    const activity = await UserActivity.create({
      userId,
      activityType: "NOTE_SHARED",
      resourceId: videoId,
      resourceType: "VIDEO",
      metadata: {
        sharePlatform: platform || "link", // link, email, whatsapp, facebook, etc
      },
      createdAt: new Date(),
    });

    return activity;
  } catch (error) {
    console.error("❌ Error logging share activity:", error);
  }
};

/**
 * GET USER'S VIDEO WATCH STATISTICS
 * Returns: Total watch time, videos watched, average rating, etc
 */
export const getUserVideoStats = async (userId) => {
  try {
    if (!userId) return null;

    const activities = await UserActivity.find({
      userId,
      resourceType: "VIDEO",
      activityType: { $in: ["NOTE_VIEWED", "NOTE_RATED", "ADDED_VIDEO_BOOKMARK"] },
    });

    const stats = {
      totalVideosWatched: new Set(
        activities
          .filter((a) => a.activityType === "NOTE_VIEWED")
          .map((a) => a.resourceId.toString())
      ).size,
      totalWatchTime: activities
        .filter((a) => a.activityType === "NOTE_VIEWED")
        .reduce((sum, a) => sum + (a.metadata?.viewDuration || 0), 0),
      videosBookmarked: new Set(
        activities
          .filter((a) => a.activityType === "ADDED_VIDEO_BOOKMARK")
          .map((a) => a.resourceId.toString())
      ).size,
      videosRated: activities.filter((a) => a.activityType === "NOTE_RATED")
        .length,
      averageRating:
        activities.filter((a) => a.activityType === "NOTE_RATED").length > 0
          ? (
              activities
                .filter((a) => a.activityType === "NOTE_RATED")
                .reduce((sum, a) => sum + (a.metadata?.ratingValue || 0), 0) /
              activities.filter((a) => a.activityType === "NOTE_RATED").length
            ).toFixed(1)
          : 0,
    };

    return stats;
  } catch (error) {
    console.error("❌ Error getting user video stats:", error);
    return null;
  }
};

/**
 * GET VIDEO ANALYTICS
 * Returns: Total views, average watch time, completion rate, etc
 */
export const getVideoAnalytics = async (videoId) => {
  try {
    const activities = await UserActivity.find({
      resourceId: videoId,
      resourceType: "VIDEO",
      activityType: { $in: ["NOTE_VIEWED", "NOTE_RATED", "ADDED_VIDEO_BOOKMARK"] },
    });

    const viewActivities = activities.filter((a) => a.activityType === "NOTE_VIEWED");
    const ratingActivities = activities.filter((a) => a.activityType === "NOTE_RATED");
    const bookmarkActivities = activities.filter(
      (a) => a.activityType === "ADDED_VIDEO_BOOKMARK"
    );

    const analytics = {
      totalViews: viewActivities.length,
      uniqueViewers: new Set(viewActivities.map((a) => a.userId.toString())).size,
      totalWatchTime: viewActivities.reduce(
        (sum, a) => sum + (a.metadata?.viewDuration || 0),
        0
      ),
      averageWatchTime:
        viewActivities.length > 0
          ? Math.round(
              viewActivities.reduce(
                (sum, a) => sum + (a.metadata?.viewDuration || 0),
                0
              ) / viewActivities.length
            )
          : 0,
      completionRate:
        viewActivities.length > 0
          ? (
              (viewActivities.filter(
                (a) => a.metadata?.watchPercentage >= 80
              ).length /
                viewActivities.length) *
              100
            ).toFixed(1)
          : 0,
      totalRatings: ratingActivities.length,
      averageRating:
        ratingActivities.length > 0
          ? (
              ratingActivities.reduce(
                (sum, a) => sum + (a.metadata?.ratingValue || 0),
                0
              ) / ratingActivities.length
            ).toFixed(1)
          : 0,
      totalBookmarks: bookmarkActivities.length,
      engagementScore: Math.round(
        (viewActivities.length * 1 +
          ratingActivities.length * 5 +
          bookmarkActivities.length * 3) /
          (viewActivities.length || 1)
      ),
    };

    return analytics;
  } catch (error) {
    console.error("❌ Error getting video analytics:", error);
    return null;
  }
};

/**
 * GET TRENDING VIDEOS
 * Returns: Videos with highest engagement in last 7 days
 */
export const getTrendingVideos = async (limit = 10) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingData = await UserActivity.aggregate([
      {
        $match: {
          resourceType: "VIDEO",
          createdAt: { $gte: sevenDaysAgo },
          activityType: { $in: ["NOTE_VIEWED", "NOTE_RATED", "ADDED_VIDEO_BOOKMARK"] },
        },
      },
      {
        $group: {
          _id: "$resourceId",
          viewCount: {
            $sum: { $cond: [{ $eq: ["$activityType", "NOTE_VIEWED"] }, 1, 0] },
          },
          ratingCount: {
            $sum: { $cond: [{ $eq: ["$activityType", "NOTE_RATED"] }, 1, 0] },
          },
          bookmarkCount: {
            $sum: {
              $cond: [{ $eq: ["$activityType", "ADDED_VIDEO_BOOKMARK"] }, 1, 0],
            },
          },
        },
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              "$viewCount",
              { $multiply: ["$ratingCount", 5] },
              { $multiply: ["$bookmarkCount", 3] },
            ],
          },
        },
      },
      {
        $sort: { engagementScore: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "videos",
          localField: "_id",
          foreignField: "_id",
          as: "video",
        },
      },
      {
        $unwind: "$video",
      },
    ]);

    return trendingData;
  } catch (error) {
    console.error("❌ Error getting trending videos:", error);
    return [];
  }
};

/**
 * GET USER'S WATCH HISTORY
 * Returns: Videos user has watched with timestamps
 */
export const getUserWatchHistory = async (userId, limit = 20) => {
  try {
    if (!userId) return [];

    const activities = await UserActivity.find({
      userId,
      resourceType: "VIDEO",
      activityType: "NOTE_VIEWED",
    })
      .populate("resourceId")
      .sort({ createdAt: -1 })
      .limit(limit);

    return activities.map((activity) => ({
      video: activity.resourceId,
      watchedAt: activity.createdAt,
      watchTime: activity.metadata?.viewDuration || 0,
      watchPercentage: activity.metadata?.watchPercentage || 0,
    }));
  } catch (error) {
    console.error("❌ Error getting watch history:", error);
    return [];
  }
};

/**
 * EXPORT VIDEO ANALYTICS REPORT
 * For admin dashboard
 */
export const generateVideoAnalyticsReport = async (dateRange = 30) => {
  try {
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);

    const report = await UserActivity.aggregate([
      {
        $match: {
          resourceType: "VIDEO",
          createdAt: { $gte: startDate },
          activityType: {
            $in: ["NOTE_VIEWED", "NOTE_RATED", "ADDED_VIDEO_BOOKMARK"],
          },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            activityType: "$activityType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    return report;
  } catch (error) {
    console.error("❌ Error generating report:", error);
    return [];
  }
};
