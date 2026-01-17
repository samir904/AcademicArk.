// CONTROLLERS/homepage.controller.js
import asyncWrap from "../UTIL/asyncWrap.js";
import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import redis from "../CONFIG/redisClient.js";

/**
 * 📌 GET PERSONALIZED HOMEPAGE DATA
 * 
 * One endpoint - all data for authenticated user
 * Structured response for all homepage sections
 */
export const getPersonalizedHomepage = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ STEP 1: Check Redis cache first (5 min TTL)
        const cacheKey = `homepage:${userId}`;
        const cachedData = await redis.get(cacheKey);
        
        if (cachedData) {
            return res.status(200).json({
                success: true,
                data: JSON.parse(cachedData),
                fromCache: true,
                message: "Homepage data from cache"
            });
        }

        // ✅ STEP 2: Fetch user with academic profile
        const user = await User.findById(userId).select(
            'fullName academicProfile personalizationSettings lastHomepageVisit'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // ✅ STEP 3: Build response structure
        const homepageData = {
            greeting: buildGreeting(user),
            continue: await getContinueWhere(userId, user),
            recommended: await getRecommendedNotes(userId, user),
            trending: await getTrendingInSemester(userId, user),
            examAlert: await getExamAlert(userId, user),
            metadata: {
                timestamp: new Date(),
                profileComplete: user.academicProfile?.isCompleted || false,
                userSemester: user.academicProfile?.semester || null,
                userBranch: user.academicProfile?.branch || null
            }
        };

        // ✅ STEP 4: Cache for 5 minutes (300 seconds)
        await redis.setEx(
            cacheKey,
            300,
            JSON.stringify(homepageData)
        );

        // ✅ STEP 5: Update last homepage visit
        await User.findByIdAndUpdate(
            userId,
            { lastHomepageVisit: new Date() },
            { new: true }
        );

        // ✅ STEP 6: Log activity (async - non-blocking)
        logActivityAsync(userId, 'HOMEPAGE_VIEWED');

        res.status(200).json({
            success: true,
            data: homepageData,
            fromCache: false,
            message: "Personalized homepage data loaded"
        });

    } catch (error) {
        console.error('Homepage controller error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to load homepage",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * 🎯 SECTION 1: PERSONALIZED GREETING
 */
function buildGreeting(user) {
    const hour = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false
    });
    let timeOfDay = 'Good morning';
    
    if (hour >= 12 && hour < 17) timeOfDay = 'Good afternoon';
    if (hour >= 17) timeOfDay = 'Good evening';

    return {
        message: `${timeOfDay}, ${user.fullName.split(' ')[0]} 👋`,
        fullName: user.fullName,
        semester: user.academicProfile?.semester || null,
        branch: user.academicProfile?.branch || null,
        profileComplete: user.academicProfile?.isCompleted || false
    };
}

/**
 * 🔗 SECTION 2: CONTINUE WHERE YOU LEFT OFF
 * 
 * Priority order:
 * 1. Last viewed note (in last 7 days)
 * 2. Last downloaded note (in last 7 days)
 * 3. Last searched subject
 * 4. Suggested: Unit-1 of current semester
 */
async function getContinueWhere(userId, user) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Try to find last viewed note
        const lastViewed = await UserActivity.findOne({
            userId,
            activityType: "NOTE_VIEWED",
            createdAt: { $gte: sevenDaysAgo }
        })
        .sort({ createdAt: -1 })
        .select('resourceId subject unit');

        if (lastViewed && lastViewed.resourceId) {
            const note = await Note.findById(lastViewed.resourceId).select(
                'title subject category downloads views'
            );

            if (note) {
                return {
                    type: 'LAST_VIEWED',
                    note: {
                        id: note._id,
                        title: note.title.substring(0, 50),
                        subject: note.subject,
                        category: note.category,
                        downloads: note.downloads,
                        views: note.views
                    },
                    action: 'Continue Reading'
                };
            }
        }

        // Try to find last downloaded note
        const lastDownloaded = await UserActivity.findOne({
            userId,
            activityType: "NOTE_DOWNLOADED",
            createdAt: { $gte: sevenDaysAgo }
        })
        .sort({ createdAt: -1 })
        .select('resourceId subject');

        if (lastDownloaded && lastDownloaded.resourceId) {
            const note = await Note.findById(lastDownloaded.resourceId).select(
                'title subject category'
            );

            if (note) {
                return {
                    type: 'LAST_DOWNLOADED',
                    note: {
                        id: note._id,
                        title: note.title.substring(0, 50),
                        subject: note.subject,
                        category: note.category
                    },
                    action: 'Continue Reading'
                };
            }
        }

        // Default: Suggest Unit-1 of current semester
        if (user.academicProfile?.semester) {
            return {
                type: 'SUGGESTION',
                message: `Start with Unit-1 notes for Semester ${user.academicProfile.semester}`,
                action: 'Explore Now',
                link: `/notes?semester=${user.academicProfile.semester}&unit=1`
            };
        }

        return {
            type: 'EMPTY',
            message: 'Complete your profile to get personalized suggestions',
            action: 'Complete Profile'
        };

    } catch (error) {
        console.error('getContinueWhere error:', error);
        return null;
    }
}

/**
 * 🎁 SECTION 3: RECOMMENDED NOTES FOR SEMESTER
 * 
 * Filter criteria:
 * - Same semester
 * - Same branch (if available)
 * - Sort by downloads + views
 * - Recently updated
 * - Max 6 cards
 */
async function getRecommendedNotes(userId, user) {
    try {
        if (!user.academicProfile?.semester) {
            return {
                hasData: false,
                message: "Complete your academic profile for recommendations"
            };
        }

        // Build query filter
        const filter = {
            semester: user.academicProfile.semester,
            course: "BTECH"
        };

        // Aggregate pipeline for best recommendations
        const recommended = await Note.aggregate([
            {
                $match: filter
            },
            {
                $addFields: {
                    // Score calculation: downloads (40%) + views (40%) + recent (20%)
                    relevanceScore: {
                        $add: [
                            { $multiply: [{ $cond: ["$downloads", "$downloads", 0] }, 0.4] },
                            { $multiply: [{ $cond: ["$views", "$views", 0] }, 0.4] },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            { $subtract: [new Date(), "$updatedAt"] },
                                            1000 * 60 * 60 * 24 // Convert to days
                                        ]
                                    },
                                    -0.2 // Negative = more recent = higher score
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $sort: { relevanceScore: -1 }
            },
            {
                $limit: 6
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    subject: 1,
                    category: 1,
                    downloads: 1,
                    views: 1,
                    uploadedBy: 1,
                    totalBookmarks: { $size: "$bookmarkedBy" },
                    avgRating: {
                        $cond: [
                            { $gt: [{ $size: "$rating" }, 0] },
                            {
                                $divide: [
                                    { $sum: "$rating.rating" },
                                    { $size: "$rating" }
                                ]
                            },
                            0
                        ]
                    }
                }
            }
        ]);

        if (recommended.length === 0) {
            return {
                hasData: false,
                message: "No notes available for your semester yet"
            };
        }

        return {
            hasData: true,
            section: `Recommended for Semester ${user.academicProfile.semester}`,
            notes: recommended.map(note => ({
                id: note._id,
                title: note.title.substring(0, 60),
                subject: note.subject,
                category: note.category,
                downloads: note.downloads || 0,
                views: note.views || 0,
                rating: (note.avgRating || 0).toFixed(1),
                bookmarks: note.totalBookmarks || 0
            }))
        };

    } catch (error) {
        console.error('getRecommendedNotes error:', error);
        return { hasData: false, error: true };
    }
}

/**
 * 🔥 SECTION 4: TRENDING IN YOUR SEMESTER
 * 
 * NOT global trending - only for user's semester
 * Based on views + downloads in last 7 days
 * Max 5 items
 */
async function getTrendingInSemester(userId, user) {
    try {
        if (!user.academicProfile?.semester) {
            return {
                hasData: false,
                message: "Update your semester preference"
            };
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get trending activities for this semester
        const trendingActivities = await UserActivity.aggregate([
            {
                $match: {
                    activityType: { $in: ["NOTE_VIEWED", "NOTE_DOWNLOADED"] },
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: "$resourceId",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        const noteIds = trendingActivities.map(activity => activity._id);

        // Fetch full note details
        const trending = await Note.find({
            _id: { $in: noteIds },
            semester: user.academicProfile.semester
        }).select(
            'title subject category downloads views totalBookmarks'
        );

        if (trending.length === 0) {
            return {
                hasData: false,
                message: "No trending notes in your semester yet"
            };
        }

        return {
            hasData: true,
            section: `Trending in Semester ${user.academicProfile.semester}`,
            notes: trending.map(note => ({
                id: note._id,
                title: note.title.substring(0, 45),
                subject: note.subject,
                category: note.category,
                downloads: note.downloads || 0
            }))
        };

    } catch (error) {
        console.error('getTrendingInSemester error:', error);
        return { hasData: false, error: true };
    }
}

/**
 * ⚠️ EXAM ALERT
 * 
 * Check if exams are coming up (30 days)
 * Return exam status flag
 */
async function getExamAlert(userId, user) {
    try {
        // TODO: Implement exam calendar model/schema
        // For now, return mock data
        
        return {
            hasExamSoon: false,
            daysUntilExam: null,
            message: null
        };

    } catch (error) {
        console.error('getExamAlert error:', error);
        return { hasExamSoon: false, error: true };
    }
}

/**
 * 🔔 LOG ACTIVITY ASYNC (non-blocking)
 */
function logActivityAsync(userId, activityType) {
    setImmediate(async () => {
        try {
            await UserActivity.create({
                userId,
                activityType,
                resourceType: null,
                metadata: {}
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    });
}

/**
 * 🔄 INVALIDATE CACHE
 * Call this when user's data changes
 */
export const invalidateHomepageCache = async (userId) => {
    const cacheKey = `homepage:${userId}`;
    await redis.del(cacheKey);
};

/**
 * 🧹 CLEAR USER CACHE
 * Call on logout or profile update
 */
export const clearUserCache = async (userId) => {
    const pattern = `homepage:${userId}*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
        await redis.del(...keys);
    }
};
