// CONTROLLERS/search.controller.js
import Note from '../MODELS/note.model.js';
import User from '../MODELS/user.model.js';
import Apperror from "../UTIL/error.util.js";
// Advanced Search Controller
// controllers/search.controller.js
const ALIAS_MAP = {
    ds: ["data structure", "data structures"],
    dsa: ["data structure", "data structures"],
    dbm: ["dbms"],
    dbms: ["database", "database management"],
    coa: ["computer organization"],
    cn: ["computer network", "computer networks"],
    os: ["operating system", "operating systems"]
};

export const searchNotes = async (req, res, next) => {
    try {

        const { query = "", semester, page = 1, limit = 50 } = req.query;

        /* ---------------- NORMALIZE QUERY ---------------- */
        const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
        const tokens = normalized.split(" ");

        let detectedUnit = null;
        let detectedCategory = null;

        let isNotesIntent = false;
        let isHandwrittenIntent = false;
        let isPYQIntent = false;
        let isVideoIntent = false;
        let isImportantIntent = false;

        /* ---------------- CATEGORY MAP (STRICT ONLY) ---------------- */
        const CATEGORY_MAP = {
            pyq: "PYQ",
            pyqs: "PYQ",
            important: "Important Question",
            imp: "Important Question",
            video: "Video"
        };
        // 🔥 PHRASE-LEVEL CATEGORY DETECTION (FIXES SPACE ISSUE)
        if (normalized.includes("important question")) {
            detectedCategory = "Important Question";
            isImportantIntent = true;
        }

        /* ---------------- TOKEN PARSING ---------------- */
        tokens.forEach(t => {
            const unitMatch = t.match(/^unit[-\s]?(\d+)$/);
            if (unitMatch) detectedUnit = Number(unitMatch[1]);

            // CATEGORY detection
            if (CATEGORY_MAP[t]) {
                detectedCategory = CATEGORY_MAP[t];

                // 🔥 ALSO set intent flags
                if (CATEGORY_MAP[t] === "PYQ") isPYQIntent = true;
                if (CATEGORY_MAP[t] === "Video") isVideoIntent = true;
                if (CATEGORY_MAP[t] === "Important Question") isImportantIntent = true;
            }

            // NOTES / HANDWRITTEN intent
            if (t === "notes") isNotesIntent = true;
            if (t === "handwritten") isHandwrittenIntent = true;
        });

        /* ---------------- SUBJECT TOKENS ---------------- */
        let subjectTokens = tokens.filter(
            t =>
                !t.startsWith("unit") &&
                !CATEGORY_MAP[t] &&
                t !== "notes" &&
                t !== "handwritten" &&
                t !== "question" // 🔥 CRITICAL FIX
        );

        // 🔥 Expand aliases (ds → data structure)
        subjectTokens = subjectTokens.flatMap(t => {
            if (ALIAS_MAP[t]) return [t, ...ALIAS_MAP[t]];
            return [t];
        });

        /* ---------------- BASE FILTERS ---------------- */
        const filters = {
            university: "AKTU",
            course: "BTECH"
        };

        if (semester) {
            filters.semester = { $in: [Number(semester)] };
        }

        if (detectedUnit !== null) {
            filters.unit = detectedUnit;
        }

        /* ---------------- CATEGORY FILTER (STRICT ONLY) ---------------- */
        if (
            detectedCategory &&
            ["PYQ", "Important Question", "Video"].includes(detectedCategory)
        ) {
            filters.category = detectedCategory;
        }
        // ❗ Notes & Handwritten never filtered here

        /* ---------------- SAFE SUBJECT SEARCH (🔥 FIX) ---------------- */
        if (subjectTokens.length) {
            filters.$and = subjectTokens.map(t => {
                const safeToken = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                // 🔥 Typo-tolerant regex (substring match)
                const looseRegex = new RegExp(safeToken.slice(0, 4), "i");

                return {
                    $or: [
                        { subject: looseRegex },
                        { title: looseRegex }
                    ]
                };
            });
        }
        // 🔥 INTENT-BASED CATEGORY OVERRIDES

        // 1️⃣ Handwritten only (highest priority)
        // 1️⃣ Handwritten intent ALWAYS wins
        if (isHandwrittenIntent) {
            filters.category = "Handwritten Notes";
        }

        // 2️⃣ Notes intent → Notes + Handwritten
        else if (isNotesIntent) {
            filters.category = { $in: ["Notes", "Handwritten Notes"] };
        }

        // 3️⃣ PYQ / Important / Video already handled earlier


        /* ---------------- QUERY DB ---------------- */
        const notes = await Note.find(filters)
            .populate("uploadedBy", "fullName avatar")
            .sort({
                recommended: -1,
                recommendedRank: 1,
                downloads: -1,
                views: -1,
                createdAt: -1
            })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const totalNotes = await Note.countDocuments(filters);

        /* ---------------- RESPONSE ---------------- */
        const intent = {
            isNotesIntent,
            isHandwrittenIntent,
            isPYQIntent: isPYQIntent || detectedCategory === "PYQ",
            isVideoIntent: isVideoIntent || detectedCategory === "Video",
            isImportantIntent: isImportantIntent || detectedCategory === "Important Question",
            detectedCategory
        };


        res.status(200).json({
            success: true,
            data: {
                notes,
                pagination: {
                    currentPage: Number(page),
                    totalPages: Math.ceil(totalNotes / limit),
                    totalNotes
                },
                intent
            }
        });

    } catch (err) {
        console.error("❌ searchNotes error:", err);
        next(err);
    }
};


// Trending Notes
export const getTrendingNotes = async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const trendingNotes = await Note.aggregate([
            {
                $addFields: {
                    recentActivity: {
                        $cond: [
                            { $gte: ['$updatedAt', sevenDaysAgo] },
                            { $multiply: ['$downloads', 1.5] },
                            '$downloads'
                        ]
                    },
                    avgRating: {
                        $cond: [
                            { $gt: [{ $size: '$rating' }, 0] },
                            { $avg: '$rating.rating' },
                            0
                        ]
                    },
                    bookmarkCount: { $size: '$bookmarkedBy' },
                    trendScore: {
                        $add: [
                            { $multiply: ['$downloads', 0.4] },
                            { $multiply: [{ $avg: '$rating.rating' }, 3] },
                            { $multiply: [{ $size: '$bookmarkedBy' }, 2] }
                        ]
                    }
                }
            },
            { $match: { trendScore: { $gt: 0 } } },
            { $sort: { trendScore: -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'uploadedBy',
                    foreignField: '_id',
                    as: 'uploadedBy'
                }
            },
            { $unwind: '$uploadedBy' }
        ]);

        res.status(200).json({
            success: true,
            message: 'Trending notes retrieved successfully',
            data: trendingNotes
        });
    } catch (error) {
        console.error('Trending notes error:', error);
        return next(new Apperror('Failed to get trending notes', 500));
    }
};

// Popular Notes
export const getPopularNotes = async (req, res, next) => {
    try {
        const popularNotes = await Note.find()
            .populate('uploadedBy', 'fullName avatar')
            .sort({ downloads: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            message: 'Popular notes retrieved successfully',
            data: popularNotes
        });
    } catch (error) {
        console.error('Popular notes error:', error);
        return next(new Apperror('Failed to get popular notes', 500));
    }
};
