// CONTROLLERS/homepage.controller.js
import asyncWrap from "../UTIL/asyncWrap.js";
import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import Attendance from "../MODELS/attendance.model.js";
import Leaderboard from "../MODELS/leaderboard.model.js";

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
        // ✅ FASTER — all sections fetch simultaneously
        const [
            continueWhere,
            studyMaterialToday,
            recommended,
            trending,
            examAlert,
            attendance,
            leaderboard,
            downloads,
            newNotesBadge          // ✅ ADD
        ] = await Promise.all([
            getContinueWhere(userId, user),
            getStudyMaterialForToday(userId, user),
            getRecommendedNotes(userId, user),
            getTrendingInSemester(userId, user),
            getExamAlert(userId, user),
            getAttendanceSnapshot(userId, user),
            getLeaderboardPreview(userId),
            getDownloadsSnapshot(userId),
            getNewNotesBadge(userId, user)          // ✅ ADD
        ]);

        const homepageData = {
            greeting: buildGreeting(user),
            continue: continueWhere,
            studyMaterialToday,
            newNotesBadge,                          // ✅ ADD
            recommended,
            trending,
            examAlert,
            attendance,
            leaderboard,
            downloads,
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const semester = user.academicProfile?.semester;
  if (!semester) return { hasData: false };

  // ✅ Get semester note IDs FIRST, then find trending among those
  const semesterNoteIds = await Note.distinct("_id", {
    semester: { $in: [semester] },
    course: "BTECH"
  });

  const trendingActivities = await UserActivity.aggregate([
    {
      $match: {
        activityType:  { $in: ["NOTE_VIEWED", "NOTE_DOWNLOADED"] },
        resourceId:    { $in: semesterNoteIds },  // ✅ filter BEFORE grouping
        createdAt:     { $gte: sevenDaysAgo }
      }
    },
    { $group:  { _id: "$resourceId", count: { $sum: 1 } } },
    { $sort:   { count: -1 } },
    { $limit:  5 }
  ]);

  const noteIds = trendingActivities.map(a => a._id);
  if (!noteIds.length) return { hasData: false, message: "No trending notes yet" };

  const trending = await Note.find({ _id: { $in: noteIds } })
    .select("title subject category downloads views");

  // ✅ Preserve trending order from aggregation
  const trendingMap = new Map(trending.map(n => [n._id.toString(), n]));
  const ordered = noteIds
    .map(id => trendingMap.get(id.toString()))
    .filter(Boolean);

  return {
    hasData: true,
    section: `Trending in Semester ${semester}`,
    notes: ordered.map((note, i) => ({
      rank:      i + 1,
      id:        note._id,
      title:     note.title.substring(0, 45),
      subject:   note.subject,
      category:  note.category,
      downloads: note.downloads || 0
    }))
  };
}


async function getAttendanceSnapshot(userId, user) {
    try {
        if (!user.academicProfile?.semester) return null;
        const semester = String(user.academicProfile.semester)
        const attendance = await Attendance.findOne({
            user: userId,
            semester
        });
        // console.log('semester',semester);
        // console.log("attendance",attendance);

        if (!attendance || attendance.subjects.length === 0) {
            return {
                hasData: false,
                message: "Start tracking your attendance"
            };
        }

        let totalPresent = 0;
        let totalClasses = 0;
        let belowTarget = 0;

        attendance.subjects.forEach(subject => {
            const present =
                subject.initialPresentClasses +
                subject.records.filter(r => r.status === "present").length;

            const total =
                subject.initialTotalClasses +
                subject.records.length;

            const percentage = total > 0 ? (present / total) * 100 : 0;

            totalPresent += present;
            totalClasses += total;

            if (percentage < subject.targetPercentage) belowTarget++;
        });

        const overallPercentage =
            totalClasses > 0
                ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2))
                : 0;

        return {
            hasData: true,
            overallPercentage,
            totalSubjects: attendance.subjects.length,
            subjectsBelow75: belowTarget,
            status: overallPercentage >= 75 ? "SAFE" : "RISK",
            primaryMessage:
                overallPercentage >= 75
                    ? "You are in the safe zone 👍"
                    : "Attendance needs attention ⚠️"
        };

    } catch (err) {
        console.error("Attendance snapshot error:", err);
        return null;
    }
}


async function getLeaderboardPreview(userId) {
    try {
        const leaderboard = await Leaderboard.findOne({
            leaderboardType: "TOP_STUDENTS",
            snapshotType: "DAILY"
        })
            .sort({ generatedAt: -1 })
            .lean();

        if (!leaderboard) return null;

        return {
            hasData: true,
            generatedAt: leaderboard.generatedAt,
            topEntries: leaderboard.entries.slice(0, 5).map(e => ({
                rank: e.rank,
                name: e.userName,
                score: e.metrics.engagement
            }))
        };
    } catch (err) {
        console.error("Leaderboard preview error:", err);
        return null;
    }
}

async function getDownloadsSnapshot(userId) {
    try {
        const totalDownloads = await UserActivity.countDocuments({
            userId,
            activityType: "NOTE_DOWNLOADED"
        });

        const lastDownloaded = await UserActivity.findOne({
            userId,
            activityType: "NOTE_DOWNLOADED"
        })
            .sort({ createdAt: -1 })
            .populate("resourceId", "title subject");

        return {
            hasData: totalDownloads > 0,
            totalDownloads,
            lastDownloadedNote: lastDownloaded
                ? {
                    title: lastDownloaded.resourceId?.title,
                    subject: lastDownloaded.resourceId?.subject
                }
                : null
        };

    } catch (err) {
        console.error("Downloads snapshot error:", err);
        return null;
    }
}
/**
 * 📚 SECTION: STUDY MATERIAL FOR TODAY
 *
 * Based on last viewed note's subject + unit
 * Groups: notes, handwritten, imp, pyq (sorted by year desc)
 */
async function getStudyMaterialForToday(userId, user) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 1️⃣ Get last viewed note
        const lastViewed = await UserActivity.findOne({
            userId,
            activityType: "NOTE_VIEWED",
            createdAt: { $gte: sevenDaysAgo }
        })
            .sort({ createdAt: -1 })
            .select("resourceId")
            .lean();

        if (!lastViewed?.resourceId) return { hasData: false };

        // 2️⃣ Fetch source note
        const sourceNote = await Note.findById(lastViewed.resourceId)
            .select("subject unit semester")
            .lean();

        if (!sourceNote?.subject || !sourceNote?.unit) {
            return { hasData: false };
        }

        const { subject, unit, semester } = sourceNote;

        // 3️⃣ Fetch all related materials
        const allMaterials = await Note.find({
            subject: subject,
            $or: [
                { unit: unit },         // specific unit materials
                { unit: null },         // combined/general materials
                { unit: { $exists: false } }  // safety
            ]
        })
            .select("_id title subject unit category downloads views createdAt recommended recommendedRank")            .lean();
        if (!allMaterials.length) return { hasData: false };

        // 🧠 Get all material IDs
        const materialIds = allMaterials.map(n => n._id);

        // 🧠 Find which of these user has viewed
        const viewedIds = await UserActivity.distinct("resourceId", {
            userId,
            activityType: "NOTE_VIEWED",
            resourceId: { $in: materialIds }
        });

        // Convert to string for safe comparison
        const viewedSet = new Set(viewedIds.map(id => id.toString()));

        // 🧠 Calculate progress
        const completedCount = viewedSet.size;
        const totalCount = materialIds.length;
        const percentage = totalCount > 0
            ? Math.round((completedCount / totalCount) * 100)
            : 0;

        // 4️⃣ Group by strict enum category
        const grouped = {
            notes: [],
            handwritten: [],
            imp: [],
            pyq: []
        };

        for (const note of allMaterials) {

            switch (note.category) {

                case "Notes":
                    if (note.unit === unit)
                        grouped.notes.push(note);
                    break;

                case "Handwritten Notes":
                    if (note.unit === unit)
                        grouped.handwritten.push(note);
                    break;

                case "Important Question":
                    // Include both:
                    // - unit specific IMP
                    // - unlabelled IMP (no unit field)
                    if (note.unit === unit || !note.unit) {
                        grouped.imp.push(note);
                    }
                    break;

                case "PYQ":
                    // Include both unit-specific and general
                    if (note.unit === unit || !note.unit) {
                        grouped.pyq.push(note);
                    }
                    break;
            }
        }
        // Sort PYQs latest first
        // grouped.pyq.sort((a, b) =>
        //     new Date(b.createdAt) - new Date(a.createdAt)
        // );
   const sortByPriority = (a, b) => {

    const aRecommended = !!a.recommended;
    const bRecommended = !!b.recommended;

    // 1️⃣ Recommended always first
    if (aRecommended !== bRecommended) {
        return aRecommended ? -1 : 1;
    }

    // 2️⃣ If both recommended → rank ASC
    if (aRecommended && bRecommended) {
        const aRank = Number.isFinite(a.recommendedRank) ? a.recommendedRank : 9999;
        const bRank = Number.isFinite(b.recommendedRank) ? b.recommendedRank : 9999;

        if (aRank !== bRank) {
            return aRank - bRank;
        }
    }

    // 3️⃣ Downloads DESC
    const aDownloads = a.downloads || 0;
    const bDownloads = b.downloads || 0;

    if (aDownloads !== bDownloads) {
        return bDownloads - aDownloads;
    }

    // 4️⃣ Views DESC
    const aViews = a.views || 0;
    const bViews = b.views || 0;

    if (aViews !== bViews) {
        return bViews - aViews;
    }

    // 5️⃣ FINAL fallback → createdAt DESC
    return new Date(b.createdAt) - new Date(a.createdAt);
};
// Apply sorting to all categories
grouped.notes.sort(sortByPriority);
grouped.handwritten.sort(sortByPriority);
grouped.imp.sort(sortByPriority);
grouped.pyq.sort(sortByPriority);
        const CATEGORY_ORDER = ["notes", "handwritten", "imp", "pyq"];

        const sections = CATEGORY_ORDER
            .filter(cat => grouped[cat].length > 0)
            .map(cat => ({
                category: cat,
                label: {
                    notes: "Notes",
                    handwritten: "Handwritten Notes",
                    imp: "Important Questions",
                    pyq: "Previous Year Papers"
                }[cat],
                items: grouped[cat].map(n => ({
                    id: n._id,
                    title: n.title,
                    downloads: n.downloads || 0,
                    views: n.views || 0,
                    isViewed: viewedSet.has(n._id.toString()),
                    isRecommended: n.recommended || false   // ✅ ADD
                }))
            }));

        return {
            hasData: true,
            subject,
            unit,
            semester,
            focusLabel: `${subject} – Unit ${unit}`,
            totalMaterials: totalCount,
            progress: {
                completed: completedCount,
                total: totalCount,
                percentage
            },
            lastViewedId:   lastViewed.resourceId.toString(), // ✅ ADD THIS
            sections
        };
    } catch (error) {
        console.error("getStudyMaterialForToday error:", error);
        return { hasData: false };
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
 * 🆕 NEW NOTES BADGE
 * 
 * Compares lastHomepageVisit with note createdAt
 * Returns count + preview of new notes for user's semester
 */
async function getNewNotesBadge(userId, user) {
  try {
    const lastVisit    = user.lastHomepageVisit;
    const semester     = user.academicProfile?.semester;

    // ── No previous visit or no semester → skip
    if (!lastVisit || !semester) return { hasNew: false };

    // ── Count new notes since last visit
    const newNotes = await Note.find({
      semester:  { $in: [semester] },
      course:    "BTECH",
      createdAt: { $gt: lastVisit }        // strictly AFTER last visit
    })
      .select("_id title subject category createdAt")
      .sort({ createdAt: -1 })
      .limit(5)                            // preview max 5
      .lean();

    if (!newNotes.length) return { hasNew: false };

    // ── Group subjects for summary text
    // e.g. "Cloud Computing, OS, CN"
    const subjectSet = [...new Set(newNotes.map(n => n.subject))];
    const subjectSummary = subjectSet.slice(0, 3).join(", ")
      + (subjectSet.length > 3 ? ` +${subjectSet.length - 3} more` : "");

    return {
      hasNew:         true,
      count:          newNotes.length,
      sinceLabel:     formatTimeSince(lastVisit),   // "2 hours ago"
      subjectSummary,
      preview: newNotes.map(n => ({
        id:       n._id,
        title:    n.title,
        subject:  n.subject,
        category: n.category,
      }))
    };

  } catch (err) {
    console.error("getNewNotesBadge error:", err);
    return { hasNew: false };
  }
}

/**
 * ⏱ FORMAT TIME SINCE
 * Returns human-readable time like "2 hours ago", "3 days ago"
 */
function formatTimeSince(date) {
  const diffMs      = Date.now() - new Date(date).getTime();
  const diffMins    = Math.floor(diffMs / 60000);
  const diffHours   = Math.floor(diffMins / 60);
  const diffDays    = Math.floor(diffHours / 24);

  if (diffMins  < 60)  return `${diffMins} min ago`;
  if (diffHours < 24)  return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
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
