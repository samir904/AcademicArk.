import mongoose from "mongoose";
import RelatedNoteClick from "../MODELS/relatedNoteClickModel.js";
import AppError from "../UTIL/error.util.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/notes/related-click
// Auth: optional — works for guests too
// Body: { sourceNoteId, targetNoteId, sectionKey, strategy, device? }
// ─────────────────────────────────────────────────────────────────────────────
export const trackRelatedNoteClick = async (req, res, next) => {
    const { sourceNoteId, targetNoteId, sectionKey, position, strategy, device } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!sourceNoteId || !targetNoteId || !sectionKey || !strategy) {
        return next(new AppError("Missing required tracking fields", 400));
    }

    if (
        !mongoose.Types.ObjectId.isValid(sourceNoteId) ||
        !mongoose.Types.ObjectId.isValid(targetNoteId)
    ) {
        return next(new AppError("Invalid note IDs", 400));
    }

    // ── Fire and forget — don't let tracking failure block the user ───────
    RelatedNoteClick.create({
        sourceNote: sourceNoteId,
        targetNote: targetNoteId,
        sectionKey,
        strategy,
        position,
        device: device ?? "desktop",
        user: req.user?.id ?? null,   // from isLoggedIn middleware if present
    }).catch((err) => {
        // Silent fail — tracking should never crash the app
        console.error("[RelatedNoteClick] Failed to save:", err.message);
    });

    // ── Respond immediately — don't await the DB write ────────────────────
    return res.status(200).json({ success: true });
};


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const DATE_RANGES = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "all": null,
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

const buildDateFilter = (days) => {
  if (!days) return {};

  // Get current time in IST
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);

  // Set to start of today in IST (midnight IST)
  nowIST.setUTCHours(0, 0, 0, 0);

  // Go back `days` days
  nowIST.setUTCDate(nowIST.getUTCDate() - days);

  // Convert back to UTC for MongoDB comparison
  const from = new Date(nowIST.getTime() - IST_OFFSET_MS);

  return { createdAt: { $gte: from } };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/analytics/related-clicks
// Query: ?range=7d | 30d | 90d | all   (default: 30d)
// ─────────────────────────────────────────────────────────────────────────────
export const getRelatedClickAnalytics = async (req, res, next) => {
    try {
        const range = req.query.range ?? "30d";
        const days = DATE_RANGES[range] ?? DATE_RANGES["30d"];
        const dateFilter = buildDateFilter(days);

        const [
            overview,
            bySectionKey,
            byStrategy,
            byDevice,
            topTargetNotes,
            topSourceNotes,
            dailySeries,
            byPosition,      // ← new
        ] = await Promise.all([

            // ── 1. Overview KPIs ──────────────────────────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: null,
                        totalClicks: { $sum: 1 },
                        uniqueTargetNotes: { $addToSet: "$targetNote" },
                        uniqueSourceNotes: { $addToSet: "$sourceNote" },
                        uniqueUsers: { $addToSet: "$user" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        totalClicks: 1,
                        uniqueTargetNotes: { $size: "$uniqueTargetNotes" },
                        uniqueSourceNotes: { $size: "$uniqueSourceNotes" },
                        uniqueUsers: { $size: "$uniqueUsers" },
                    },
                },
            ]),

            // ── 2. Clicks by section key ──────────────────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$sectionKey",
                        clicks: { $sum: 1 },
                    },
                },
                { $sort: { clicks: -1 } },
                {
                    $project: {
                        _id: 0,
                        section: "$_id",
                        clicks: 1,
                    },
                },
            ]),

            // ── 3. Clicks by strategy ─────────────────────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$strategy",
                        clicks: { $sum: 1 },
                    },
                },
                { $sort: { clicks: -1 } },
                {
                    $project: {
                        _id: 0,
                        strategy: "$_id",
                        clicks: 1,
                    },
                },
            ]),

            // ── 4. Clicks by device ───────────────────────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$device",
                        clicks: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        device: "$_id",
                        clicks: 1,
                    },
                },
            ]),

            // ── 5. Top 10 target notes (most clicked) ─────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$targetNote",
                        clicks: { $sum: 1 },
                    },
                },
                { $sort: { clicks: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "notes",
                        localField: "_id",
                        foreignField: "_id",
                        as: "note",
                        pipeline: [
                            {
                                $project: {
                                    title: 1,
                                    category: 1,
                                    subject: 1,
                                    unit: 1,
                                    semester: 1,
                                },
                            },
                        ],
                    },
                },
                { $unwind: { path: "$note", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        noteId: "$_id",
                        clicks: 1,
                        title: { $ifNull: ["$note.title", "Deleted Note"] },
                        category: { $ifNull: ["$note.category", "—"] },
                        subject: { $ifNull: ["$note.subject", "—"] },
                        unit: "$note.unit",
                    },
                },
            ]),

            // ── 6. Top 10 source notes (drive most related clicks) ────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$sourceNote",
                        clicks: { $sum: 1 },
                    },
                },
                { $sort: { clicks: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "notes",
                        localField: "_id",
                        foreignField: "_id",
                        as: "note",
                        pipeline: [
                            {
                                $project: {
                                    title: 1,
                                    category: 1,
                                    subject: 1,
                                    unit: 1,
                                },
                            },
                        ],
                    },
                },
                { $unwind: { path: "$note", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        noteId: "$_id",
                        clicksGenerated: "$clicks",
                        title: { $ifNull: ["$note.title", "Deleted Note"] },
                        category: { $ifNull: ["$note.category", "—"] },
                        subject: { $ifNull: ["$note.subject", "—"] },
                        unit: "$note.unit",
                    },
                },
            ]),

            // ── 7. Daily click series (last N days, fills 0 gaps) ────────────
            // ── 7. Daily click series ─────────────────────────────────────────────────
RelatedNoteClick.aggregate([
  { $match: dateFilter },
  {
    $group: {
      _id: {
        $dateToString: {
          format:   "%Y-%m-%d",
          date:     "$createdAt",
          timezone: "Asia/Kolkata",   // ← IST grouping
        },
      },
      clicks: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id:    0,
      date:   "$_id",
      clicks: 1,
    },
  },
]),
            // ── 8. Avg click position per section ─────────────────────────────────────
            RelatedNoteClick.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: "$sectionKey",
                        avgPosition: { $avg: "$position" },
                        clicks: { $sum: 1 },
                        // Distribution: how many clicks at pos 1, 2, 3, 4+
                        pos1: { $sum: { $cond: [{ $eq: ["$position", 1] }, 1, 0] } },
                        pos2: { $sum: { $cond: [{ $eq: ["$position", 2] }, 1, 0] } },
                        pos3: { $sum: { $cond: [{ $eq: ["$position", 3] }, 1, 0] } },
                        pos4plus: { $sum: { $cond: [{ $gte: ["$position", 4] }, 1, 0] } },
                    },
                },
                { $sort: { avgPosition: 1 } },  // sorted best (lowest avg) first
                {
                    $project: {
                        _id: 0,
                        section: "$_id",
                        avgPosition: { $round: ["$avgPosition", 1] },
                        clicks: 1,
                        distribution: {
                            pos1: "$pos1",
                            pos2: "$pos2",
                            pos3: "$pos3",
                            pos4plus: "$pos4plus",
                        },
                    },
                },
            ]),

        ]);

        return res.status(200).json({
            success: true,
            range,
            data: {
                overview: overview[0] ?? { totalClicks: 0, uniqueTargetNotes: 0, uniqueSourceNotes: 0, uniqueUsers: 0 },
                bySectionKey,
                byStrategy,
                byDevice,
                topTargetNotes,
                topSourceNotes,
                dailySeries,
                byPosition,    // ← new
            },
        });

    } catch (err) {
        next(err);
    }
};