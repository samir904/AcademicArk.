// CONTROLLERS/homepage.controller.js
import asyncWrap from "../UTIL/asyncWrap.js";
import User from "../MODELS/user.model.js";
import Note from "../MODELS/note.model.js";
import UserActivity from "../MODELS/userActivity.model.js";
import Attendance from "../MODELS/attendance.model.js";
import Leaderboard from "../MODELS/leaderboard.model.js";
import ArkShotCollection from "../MODELS/arkShotCollection.model.js";
import { isFeatureEnabled } from "../UTIL/featureFlags.js";
import SubjectMeta from "../MODELS/SubjectMeta.model.js";
import SubjectAnalytics from "../MODELS/SubjectAnalytics.model.js";
import { getYearComparisonMatrix as fetchYearMatrix } from "../services/analytics.service.js";
import redis from "../CONFIG/redisClient.js";

// ── Sem-aware fallback subjects ─────────────────────────────────────────────
// Add new sems here as analytics data becomes available
const SEM_FALLBACK_SUBJECT = {
    // 3: "data structure",
    4: "operating system",
    // 5: "database management system",
    6: "computer networks",
};

/**
 * 📌 GET PERSONALIZED HOMEPAGE DATA
 */
export const getPersonalizedHomepage = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ STEP 1: Check Redis cache first (5 min TTL)
        const cacheKey = `homepage:${userId}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            // ── Re-evaluate flag-gated + always-fresh sections even on cache hit
            const user = await User.findById(userId)
                .select("academicProfile lastHomepageVisit")
                .lean();

            const showArkShots = await isFeatureEnabled("arkshots_homepage_section", user);

            const [featuredCollections, subjectHeatmap,semesterSubjects] = await Promise.all([
                showArkShots
                    ? getFeaturedArkShotCollections(userId, user)
                    : Promise.resolve(null),
                getHomepageSubjectHeatmap(userId, user),
                getSemesterSubjects(user),             // ← ADD
            ]);

            return res.status(200).json({
                success:   true,
                data:      { ...JSON.parse(cachedData), featuredCollections, subjectHeatmap,semesterSubjects },
                fromCache: true,
                message:   "Homepage data from cache",
            });
        }

        // ✅ STEP 2: Fetch user with academic profile
        const user = await User.findById(userId).select(
            "fullName academicProfile personalizationSettings lastHomepageVisit"
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ── Feature flags (AFTER user is fetched)
        const showArkShots = await isFeatureEnabled("arkshots_homepage_section", user);

        // ✅ STEP 4: All sections simultaneously
        const [
            continueWhere,
            studyMaterialToday,
            recommended,
            trending,
            examAlert,
            attendance,
            leaderboard,
            downloads,
            newNotesBadge,
            featuredCollections,
            subjectHeatmap,          // ✅ NEW
            semesterSubjects,              // ← ADD
        ] = await Promise.all([
            getContinueWhere(userId, user),
            getStudyMaterialForToday(userId, user),
            getRecommendedNotes(userId, user),
            getTrendingInSemester(userId, user),
            getExamAlert(userId, user),
            getAttendanceSnapshot(userId, user),
            getLeaderboardPreview(userId),
            getDownloadsSnapshot(userId),
            getNewNotesBadge(userId, user),
            showArkShots
                ? getFeaturedArkShotCollections(userId, user)
                : Promise.resolve(null),
            getHomepageSubjectHeatmap(userId, user),  // ✅ NEW
            getSemesterSubjects(user),     // ← ADD
        ]);

        // ── Build cacheable data (flag-independent + stable fields only)
        const cacheableData = {
            greeting: buildGreeting(user),
            continue: continueWhere,
            studyMaterialToday,
            newNotesBadge,
            recommended,
            trending,
            examAlert,
            attendance,
            leaderboard,
            downloads,
            semesterSubjects,              // ← ADD here (cacheable, stable)
            metadata: {
                timestamp:       new Date(),
                profileComplete: user.academicProfile?.isCompleted || false,
                userSemester:    user.academicProfile?.semester || null,
                userBranch:      user.academicProfile?.branch || null,
            },
        };

        // ✅ Cache only stable data — NOT flag-gated or activity-derived sections
        await redis.setEx(cacheKey, 300, JSON.stringify(cacheableData));

        // ── Merge fresh sections AFTER caching
        const homepageData = {
            ...cacheableData,
            featuredCollections,  // always fresh, never cached
            subjectHeatmap,       // always fresh — depends on last activity
        };

        // ✅ STEP 5: Update last homepage visit
        await User.findByIdAndUpdate(userId, { lastHomepageVisit: new Date() }, { new: true });

        // ✅ STEP 6: Log activity (async - non-blocking)
        logActivityAsync(userId, "HOMEPAGE_VIEWED");

        res.status(200).json({
            success:   true,
            data:      homepageData,
            fromCache: false,
            message:   "Personalized homepage data loaded",
        });

    } catch (error) {
        console.error("Homepage controller error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load homepage",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};


// ============================================
// HELPER FUNCTIONS
// ============================================

function buildGreeting(user) {
    const hour = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour:     "2-digit",
        hour12:   false,
    });
    let timeOfDay = "Good morning";
    if (hour >= 12 && hour < 17) timeOfDay = "Good afternoon";
    if (hour >= 17) timeOfDay = "Good evening";

    return {
        message:         `${timeOfDay}, ${user.fullName.split(" ")[0]} 👋`,
        fullName:        user.fullName,
        semester:        user.academicProfile?.semester || null,
        branch:          user.academicProfile?.branch || null,
        profileComplete: user.academicProfile?.isCompleted || false,
    };
}

async function getContinueWhere(userId, user) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const lastViewed = await UserActivity.findOne({
            userId,
            activityType: "NOTE_VIEWED",
            createdAt:    { $gte: sevenDaysAgo },
        })
            .sort({ createdAt: -1 })
            .select("resourceId subject unit createdAt");

        if (lastViewed?.resourceId) {
            const note = await Note.findById(lastViewed.resourceId).select(
                "title subject category downloads views"
            );
            if (note) {
                return {
                    type:        "LAST_VIEWED",
                    lastViewedAt: lastViewed.createdAt,
                    note: {
                        id:       note._id,
                        title:    note.title.substring(0, 50),
                        subject:  note.subject,
                        category: note.category,
                        downloads: note.downloads,
                        views:    note.views,
                    },
                    action: "Continue Reading",
                };
            }
        }

        const lastDownloaded = await UserActivity.findOne({
            userId,
            activityType: "NOTE_DOWNLOADED",
            createdAt:    { $gte: sevenDaysAgo },
        })
            .sort({ createdAt: -1 })
            .select("resourceId subject createdAt");

        if (lastDownloaded?.resourceId) {
            const note = await Note.findById(lastDownloaded.resourceId).select(
                "title subject category"
            );
            if (note) {
                return {
                    type:        "LAST_DOWNLOADED",
                    lastViewedAt: lastDownloaded.createdAt,
                    lastDownloadedNote: {
                        id:           note._id,
                        title:        note.title,
                        subject:      note.subject,
                        downloadedAt: lastDownloaded.createdAt,
                    },
                    action: "Continue Reading",
                };
            }
        }

        if (user.academicProfile?.semester) {
            return {
                type:    "SUGGESTION",
                message: `Start with Unit-1 notes for Semester ${user.academicProfile.semester}`,
                action:  "Explore Now",
                link:    `/notes?semester=${user.academicProfile.semester}&unit=1`,
            };
        }

        return {
            type:    "EMPTY",
            message: "Complete your profile to get personalized suggestions",
            action:  "Complete Profile",
        };

    } catch (error) {
        console.error("getContinueWhere error:", error);
        return null;
    }
}
async function getRecommendedNotes(userId, user) {
    try {
        if (!user.academicProfile?.semester) {
            return { hasData: false, message: "Complete your academic profile for recommendations" };
        }

        const semester = user.academicProfile.semester;

        const recommended = await Note.aggregate([
            {
                $match: {
                    semester: semester,
                    course:   "BTECH",
                }
            },
            {
                $addFields: {
                    // ── Tier: 0 = admin-curated, 1 = popularity-based ──────────
                    _tier: { $cond: ["$recommended", 0, 1] },

                    // ── Rank within curated (lower = better) ──────────────────
                    _curatedRank: {
                        $cond: [
                            "$recommended",
                            { $ifNull: ["$recommendedRank", 9999] },
                            9999
                        ]
                    },

                    // ── Popularity score for non-curated fill ─────────────────
                    _popularityScore: {
                        $add: [
                            { $multiply: [{ $ifNull: ["$downloads", 0] }, 0.4] },
                            { $multiply: [{ $ifNull: ["$views",     0] }, 0.4] },
                            {
                                $multiply: [
                                    { $divide: [{ $subtract: [new Date(), "$updatedAt"] }, 86400000] },
                                    -0.2,
                                ]
                            }
                        ]
                    }
                }
            },
            {
                // ── Sort: curated tier first → rank ASC → popularity DESC ─────
                $sort: {
                    _tier:            1,   // 0 (curated) before 1 (popularity)
                    _curatedRank:     1,   // within curated: rank 1 → 2 → 3
                    _popularityScore: -1   // within non-curated: best first
                }
            },
            { $limit: 6 },
            {
                $project: {
                    _id: 1, title: 1, subject: 1, category: 1,
                    downloads: 1, views: 1, uploadedBy: 1,
                    recommended:     1,    // ✅ expose to frontend
                    recommendedRank: 1,
                    totalBookmarks: { $size: "$bookmarkedBy" },
                    avgRating: {
                        $cond: [
                            { $gt: [{ $size: "$rating" }, 0] },
                            { $divide: [{ $sum: "$rating.rating" }, { $size: "$rating" }] },
                            0,
                        ],
                    },
                },
            },
        ]);

        if (!recommended.length) return { hasData: false, message: "No notes available for your semester yet" };

        return {
            hasData: true,
            section: `Recommended for Semester ${semester}`,
            notes:   recommended.map(note => ({
                id:            note._id,
                title:         note.title.substring(0, 60),
                subject:       note.subject,
                category:      note.category,
                downloads:     note.downloads || 0,
                views:         note.views || 0,
                rating:        (note.avgRating || 0).toFixed(1),
                bookmarks:     note.totalBookmarks || 0,
                isRecommended: note.recommended || false,  // ✅ frontend badge
            })),
        };

    } catch (error) {
        console.error("getRecommendedNotes error:", error);
        return { hasData: false, error: true };
    }
}
async function getTrendingInSemester(userId, user) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const semester = user.academicProfile?.semester;
    if (!semester) return { hasData: false };

    const semesterNoteIds = await Note.distinct("_id", {
        semester: { $in: [semester] },
        course:   "BTECH",
    });

    const trendingActivities = await UserActivity.aggregate([
        {
            $match: {
                activityType: { $in: ["NOTE_VIEWED", "NOTE_DOWNLOADED"] },
                resourceId:   { $in: semesterNoteIds },
                createdAt:    { $gte: sevenDaysAgo },
            },
        },
        { $group: { _id: "$resourceId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
    ]);

    const noteIds = trendingActivities.map(a => a._id);
    if (!noteIds.length) return { hasData: false, message: "No trending notes yet" };

    const trending = await Note.find({ _id: { $in: noteIds } })
        .select("title subject category downloads views");

    const trendingMap = new Map(trending.map(n => [n._id.toString(), n]));
    const ordered = noteIds.map(id => trendingMap.get(id.toString())).filter(Boolean);

    return {
        hasData: true,
        section: `Trending in Semester ${semester}`,
        notes:   ordered.map((note, i) => ({
            rank:      i + 1,
            id:        note._id,
            title:     note.title.substring(0, 45),
            subject:   note.subject,
            category:  note.category,
            downloads: note.downloads || 0,
        })),
    };
}

async function getAttendanceSnapshot(userId, user) {
    try {
        if (!user.academicProfile?.semester) return null;
        const semester = String(user.academicProfile.semester);
        const attendance = await Attendance.findOne({ user: userId, semester });

        if (!attendance || attendance.subjects.length === 0) {
            return { hasData: false, message: "Start tracking your attendance" };
        }

        let totalPresent = 0, totalClasses = 0, belowTarget = 0;

        attendance.subjects.forEach(subject => {
            const present = subject.initialPresentClasses +
                subject.records.filter(r => r.status === "present").length;
            const total = subject.initialTotalClasses + subject.records.length;
            const percentage = total > 0 ? (present / total) * 100 : 0;
            totalPresent += present;
            totalClasses += total;
            if (percentage < subject.targetPercentage) belowTarget++;
        });

        const overallPercentage = totalClasses > 0
            ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2))
            : 0;

        return {
            hasData:          true,
            overallPercentage,
            totalSubjects:    attendance.subjects.length,
            subjectsBelow75:  belowTarget,
            status:           overallPercentage >= 75 ? "SAFE" : "RISK",
            primaryMessage:   overallPercentage >= 75
                ? "You are in the safe zone 👍"
                : "Attendance needs attention ⚠️",
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
            snapshotType:    "DAILY",
        }).sort({ generatedAt: -1 }).lean();

        if (!leaderboard) return null;

        return {
            hasData:      true,
            generatedAt:  leaderboard.generatedAt,
            topEntries:   leaderboard.entries.slice(0, 5).map(e => ({
                rank:  e.rank,
                name:  e.userName,
                score: e.metrics.engagement,
            })),
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
            activityType: "NOTE_DOWNLOADED",
        });

        const lastDownloaded = await UserActivity.findOne({
            userId,
            activityType: "NOTE_DOWNLOADED",
        })
            .sort({ createdAt: -1 })
            .populate("resourceId", "title subject");   // ✅ id is always included in populate

        return {
            hasData: totalDownloads > 0,
            totalDownloads,
            lastDownloadedNote: lastDownloaded
                ? {
                    id:      lastDownloaded.resourceId?._id,   // ✅ ADD
                    title:   lastDownloaded.resourceId?.title,
                    subject: lastDownloaded.resourceId?.subject,
                }
                : null,
        };

    } catch (err) {
        console.error("Downloads snapshot error:", err);
        return null;
    }
}

async function getStudyMaterialForToday(userId, user) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const lastViewed = await UserActivity.findOne({
            userId,
            activityType: "NOTE_VIEWED",
            createdAt:    { $gte: sevenDaysAgo },
        }).sort({ createdAt: -1 }).select("resourceId").lean();

        if (!lastViewed?.resourceId) return { hasData: false };

        const sourceNote = await Note.findById(lastViewed.resourceId)
            .select("subject unit semester").lean();

        if (!sourceNote?.subject || !sourceNote?.unit) return { hasData: false };

        const { subject, unit, semester } = sourceNote;

        const allMaterials = await Note.find({
            subject,
            $or: [
                { unit },
                { unit: null },
                { unit: { $exists: false } },
            ],
        }).select("_id title subject unit category downloads views createdAt recommended recommendedRank").lean();

        if (!allMaterials.length) return { hasData: false };

        const materialIds = allMaterials.map(n => n._id);

        const viewedIds = await UserActivity.distinct("resourceId", {
            userId,
            activityType: "NOTE_VIEWED",
            resourceId:   { $in: materialIds },
        });

        const viewedSet      = new Set(viewedIds.map(id => id.toString()));
        const completedCount = viewedSet.size;
        const totalCount     = materialIds.length;
        const percentage     = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const grouped = { notes: [], handwritten: [], imp: [], pyq: [] };

        for (const note of allMaterials) {
            switch (note.category) {
                case "Notes":
                    if (note.unit === unit) grouped.notes.push(note);
                    break;
                case "Handwritten Notes":
                    if (note.unit === unit) grouped.handwritten.push(note);
                    break;
                case "Important Question":
                    if (note.unit === unit || !note.unit) grouped.imp.push(note);
                    break;
                case "PYQ":
                    if (note.unit === unit || !note.unit) grouped.pyq.push(note);
                    break;
            }
        }

        const sortByPriority = (a, b) => {
            const aR = !!a.recommended, bR = !!b.recommended;
            if (aR !== bR) return aR ? -1 : 1;
            if (aR && bR) {
                const aRank = Number.isFinite(a.recommendedRank) ? a.recommendedRank : 9999;
                const bRank = Number.isFinite(b.recommendedRank) ? b.recommendedRank : 9999;
                if (aRank !== bRank) return aRank - bRank;
            }
            const dDiff = (b.downloads || 0) - (a.downloads || 0);
            if (dDiff !== 0) return dDiff;
            const vDiff = (b.views || 0) - (a.views || 0);
            if (vDiff !== 0) return vDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
        };

        grouped.notes.sort(sortByPriority);
        grouped.handwritten.sort(sortByPriority);
        grouped.imp.sort(sortByPriority);
        grouped.pyq.sort(sortByPriority);

        const sections = ["notes", "handwritten", "imp", "pyq"]
            .filter(cat => grouped[cat].length > 0)
            .map(cat => ({
                category: cat,
                label:    { notes: "Notes", handwritten: "Handwritten Notes", imp: "Important Questions", pyq: "Previous Year Papers" }[cat],
                items:    grouped[cat].map(n => ({
                    id:            n._id,
                    title:         n.title,
                    downloads:     n.downloads || 0,
                    views:         n.views || 0,
                    isViewed:      viewedSet.has(n._id.toString()),
                    isRecommended: n.recommended || false,
                })),
            }));

        return {
            hasData: true,
            subject, unit, semester,
            focusLabel:     `${subject} – Unit ${unit}`,
            totalMaterials: totalCount,
            progress:       { completed: completedCount, total: totalCount, percentage },
            lastViewedId:   lastViewed.resourceId.toString(),
            sections,
        };

    } catch (error) {
        console.error("getStudyMaterialForToday error:", error);
        return { hasData: false };
    }
}

async function getExamAlert(userId, user) {
    try {
        return { hasExamSoon: false, daysUntilExam: null, message: null };
    } catch (error) {
        console.error("getExamAlert error:", error);
        return { hasExamSoon: false, error: true };
    }
}

async function getFeaturedArkShotCollections(userId, user) {
    try {
        const semester = user.academicProfile?.semester ?? null;
        const semesterFilter = semester ? { $in: [semester, null] } : null;

        const match = {
            isActive:   true,
            isFeatured: true,
            ...(semesterFilter && { semester: semesterFilter }),
        };

        const collections = await ArkShotCollection
            .find(match)
            .sort({ order: 1, "stats.totalOpens": -1 })
            .limit(7)
            .select(
                "name description subject semester unit emoji " +
                "coverTemplate colorTheme totalShots " +
                "stats.totalOpens stats.shotsViewed order"
            )
            .lean();

        if (!collections.length) return { hasData: false };

        return {
            hasData:     true,
            collections: collections.map(c => ({
                id:           c._id,
                name:         c.name,
                description:  c.description || null,
                subject:      c.subject || null,
                semester:     c.semester || null,
                unit:         c.unit || null,
                emoji:        c.emoji || "📦",
                coverTemplate: c.coverTemplate || "gradient",
                colorTheme:   c.colorTheme || "",
                totalShots:   c.totalShots || 0,
                totalOpens:   c.stats?.totalOpens || 0,
                shotsViewed:  c.stats?.shotsViewed || 0,
            })),
        };

    } catch (err) {
        console.error("getFeaturedArkShotCollections error:", err);
        return { hasData: false };
    }
}

async function getNewNotesBadge(userId, user) {
    try {
        const lastVisit = user.lastHomepageVisit;
        const semester  = user.academicProfile?.semester;

        if (!lastVisit || !semester) return { hasNew: false };

        const newNotes = await Note.find({
            semester:  { $in: [semester] },
            course:    "BTECH",
            createdAt: { $gt: lastVisit },
        })
            .select("_id title subject category createdAt")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        if (!newNotes.length) return { hasNew: false };

        const subjectSet     = [...new Set(newNotes.map(n => n.subject))];
        const subjectSummary = subjectSet.slice(0, 3).join(", ")
            + (subjectSet.length > 3 ? ` +${subjectSet.length - 3} more` : "");

        return {
            hasNew:         true,
            count:          newNotes.length,
            sinceLabel:     formatTimeSince(lastVisit),
            subjectSummary,
            preview: newNotes.map(n => ({
                id:       n._id,
                title:    n.title,
                subject:  n.subject,
                category: n.category,
            })),
        };

    } catch (err) {
        console.error("getNewNotesBadge error:", err);
        return { hasNew: false };
    }
}
// homepage.controller.js — ADD this helper function

async function getSemesterSubjects(user) {
    try {
        const semester = user.academicProfile?.semester ?? null;
        if (!semester) return { hasData: false, subjects: [] };

        // Cache key is semester-level, shared across all users (subjects rarely change)
        const cacheKey = `homepage:subjects:sem${semester}`;
        const cached   = await redis.get(cacheKey);
        if (cached) return { hasData: true, semester, subjects: JSON.parse(cached), fromCache: true };

        const subjects = await SubjectMeta.find(
            {
                $or: [
                    { semester: semester },
                    { semester: { $elemMatch: { $eq: semester } } },
                ],
            },
            {
                _id:                 1,   // subjectCode e.g. "CN"
                name:                1,   // "Computer Networks"
                code:                1,   // "cn"
                totalUnits:          1,
                analyticsReady:      1,   // show PYQ badge on card if true
                totalPapersAnalysed: 1,
                branch:              1,
            }
        )
            .sort({ name: 1 })
            .lean();

        const shaped = subjects.map(s => ({
            subjectCode:         s._id,
            name:                s.name,
            code:                s.code,
            totalUnits:          s.totalUnits          ?? 0,
            analyticsReady:      s.analyticsReady      ?? false,
            totalPapersAnalysed: s.totalPapersAnalysed ?? 0,
            branch:              s.branch              ?? [],
        }));

        // Cache at semester level — 10 min TTL (subjects change very rarely)
        await redis.setEx(cacheKey, 600, JSON.stringify(shaped));

        return {
            hasData:  shaped.length > 0,
            semester,
            subjects: shaped,
        };

    } catch (err) {
        console.error("getSemesterSubjects error:", err);
        return { hasData: false, subjects: [] };
    }
}
// ============================================
// 🆕 HOMEPAGE SUBJECT HEATMAP
// ============================================

/**
 * 🔥 HOMEPAGE SUBJECT HEATMAP
 *
 * Priority:
 * 1. Last viewed note's subject (last 7 days) — if SubjectAnalytics exists
 * 2. Fallback to SEM_FALLBACK_SUBJECT[userSem] — only if defined
 * 3. No fallback for unknown sems → hasData: false
 *
 * Mode:
 * - "unit"    → if last viewed note had a unit number
 * - "subject" → full subject overview heatmap
 *
 * subjectHeatmap is NEVER cached — always fresh (depends on last activity)
 */
async function getHomepageSubjectHeatmap(userId, user) {
    try {
        const userSem = user.academicProfile?.semester ?? null;

        // ── No semester on profile → nothing to show ─────────────────────────
        if (!userSem) return { hasData: false };

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // ── STEP 1: Get last viewed note (last 7 days) ────────────────────────
        const lastViewed = await UserActivity.findOne({
            userId,
            activityType: "NOTE_VIEWED",
            createdAt:    { $gte: sevenDaysAgo },
        })
            .sort({ createdAt: -1 })
            .select("resourceId")
            .lean();

        let targetSubjectName = null;
        let targetUnitNumber  = null;

        if (lastViewed?.resourceId) {
            const sourceNote = await Note.findById(lastViewed.resourceId)
                .select("subject unit")
                .lean();

            if (sourceNote?.subject) {
                targetSubjectName = sourceNote.subject;
                targetUnitNumber  = sourceNote.unit ? Number(sourceNote.unit) : null;
            }
        }

        // ── STEP 2: Resolve SubjectMeta for the activity subject ──────────────
        let resolvedSubject = null;

        if (targetSubjectName) {
            resolvedSubject = await _resolveSubjectWithAnalytics(targetSubjectName, userSem);
        }

        // ── STEP 3: Fallback if no activity or no analytics for activity subject
        let fallbackUsed = false;

        if (!resolvedSubject) {
            const fallbackName = SEM_FALLBACK_SUBJECT[userSem];

            // Only sem 3/4/5/6 have defined fallbacks right now
            if (!fallbackName) return { hasData: false };

            resolvedSubject = await _resolveSubjectWithAnalytics(fallbackName, userSem);

            // Fallback subject also has no analytics → nothing to show
            if (!resolvedSubject) return { hasData: false };

            fallbackUsed     = true;
            targetUnitNumber = null; // fallback always shows subject overview
        }

        const { subject, analytics } = resolvedSubject;

        // ── STEP 4: Unit mode — user was on a specific unit ───────────────────
        if (targetUnitNumber && !fallbackUsed) {
            return await _buildUnitHeatmap(subject, analytics, targetUnitNumber, fallbackUsed, userSem);
        }

        // ── STEP 5: Subject overview mode ─────────────────────────────────────
        return _buildSubjectHeatmap(subject, analytics, fallbackUsed, userSem);

    } catch (err) {
        console.error("getHomepageSubjectHeatmap error:", err);
        return { hasData: false };
    }
}

/**
 * Resolves SubjectMeta + SubjectAnalytics for a given subject name + semester.
 * Returns { subject, analytics } or null if either is missing.
 */
async function _resolveSubjectWithAnalytics(subjectName, semester) {
    // Flexible name match — same approach as getSubjectBrief in pyq.controller
    const words      = subjectName.trim().toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const regexParts = words.map(w => `(?=.*${w})`).join("");
    const flexRegex  = new RegExp(`^${regexParts}`, "i");

    const subject = await SubjectMeta.findOne(
        { name: { $regex: flexRegex }, semester: Number(semester) },
        { _id: 1, name: 1, code: 1 }
    ).lean();

    if (!subject) return null;

    const analytics = await SubjectAnalytics.findOne(
        { subjectCode: subject._id },
        {
            "units.unitId":                          1,
            "units.unitNumber":                      1,
            "units.title":                           1,
            "units.avgMarksPerPaper":                1,
            "units.priorityRank":                    1,
            "units.predictionTag":                   1,
            "units.frequencyScore":                  1,
            "units.topics.canonicalName":            1,
            "units.topics.totalAppearances":         1,
            "units.topics.appearedInYears":          1,
            "units.topics.predictionTag":            1,
            "units.topics.predictionScore":          1,
            "units.topics.twoMarkCount":             1,
            "units.topics.sevenMarkCount":           1,
            "units.topics.tenMarkCount":             1,
            "overallInsights.yearWiseUnitWeightage": 1,
            "overallInsights.unitWeightage":         1,
            "trustMeta":                             1,
            "totalPapersAnalysed":                   1,
            "yearsCovered":                          1,
        }
    ).lean();

    if (!analytics) return null;

    return { subject, analytics };
}

/**
 * Builds subject-level overview heatmap response.
 * Same data shape as getSubjectBrief "subject" mode.
 */
function _buildSubjectHeatmap(subject, analytics, fallbackUsed, userSem) {
    const allYears          = (analytics.yearsCovered ?? []).sort((a, b) => a - b);
    const yearWiseWeightage = analytics.overallInsights?.yearWiseUnitWeightage ?? {};

    const units = analytics.units
        .sort((a, b) => a.unitNumber - b.unitNumber)
        .map(u => ({
            unitId:           u.unitId,
            unitNumber:       u.unitNumber,
            title:            u.title,
            avgMarksPerPaper: u.avgMarksPerPaper,
            priorityRank:     u.priorityRank,
            predictionTag:    u.predictionTag,
        }));

    const heatmapRows = analytics.units
        .sort((a, b) => a.unitNumber - b.unitNumber)
        .map(u => {
            const unitNum   = String(u.unitNumber);
            const yearMarks = {};
            for (const year of allYears) {
                const marks = yearWiseWeightage[year]?.[unitNum] ?? null;
                yearMarks[year] = { asked: marks !== null && marks > 0, marks: marks ?? 0 };
            }
            return {
                unitId:           u.unitId,
                unitNumber:       u.unitNumber,
                title:            u.title,
                avgMarksPerPaper: u.avgMarksPerPaper,
                years:            yearMarks,
            };
        });

    // Quick insight — heaviest unit + most repeated topic
    const heaviest  = [...units].sort((a, b) => (b.avgMarksPerPaper ?? 0) - (a.avgMarksPerPaper ?? 0))[0];
    let hotTopicName = null;
    for (const u of analytics.units) {
        for (const t of u.topics ?? []) {
            if (!hotTopicName || (t.totalAppearances ?? 0) > 0) {
                if ((t.totalAppearances ?? 0) >= 3) hotTopicName = t.canonicalName;
            }
        }
    }
    const insightParts = [];
    if (hotTopicName) insightParts.push(`${hotTopicName} asked every year`);
    if (heaviest)     insightParts.push(`Unit ${heaviest.unitNumber} carries the most marks`);
    const quickInsight = insightParts.join(" · ") || null;

    return {
        hasData:      true,
        mode:         "subject",
        fallbackUsed,
        // fallback CTA — frontend uses this to show "View all subjects →" button
        fallbackCTA: fallbackUsed
            ? { label: "View all subjects", link: `/notes?semester=${userSem}` }
            : null,
        subjectCode:         subject._id,
        subjectName:         subject.name,
        totalPapersAnalysed: analytics.totalPapersAnalysed,
        yearsCovered:        allYears,
        trustMeta:           analytics.trustMeta,
        quickInsight,
        units,
        heatmap: {
            years: allYears,
            rows:  heatmapRows,
        },
    };
}

/**
 * Builds unit-level deep-dive heatmap response.
 * Same data shape as getSubjectBrief "unit" mode.
 * Falls back to subject mode if targetUnit not found in analytics.
 */
async function _buildUnitHeatmap(subject, analytics, targetUnitNumber, fallbackUsed, userSem) {
    const unit = analytics.units.find(u => u.unitNumber === targetUnitNumber);

    // Unit not in analytics → fall back gracefully to subject overview
    if (!unit) return _buildSubjectHeatmap(subject, analytics, fallbackUsed, userSem);

    const allYears   = (analytics.yearsCovered ?? []).sort((a, b) => a - b);
    const totalYears = allYears.length;

    const unitYears = [
        ...new Set((unit.topics ?? []).flatMap(t => t.appearedInYears ?? [])),
    ].sort();

    const markTotals = {
        "2M":  (unit.topics ?? []).reduce((s, t) => s + (t.twoMarkCount  ?? 0), 0),
        "7M":  (unit.topics ?? []).reduce((s, t) => s + (t.sevenMarkCount ?? 0), 0),
        "10M": (unit.topics ?? []).reduce((s, t) => s + (t.tenMarkCount   ?? 0), 0),
    };
    const topMarkType = Object.entries(markTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const hotTopics = (unit.topics ?? [])
        .filter(t => (t.totalAppearances ?? 0) >= 2)
        .sort((a, b) => (b.totalAppearances ?? 0) - (a.totalAppearances ?? 0))
        .slice(0, 3)
        .map(t => ({
            topicId:           t.topicId,
            canonicalName:     t.canonicalName,
            totalAppearances:  t.totalAppearances,
            lastAskedYear:     t.lastAskedYear,
            predictionTag:     t.predictionTag,
            appearedEveryYear: (t.appearedInYears?.length ?? 0) >= totalYears,
        }));

    const insightParts = [];
    if (hotTopics[0]) {
        insightParts.push(
            hotTopics[0].appearedEveryYear
                ? `${hotTopics[0].canonicalName} asked every year`
                : `${hotTopics[0].canonicalName} most repeated`
        );
    }
    if (topMarkType) insightParts.push(`${topMarkType} questions dominate`);
    const unitInsight = insightParts.join(" · ") || null;

    // Topic × year heatmap via analytics service
    let heatmap = null;
    try {
        heatmap = await fetchYearMatrix(subject._id, unit.unitId);
    } catch (e) {
        console.warn("fetchYearMatrix failed for homepage heatmap, skipping:", e.message);
    }

    const sortedTopics = [...(unit.topics ?? [])].sort(
        (a, b) => (b.predictionScore ?? 0) - (a.predictionScore ?? 0)
    );

    return {
        hasData:      true,
        mode:         "unit",
        fallbackUsed: false, // unit mode is always activity-driven, never fallback
        fallbackCTA:  null,
        subjectCode:  subject._id,
        subjectName:  subject.name,
        unitNumber:   unit.unitNumber,
        unitTitle:    unit.title,
        unitId:       unit.unitId,
        frequencyScore:   unit.frequencyScore,
        avgMarksPerPaper: unit.avgMarksPerPaper,
        predictionTag:    unit.predictionTag,
        appearedInYears:  unitYears.length,
        totalYearsAvailable: totalYears,
        years:       unitYears,
        topMarkType,
        isFrequent:  unitYears.length >= 3,
        unitInsight,
        hotTopics,
        topics:      sortedTopics,
        heatmap,
        trustMeta:   analytics.trustMeta,
        yearsCovered: allYears,
        // ── nav link back to full subject on notes page
        viewAllLink: `/notes?semester=${userSem}&subject=${encodeURIComponent(subject.name)}`,
    };
}

// ============================================
// UTILITIES
// ============================================

function formatTimeSince(date) {
    const diffMs    = Date.now() - new Date(date).getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);

    if (diffMins < 60)  return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function logActivityAsync(userId, activityType) {
    setImmediate(async () => {
        try {
            await UserActivity.create({ userId, activityType, resourceType: null, metadata: {} });
        } catch (error) {
            console.error("Error logging activity:", error);
        }
    });
}

export const invalidateHomepageCache = async (userId) => {
    await redis.del(`homepage:${userId}`);
};

export const clearUserCache = async (userId) => {
    const keys = await redis.keys(`homepage:${userId}*`);
    if (keys.length > 0) await redis.del(...keys);
};