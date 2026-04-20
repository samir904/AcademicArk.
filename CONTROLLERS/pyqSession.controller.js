import PYQSession from "../MODELS/PYQSession.model.js";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const getDevice = (req) => {
  const ua = req.headers["user-agent"] || "";
  return /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
};

// Surface is derived from featureType + device
const resolveSurface = (featureType, device) => {
  if (featureType === "pyq_page") return "full_page";
  return device === "mobile" ? "bottom_sheet" : "sidebar_drawer";
};

// ─────────────────────────────────────────────
// POST /api/v1/pyq-sessions/start
// Body: { featureType, entrySource, originPage, subjectCode, unitId,
//         unitNumber, subjectName, noteId, noteCategory }
// ─────────────────────────────────────────────
export const startPYQSession = async (req, res) => {
  const {
    featureType,
    entrySource   = "direct",
    originPage    = "unknown",
    subjectCode   = null,
    unitId        = null,
    unitNumber    = null,
    subjectName   = null,
    noteId        = null,
    noteCategory  = null,
    pageLevel     = null,
  } = req.body;

  if (!featureType) {
    return res.status(400).json({ success: false, message: "featureType is required" });
  }

  const device      = getDevice(req);
  const surfaceType = resolveSurface(featureType, device);

  const session = await PYQSession.create({
    userId:      req.user?._id || req.user?.id || null,
    device,
    featureType,
    surfaceType,
    pageLevel,
    subjectCode,
    unitId,
    unitNumber,
    subjectName,
    noteId:       noteId || null,
    noteCategory: noteCategory || null,
    entrySource,
    originPage,
    startedAt:    new Date(),
  });

  return res.status(201).json({
    success:   true,
    sessionId: session._id,
  });
};

// ─────────────────────────────────────────────
// POST /api/v1/pyq-sessions/:sessionId/event
// Body: { action, meta }
// ─────────────────────────────────────────────
export const trackPYQInteraction = async (req, res) => {
  const { sessionId } = req.params;
  const { action, meta = {} } = req.body;

  if (!action) {
    return res.status(400).json({ success: false, message: "action is required" });
  }

  await PYQSession.findByIdAndUpdate(sessionId, {
    $push: {
      interactions: {
        action,
        meta,
        timestamp: new Date(),
      },
    },
    $inc: { totalInteractions: 1 },
  });

  return res.status(200).json({ success: true });
};

// ─────────────────────────────────────────────
// POST /api/v1/pyq-sessions/:sessionId/end
// Body: { exitType, duration, maxScrollPercent,
//         convertedToPage, convertedToPageUrl }
// ─────────────────────────────────────────────
export const endPYQSession = async (req, res) => {
  const { sessionId } = req.params;
  const {
    exitType           = "unknown",
    duration           = null,
    maxScrollPercent   = 0,
    convertedToPage    = false,
    convertedToPageUrl = null,
  } = req.body;

  const endedAt = new Date();

  await PYQSession.findByIdAndUpdate(sessionId, {
    $set: {
      exitType,
      endedAt,
      duration:           duration ?? null,
      maxScrollPercent:   Math.min(100, Math.max(0, maxScrollPercent)),
      convertedToPage,
      convertedToPageUrl: convertedToPage ? convertedToPageUrl : null,
    },
  });

  return res.status(200).json({ success: true });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/sources
// Query: ?featureType=pyq_sheet&days=30
// Returns: breakdown of opens by entrySource
// ─────────────────────────────────────────────
export const getPYQSourceBreakdown = async (req, res) => {
  const { featureType, days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = { startedAt: { $gte: since } };
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id:          "$entrySource",
        total:        { $sum: 1 },
        mobile:       { $sum: { $cond: [{ $eq: ["$device", "mobile"] },  1, 0] } },
        desktop:      { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
        avgDuration:  { $avg: "$duration" },
        converted:    { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        avgInteractions: { $avg: "$totalInteractions" },
      },
    },
    { $sort: { total: -1 } },
    {
      $project: {
        _id:          0,
        source:       "$_id",
        total:        1,
        mobile:       1,
        desktop:      1,
        avgDuration:  { $round: ["$avgDuration", 1] },
        converted:    1,
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$converted", { $max: ["$total", 1] }] }, 100] },
            1,
          ],
        },
        avgInteractions: { $round: ["$avgInteractions", 1] },
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/stats
// Query: ?days=30
// ─────────────────────────────────────────────
export const getPYQSessionStats = async (req, res) => {
  const { days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const data = await PYQSession.aggregate([
    { $match: { startedAt: { $gte: since } } },
    {
      $group: {
        _id:                "$featureType",
        totalSessions:      { $sum: 1 },
        avgDuration:        { $avg: "$duration" },
        avgInteractions:    { $avg: "$totalInteractions" },
        avgScrollPercent:   { $avg: "$maxScrollPercent" },
        mobileCount:        { $sum: { $cond: [{ $eq: ["$device", "mobile"] },  1, 0] } },
        desktopCount:       { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
        convertedCount:     { $sum: { $cond: ["$convertedToPage", 1, 0] } },
      },
    },
    { $sort: { totalSessions: -1 } },
    {
      $project: {
        _id:              0,
        featureType:      "$_id",
        totalSessions:    1,
        avgDuration:      { $round: ["$avgDuration", 1] },
        avgInteractions:  { $round: ["$avgInteractions", 1] },
        avgScrollPercent: { $round: ["$avgScrollPercent", 1] },
        mobileCount:      1,
        desktopCount:     1,
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$convertedCount", { $max: ["$totalSessions", 1] }] }, 100] },
            1,
          ],
        },
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/conversions
// Sheet → page conversion breakdown by source
// ─────────────────────────────────────────────
export const getPYQConversionStats = async (req, res) => {
  const { days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const data = await PYQSession.aggregate([
    {
      $match: {
        startedAt:   { $gte: since },
        featureType: "pyq_sheet",
      },
    },
    {
      $group: {
        _id:               "$entrySource",
        totalSheetOpens:   { $sum: 1 },
        convertedToPage:   { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        avgDurationBefore: { $avg: "$duration" },
        topDestinations:   { $push: "$convertedToPageUrl" },
      },
    },
    { $sort: { totalSheetOpens: -1 } },
    {
      $project: {
        _id:             0,
        source:          "$_id",
        totalSheetOpens: 1,
        convertedToPage: 1,
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$convertedToPage", { $max: ["$totalSheetOpens", 1] }] }, 100] },
            1,
          ],
        },
        avgDurationBefore: { $round: ["$avgDurationBefore", 1] },
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/by-note
// Which notes trigger most PYQ/Syllabus opens?
// Query: ?featureType=pyq_sheet&limit=20&days=30
// ─────────────────────────────────────────────
export const getPYQEngagementByNote = async (req, res) => {
  const { featureType, limit = 20, days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = {
    startedAt: { $gte: since },
    noteId:    { $ne: null },
  };
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id:             "$noteId",
        totalOpens:      { $sum: 1 },
        avgDuration:     { $avg: "$duration" },
        avgInteractions: { $avg: "$totalInteractions" },
        converted:       { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        noteCategory:    { $first: "$noteCategory" },
        subjectCode:     { $first: "$subjectCode" },
        unitId:          { $first: "$unitId" },
      },
    },
    { $sort: { totalOpens: -1 } },
    { $limit: Number(limit) },
    {
      $lookup: {
        from:         "notes",
        localField:   "_id",
        foreignField: "_id",
        as:           "note",
      },
    },
   { $unwind: { path: "$note", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id:          0,
        noteId:       "$_id",
        noteTitle:    "$note.title",
        noteCategory: 1,
        subjectCode:  1,
        unitId:       1,
        totalOpens:   1,
        avgDuration:  { $round: ["$avgDuration", 1] },
        avgInteractions: { $round: ["$avgInteractions", 1] },
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$converted", { $max: ["$totalOpens", 1] }] }, 100] },
            1,
          ],
        },
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/engagement-depth
// Query: ?featureType=pyq_sheet&days=30
// Returns: engagement tiers (cold/warm/hot), scroll buckets, interaction buckets
// ─────────────────────────────────────────────
export const getPYQEngagementDepth = async (req, res) => {
  const { featureType, days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = { startedAt: { $gte: since } };
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        // Engagement tier based on scroll + interactions
        engagementTier: {
          $switch: {
            branches: [
              // Cold: opened and immediately closed (< 3s, no interactions)
              {
                case: {
                  $and: [
                    { $lt: [{ $ifNull: ["$duration", 0] }, 3] },
                    { $eq: ["$totalInteractions", 0] },
                  ],
                },
                then: "cold",
              },
              // Hot: scrolled 50%+ AND interacted AND stayed 10s+
              {
                case: {
                  $and: [
                    { $gte: ["$maxScrollPercent", 50] },
                    { $gte: ["$totalInteractions", 2] },
                    { $gte: [{ $ifNull: ["$duration", 0] }, 10] },
                  ],
                },
                then: "hot",
              },
            ],
            default: "warm",
          },
        },

        // Scroll depth bucket
        scrollBucket: {
          $switch: {
            branches: [
              { case: { $eq:  ["$maxScrollPercent", 0]   }, then: "0%" },
              { case: { $lte: ["$maxScrollPercent", 25]  }, then: "1-25%" },
              { case: { $lte: ["$maxScrollPercent", 50]  }, then: "26-50%" },
              { case: { $lte: ["$maxScrollPercent", 75]  }, then: "51-75%" },
              { case: { $lte: ["$maxScrollPercent", 99]  }, then: "76-99%" },
            ],
            default: "100%",
          },
        },

        // Interaction count bucket
        interactionBucket: {
          $switch: {
            branches: [
              { case: { $eq:  ["$totalInteractions", 0] }, then: "0" },
              { case: { $lte: ["$totalInteractions", 2] }, then: "1-2" },
              { case: { $lte: ["$totalInteractions", 5] }, then: "3-5" },
            ],
            default: "6+",
          },
        },
      },
    },
    {
      $facet: {
        // Tier breakdown
        tiers: [
          {
            $group: {
              _id:             "$engagementTier",
              count:           { $sum: 1 },
              avgDuration:     { $avg: "$duration" },
              avgScroll:       { $avg: "$maxScrollPercent" },
              conversionRate:  { $avg: { $cond: ["$convertedToPage", 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ],

        // Scroll distribution
        scrollDistribution: [
          { $group: { _id: "$scrollBucket", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],

        // Interaction distribution
        interactionDistribution: [
          { $group: { _id: "$interactionBucket", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],

        // Duration histogram
        durationBuckets: [
          {
            $bucket: {
              groupBy: "$duration",
              boundaries: [0, 3, 10, 20, 30, 60, 120],
              default: "120s+",
              output: { count: { $sum: 1 }, avgInteractions: { $avg: "$totalInteractions" } },
            },
          },
        ],

        // Summary totals
        summary: [
          {
            $group: {
              _id:             null,
              totalSessions:   { $sum: 1 },
              avgDuration:     { $avg: "$duration" },
              avgScroll:       { $avg: "$maxScrollPercent" },
              avgInteractions: { $avg: "$totalInteractions" },
              zerScrollCount:  { $sum: { $cond: [{ $eq: ["$maxScrollPercent", 0] }, 1, 0] } },
              zeroInteractionCount: { $sum: { $cond: [{ $eq: ["$totalInteractions", 0] }, 1, 0] } },
            },
          },
          {
            $project: {
              _id:             0,
              totalSessions:   1,
              avgDuration:     { $round: ["$avgDuration", 1] },
              avgScroll:       { $round: ["$avgScroll", 1] },
              avgInteractions: { $round: ["$avgInteractions", 1] },
              bounceRate: {
                $round: [
                  { $multiply: [{ $divide: ["$zerScrollCount", { $max: ["$totalSessions", 1] }] }, 100] },
                  1,
                ],
              },
              zeroInteractionRate: {
                $round: [
                  { $multiply: [{ $divide: ["$zeroInteractionCount", { $max: ["$totalSessions", 1] }] }, 100] },
                  1,
                ],
              },
            },
          },
        ],
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data: data[0] });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/interaction-heatmap
// Query: ?days=30&subjectCode=OS
// Returns: most common actions, meta breakdowns, action sequences
// ─────────────────────────────────────────────
export const getPYQInteractionHeatmap = async (req, res) => {
  const { days = 30, subjectCode, featureType } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const sessionMatch = { startedAt: { $gte: since } };
  if (subjectCode) sessionMatch.subjectCode = subjectCode;
  if (featureType) sessionMatch.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: sessionMatch },

    // Unwind all interactions
   { $unwind: "$interactions" },
    {
      $facet: {
        // ── Action frequency ─────────────────────────────────────────
        actionFrequency: [
          {
            $group: {
              _id:             "$interactions.action",
              count:           { $sum: 1 },
              uniqueSessions:  { $addToSet: "$_id" },
            },
          },
          {
            $project: {
              _id:            0,
              action:         "$_id",
              count:          1,
              uniqueSessions: { $size: "$uniqueSessions" },
            },
          },
          { $sort: { count: -1 } },
        ],

        // ── filter_mark_type breakdown — which mark types are filtered ─
        markTypeBreakdown: [
          { $match: { "interactions.action": "filter_mark_type" } },
          {
            $group: {
              _id:   "$interactions.meta.markType",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $project: { _id: 0, markType: "$_id", count: 1 } },
        ],

        // ── tab_switch breakdown — which tabs are visited ────────────
        tabSwitchBreakdown: [
          { $match: { "interactions.action": "tab_switch" } },
          {
            $group: {
              _id:   { from: "$interactions.meta.from", to: "$interactions.meta.to" },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          {
            $project: {
              _id:   0,
              from:  "$_id.from",
              to:    "$_id.to",
              count: 1,
            },
          },
        ],

        // ── navigation events — where users go from sheet ────────────
        navigationBreakdown: [
          { $match: { "interactions.action": "navigate_to_pyq_page" } },
          {
            $group: {
              _id:   "$interactions.meta.navigatedTo",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
          { $project: { _id: 0, destination: "$_id", count: 1 } },
        ],

        // ── repeatOnly toggle count ──────────────────────────────────
        repeatToggleStats: [
          { $match: { "interactions.action": "filter_repeat_toggle" } },
          {
            $group: {
              _id:        "$interactions.meta.repeatOnly",
              count:      { $sum: 1 },
            },
          },
          { $project: { _id: 0, repeatOnly: "$_id", count: 1 } },
        ],
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data: data[0] });
};


// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/user-behavior
// Query: ?days=30
// Returns: user segments, avg sessions per user, cross-subject usage
// ─────────────────────────────────────────────
export const getPYQUserBehavior = async (req, res) => {
  const { days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const data = await PYQSession.aggregate([
    {
      $match: {
        startedAt: { $gte: since },
        userId:    { $ne: null },         // logged-in users only
      },
    },
    {
      $group: {
        _id:              "$userId",
        totalSessions:    { $sum: 1 },
        subjectsExplored: { $addToSet: "$subjectCode" },
        unitsExplored:    { $addToSet: "$unitId" },
        totalDuration:    { $sum: { $ifNull: ["$duration", 0] } },
        totalInteractions:{ $sum: "$totalInteractions" },
        conversions:      { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        lastSeen:         { $max: "$startedAt" },
        firstSeen:        { $min: "$startedAt" },
        featureTypes:     { $addToSet: "$featureType" },
      },
    },
    {
      $addFields: {
        subjectCount:    { $size: "$subjectsExplored" },
        unitCount:       { $size: "$unitsExplored" },
        featureCount:    { $size: "$featureTypes" },
        // User segment
        userSegment: {
          $switch: {
            branches: [
              // Power: 5+ sessions, 2+ subjects
              {
                case: {
                  $and: [
                    { $gte: ["$totalSessions", 5] },
                    { $gte: [{ $size: "$subjectsExplored" }, 2] },
                  ],
                },
                then: "power",
              },
              // Returning: 2–4 sessions
              {
                case: { $gte: ["$totalSessions", 2] },
                then: "returning",
              },
            ],
            default: "one-time",
          },
        },
      },
    },
    {
      $facet: {
        // ── User segment breakdown ────────────────────────────────────
        segments: [
          {
            $group: {
              _id:              "$userSegment",
              userCount:        { $sum: 1 },
              avgSessions:      { $avg: "$totalSessions" },
              avgSubjects:      { $avg: "$subjectCount" },
              avgDuration:      { $avg: "$totalDuration" },
              avgInteractions:  { $avg: "$totalInteractions" },
              conversionRate:   { $avg: { $cond: [{ $gt: ["$conversions", 0] }, 1, 0] } },
            },
          },
          {
            $project: {
              _id:             0,
              segment:         "$_id",
              userCount:       1,
              avgSessions:     { $round: ["$avgSessions", 1] },
              avgSubjects:     { $round: ["$avgSubjects", 1] },
              avgDurationMins: { $round: [{ $divide: ["$avgDuration", 60] }, 1] },
              avgInteractions: { $round: ["$avgInteractions", 1] },
              conversionRate:  { $round: [{ $multiply: ["$conversionRate", 100] }, 1] },
            },
          },
          { $sort: { userCount: -1 } },
        ],

        // ── Cross-subject explorer breakdown ─────────────────────────
        subjectExploration: [
          {
            $bucket: {
              groupBy:    "$subjectCount",
              boundaries: [1, 2, 3, 4, 5],
              default:    "5+",
              output: {
                users:       { $sum: 1 },
                avgSessions: { $avg: "$totalSessions" },
              },
            },
          },
        ],

        // ── Summary stats ─────────────────────────────────────────────
        summary: [
          {
            $group: {
              _id:           null,
              totalUsers:    { $sum: 1 },
              avgSessions:   { $avg: "$totalSessions" },
              avgSubjects:   { $avg: "$subjectCount" },
              avgTotalTime:  { $avg: "$totalDuration" },
              multiSubjectUsers: {
                $sum: { $cond: [{ $gte: ["$subjectCount", 2] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              _id:           0,
              totalUsers:    1,
              avgSessions:   { $round: ["$avgSessions", 1] },
              avgSubjects:   { $round: ["$avgSubjects", 1] },
              avgTotalTimeMins: { $round: [{ $divide: ["$avgTotalTime", 60] }, 1] },
              multiSubjectRate: {
                $round: [
                  { $multiply: [{ $divide: ["$multiSubjectUsers", { $max: ["$totalUsers", 1] }] }, 100] },
                  1,
                ],
              },
            },
          },
        ],
      },
    },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data: data[0] });
};


// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/unit-popularity
// Query: ?days=30&subjectCode=OS&featureType=pyq_sheet
// Returns: unit ranking by opens, scroll, interactions, conversion
// ─────────────────────────────────────────────
export const getPYQUnitPopularity = async (req, res) => {
  const { days = 30, subjectCode, featureType } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = {
    startedAt: { $gte: since },
    unitId:    { $ne: null },
  };
  if (subjectCode) matchStage.subjectCode = subjectCode;
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id:              { unitId: "$unitId", subjectCode: "$subjectCode" },
        subjectName:      { $first: "$subjectName" },
        unitNumber:       { $first: "$unitNumber" },
        totalOpens:       { $sum: 1 },
        avgDuration:      { $avg: "$duration" },
        avgScroll:        { $avg: "$maxScrollPercent" },
        avgInteractions:  { $avg: "$totalInteractions" },
        conversions:      { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        mobileOpens:      { $sum: { $cond: [{ $eq: ["$device", "mobile"] },  1, 0] } },
        desktopOpens:     { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
        hotSessions:      {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$maxScrollPercent", 50] },
                  { $gte: ["$totalInteractions", 2] },
                ],
              },
              1, 0,
            ],
          },
        },
        uniqueNotes:      { $addToSet: "$noteId" },
      },
    },
    {
      $project: {
        _id:             0,
        unitId:          "$_id.unitId",
        subjectCode:     "$_id.subjectCode",
        subjectName:     1,
        unitNumber:      1,
        totalOpens:      1,
        avgDuration:     { $round: ["$avgDuration", 1] },
        avgScroll:       { $round: ["$avgScroll", 1] },
        avgInteractions: { $round: ["$avgInteractions", 1] },
        mobileOpens:     1,
        desktopOpens:    1,
        uniqueNoteCount: { $size: "$uniqueNotes" },
        hotSessionRate: {
          $round: [
            { $multiply: [{ $divide: ["$hotSessions", { $max: ["$totalOpens", 1] }] }, 100] },
            1,
          ],
        },
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$conversions", { $max: ["$totalOpens", 1] }] }, 100] },
            1,
          ],
        },
      },
    },
    { $sort: { totalOpens: -1 } },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};   


// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/funnel
// Query: ?days=30&featureType=pyq_sheet
// Returns: step-by-step funnel with drop-off at each stage
// ─────────────────────────────────────────────
export const getPYQFunnelAnalysis = async (req, res) => {
  const { days = 30, featureType = "pyq_sheet" } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const [result] = await PYQSession.aggregate([
    {
      $match: {
        startedAt:   { $gte: since },
        featureType,
      },
    },
    {
      $group: {
        _id: null,

        // Step 1: Total opens (everyone who opened the sheet)
        step1_opened: { $sum: 1 },

        // Step 2: Stayed > 3 seconds (not an instant bounce)
        step2_stayed: {
          $sum: {
            $cond: [{ $gt: [{ $ifNull: ["$duration", 0] }, 3] }, 1, 0],
          },
        },

        // Step 3: Scrolled at all (any scroll)
        step3_scrolled: {
          $sum: {
            $cond: [{ $gt: ["$maxScrollPercent", 0] }, 1, 0],
          },
        },

        // Step 4: Scrolled past 25%
        step4_scrolled25: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 25] }, 1, 0],
          },
        },

        // Step 5: At least 1 interaction (filtered, toggled, switched tab)
        step5_interacted: {
          $sum: {
            $cond: [{ $gte: ["$totalInteractions", 1] }, 1, 0],
          },
        },

        // Step 6: 2+ interactions (deeper engagement)
        step6_deepEngaged: {
          $sum: {
            $cond: [{ $gte: ["$totalInteractions", 2] }, 1, 0],
          },
        },

        // Step 7: Converted to full PYQ page
        step7_converted: {
          $sum: { $cond: ["$convertedToPage", 1, 0] },
        },

        // Bonus: Scrolled to 100%
        fullScrollers: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 100] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        funnel: {
          $let: {
            vars: { total: "$step1_opened" },
            in: [
              {
                step: 1, label: "Opened Sheet",
                count: "$step1_opened",
                dropOffRate: 0,
                retentionRate: 100,
              },
              {
                step: 2, label: "Stayed > 3s",
                count: "$step2_stayed",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step2_stayed", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
              {
                step: 3, label: "Scrolled at all",
                count: "$step3_scrolled",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step3_scrolled", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
              {
                step: 4, label: "Scrolled 25%+",
                count: "$step4_scrolled25",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step4_scrolled25", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
              {
                step: 5, label: "Any Interaction",
                count: "$step5_interacted",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step5_interacted", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
              {
                step: 6, label: "Deep Engaged (2+ interactions)",
                count: "$step6_deepEngaged",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step6_deepEngaged", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
              {
                step: 7, label: "Converted to PYQ Page",
                count: "$step7_converted",
                retentionRate: {
                  $round: [{ $multiply: [{ $divide: ["$step7_converted", { $max: ["$$total", 1] }] }, 100] }, 1],
                },
              },
            ],
          },
        },
        bonus: {
          fullScrollers: "$fullScrollers",
          fullScrollRate: {
            $round: [{ $multiply: [{ $divide: ["$fullScrollers", { $max: ["$step1_opened", 1] }] }, 100] }, 1],
          },
        },
      },
    },
  ]);

  return res.status(200).json({
    success: true,
    days:    Number(days),
    featureType,
    data:    result || { funnel: [], bonus: {} },
  });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/retention
// Query: ?days=30&featureType=pyq_sheet
// Returns: per-subject retention metrics ranked by engagement quality
// ─────────────────────────────────────────────
export const getPYQRetentionBySubject = async (req, res) => {
  const { days = 30, featureType } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = {
    startedAt:   { $gte: since },
    subjectCode: { $ne: null },
  };
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id:               "$subjectCode",
        totalSessions:     { $sum: 1 },
        avgDuration:       { $avg: "$duration" },
        avgScroll:         { $avg: "$maxScrollPercent" },
        avgInteractions:   { $avg: "$totalInteractions" },
        conversions:       { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        bounces:           {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: [{ $ifNull: ["$duration", 0] }, 3] },
                  { $eq: ["$totalInteractions", 0] },
                ],
              },
              1, 0,
            ],
          },
        },
        fullReads:  { $sum: { $cond: [{ $gte: ["$maxScrollPercent", 90] }, 1, 0] } },
        unitsOpened: { $addToSet: "$unitId" },
        uniqueUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        _id:             0,
        subjectCode:     "$_id",
        totalSessions:   1,
        avgDuration:     { $round: ["$avgDuration", 1] },
        avgScroll:       { $round: ["$avgScroll", 1] },
        avgInteractions: { $round: ["$avgInteractions", 1] },
        uniqueUsers:     { $size: "$uniqueUsers" },
        unitsTracked:    { $size: "$unitsOpened" },
        bounceRate: {
          $round: [
            { $multiply: [{ $divide: ["$bounces", { $max: ["$totalSessions", 1] }] }, 100] },
            1,
          ],
        },
        fullReadRate: {
          $round: [
            { $multiply: [{ $divide: ["$fullReads", { $max: ["$totalSessions", 1] }] }, 100] },
            1,
          ],
        },
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$conversions", { $max: ["$totalSessions", 1] }] }, 100] },
            1,
          ],
        },
        // Engagement score: composite metric (0-100)
        engagementScore: {
          $round: [
            {
              $add: [
                { $multiply: [{ $min: [{ $divide: ["$avgDuration", 60] }, 1] }, 30] }, // 30pts for duration
                { $multiply: [{ $divide: ["$avgScroll", 100] }, 30] },                   // 30pts for scroll
                { $multiply: [{ $min: [{ $divide: ["$avgInteractions", 5] }, 1] }, 25] }, // 25pts for interactions
                { $multiply: [{ $divide: ["$conversions", { $max: ["$totalSessions", 1] }] }, 15] }, // 15pts for conversion
              ],
            },
            1,
          ],
        },
      },
    },
    { $sort: { engagementScore: -1 } },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/syllabus-funnel
// Query: ?days=30
// Returns: step-by-step funnel for syllabus_sheet sessions
// Syllabus sheet is scroll-driven (no mark filters, no page conversion)
// so funnel steps are: Open → Stay → Scroll → Deep Scroll → Full Read → Interact → Convert
// ─────────────────────────────────────────────
export const getSyllabusFunnelAnalysis = async (req, res) => {
  const { days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const [result] = await PYQSession.aggregate([
    {
      $match: {
        startedAt:   { $gte: since },
        featureType: "syllabus_sheet",
      },
    },
    {
      $group: {
        _id: null,

        // Step 1: Total syllabus sheet opens
        step1_opened: { $sum: 1 },

        // Step 2: Stayed > 3 seconds (not an instant glance and close)
        step2_stayed: {
          $sum: {
            $cond: [{ $gt: [{ $ifNull: ["$duration", 0] }, 3] }, 1, 0],
          },
        },

        // Step 3: Scrolled at all (any scroll depth > 0)
        step3_scrolled: {
          $sum: {
            $cond: [{ $gt: ["$maxScrollPercent", 0] }, 1, 0],
          },
        },

        // Step 4: Scrolled past 25% (actually reading, not just glancing)
        step4_scrolled25: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 25] }, 1, 0],
          },
        },

        // Step 5: Scrolled past 50% (halfway through syllabus)
        step5_scrolled50: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 50] }, 1, 0],
          },
        },

        // Step 6: Scrolled past 75% (committed reader)
        step6_scrolled75: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 75] }, 1, 0],
          },
        },

        // Step 7: Full read — scrolled 90%+ (finished the syllabus)
        step7_fullRead: {
          $sum: {
            $cond: [{ $gte: ["$maxScrollPercent", 90] }, 1, 0],
          },
        },

        // Step 8: Interacted (opened unit accordion, opened topic etc.)
        step8_interacted: {
          $sum: {
            $cond: [{ $gte: ["$totalInteractions", 1] }, 1, 0],
          },
        },

        // Step 9: Converted — navigated to a PYQ page from syllabus sheet
        step9_converted: {
          $sum: { $cond: ["$convertedToPage", 1, 0] },
        },

        // Bonus metrics
        totalDuration:    { $sum: { $ifNull: ["$duration", 0] } },
        avgDuration:      { $avg: "$duration" },
        avgScroll:        { $avg: "$maxScrollPercent" },
        avgInteractions:  { $avg: "$totalInteractions" },

        // Exit type breakdown
        exitByClose:    { $sum: { $cond: [{ $eq: ["$exitType", "close_button"] },    1, 0] } },
        exitByBackdrop: { $sum: { $cond: [{ $eq: ["$exitType", "backdrop_click"] },  1, 0] } },
        exitByNavigate: { $sum: { $cond: [{ $eq: ["$exitType", "navigate_away"] },   1, 0] } },
        exitByUnknown:  { $sum: { $cond: [{ $eq: ["$exitType", "unknown"] },         1, 0] } },

        // Device split
        mobileOpens:    { $sum: { $cond: [{ $eq: ["$device", "mobile"] },  1, 0] } },
        desktopOpens:   { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        funnel: [
          {
            step: 1,
            label: "Opened Syllabus Sheet",
            count: "$step1_opened",
            dropOffRate: 0,
            retentionRate: 100,
          },
          {
            step: 2,
            label: "Stayed > 3s",
            count: "$step2_stayed",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step2_stayed",    { $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 3,
            label: "Scrolled at all",
            count: "$step3_scrolled",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step3_scrolled",  { $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 4,
            label: "Scrolled 25%+",
            count: "$step4_scrolled25",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step4_scrolled25",{ $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 5,
            label: "Scrolled 50%+",
            count: "$step5_scrolled50",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step5_scrolled50",{ $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 6,
            label: "Scrolled 75%+",
            count: "$step6_scrolled75",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step6_scrolled75",{ $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 7,
            label: "Full Read (90%+)",
            count: "$step7_fullRead",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step7_fullRead",  { $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 8,
            label: "Any Interaction",
            count: "$step8_interacted",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step8_interacted",{ $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
          {
            step: 9,
            label: "Converted to PYQ Page",
            count: "$step9_converted",
            retentionRate: {
              $round: [{ $multiply: [{ $divide: ["$step9_converted", { $max: ["$step1_opened", 1] }] }, 100] }, 1],
            },
          },
        ],

        // Bonus: engagement quality + device + exit breakdown
        bonus: {
          avgDuration:     { $round: ["$avgDuration",    1] },
          avgScroll:       { $round: ["$avgScroll",      1] },
          avgInteractions: { $round: ["$avgInteractions",1] },
          device: {
            mobile:  "$mobileOpens",
            desktop: "$desktopOpens",
          },
          exitTypes: {
            close_button:   "$exitByClose",
            backdrop_click: "$exitByBackdrop",
            navigate_away:  "$exitByNavigate",
            unknown:        "$exitByUnknown",
          },
        },
      },
    },
  ]);

  return res.status(200).json({
    success:     true,
    days:        Number(days),
    featureType: "syllabus_sheet",
    data:        result || { funnel: [], bonus: {} },
  });
};
// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/syllabus-unit-popularity
// Query: ?days=30&subjectName=operating+system
// Returns: unit/subject ranking for syllabus_sheet sessions
// Scroll-driven engagement (no mark filters) — ranked by full-read rate
// ─────────────────────────────────────────────
export const getSyllabusUnitPopularity = async (req, res) => {
  const { days = 30, subjectName } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = {
    startedAt:   { $gte: since },
    featureType: "syllabus_sheet",
    unitNumber:  { $ne: null },       // only sessions with a unit context
  };
  if (subjectName) matchStage.subjectName = new RegExp(subjectName, "i");

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          subjectName: "$subjectName",
          unitNumber:  "$unitNumber",
        },

        totalOpens:     { $sum: 1 },
        avgDuration:    { $avg: "$duration" },
        avgScroll:      { $avg: "$maxScrollPercent" },
        avgInteractions:{ $avg: "$totalInteractions" },

        // Scroll milestone counts
        scrolled25:     { $sum: { $cond: [{ $gte: ["$maxScrollPercent", 25] }, 1, 0] } },
        scrolled50:     { $sum: { $cond: [{ $gte: ["$maxScrollPercent", 50] }, 1, 0] } },
        scrolled75:     { $sum: { $cond: [{ $gte: ["$maxScrollPercent", 75] }, 1, 0] } },
        fullReads:      { $sum: { $cond: [{ $gte: ["$maxScrollPercent", 90] }, 1, 0] } },

        // Bounce: < 3s and no scroll
        bounces: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: [{ $ifNull: ["$duration", 0] }, 3] },
                  { $eq: ["$maxScrollPercent", 0] },
                ],
              },
              1, 0,
            ],
          },
        },

        conversions:    { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        mobileOpens:    { $sum: { $cond: [{ $eq: ["$device", "mobile"] },  1, 0] } },
        desktopOpens:   { $sum: { $cond: [{ $eq: ["$device", "desktop"] }, 1, 0] } },
        uniqueNotes:    { $addToSet: "$noteId" },
        uniqueUsers:    { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        _id:            0,
        subjectName:    "$_id.subjectName",
        unitNumber:     "$_id.unitNumber",
        totalOpens:     1,
        avgDuration:    { $round: ["$avgDuration",     1] },
        avgScroll:      { $round: ["$avgScroll",       1] },
        avgInteractions:{ $round: ["$avgInteractions", 1] },
        mobileOpens:    1,
        desktopOpens:   1,
        uniqueNoteCount:{ $size: "$uniqueNotes" },
        uniqueUserCount:{ $size: "$uniqueUsers" },

        // Scroll funnel rates (% of total opens that reached each milestone)
        scrollFunnel: {
          rate25: {
            $round: [{ $multiply: [{ $divide: ["$scrolled25", { $max: ["$totalOpens", 1] }] }, 100] }, 1],
          },
          rate50: {
            $round: [{ $multiply: [{ $divide: ["$scrolled50", { $max: ["$totalOpens", 1] }] }, 100] }, 1],
          },
          rate75: {
            $round: [{ $multiply: [{ $divide: ["$scrolled75", { $max: ["$totalOpens", 1] }] }, 100] }, 1],
          },
          fullReadRate: {
            $round: [{ $multiply: [{ $divide: ["$fullReads",  { $max: ["$totalOpens", 1] }] }, 100] }, 1],
          },
        },

        bounceRate: {
          $round: [{ $multiply: [{ $divide: ["$bounces",     { $max: ["$totalOpens", 1] }] }, 100] }, 1],
        },
        conversionRate: {
          $round: [{ $multiply: [{ $divide: ["$conversions", { $max: ["$totalOpens", 1] }] }, 100] }, 1],
        },

        // Composite engagement score (scroll-weighted, 0–100)
        // 40pts scroll depth + 30pts full-read rate + 20pts duration + 10pts conversion
        engagementScore: {
          $round: [
            {
              $add: [
                { $multiply: [{ $divide: ["$avgScroll", 100] },                                          40] },
                { $multiply: [{ $divide: ["$fullReads", { $max: ["$totalOpens", 1] }] },                 30] },
                { $multiply: [{ $min: [{ $divide: [{ $ifNull: ["$avgDuration", 0] }, 60] }, 1] },        20] },
                { $multiply: [{ $divide: ["$conversions", { $max: ["$totalOpens", 1] }] },               10] },
              ],
            },
            1,
          ],
        },
      },
    },

    // Sort by total opens by default; frontend can re-sort by engagementScore
    { $sort: { totalOpens: -1 } },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};

// ─────────────────────────────────────────────
// GET /api/v1/pyq-sessions/admin/daily-trend
// Query: ?days=30&featureType=pyq_sheet
// Returns: day-by-day session counts, avg duration, conversions
// ─────────────────────────────────────────────
export const getPYQDailyTrend = async (req, res) => {
  const { days = 30, featureType } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const matchStage = { startedAt: { $gte: since } };
  if (featureType) matchStage.featureType = featureType;

  const data = await PYQSession.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date:        { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
          featureType: "$featureType",
        },
        sessions:        { $sum: 1 },
        conversions:     { $sum: { $cond: ["$convertedToPage", 1, 0] } },
        avgDuration:     { $avg: "$duration" },
        avgScroll:       { $avg: "$maxScrollPercent" },
        avgInteractions: { $avg: "$totalInteractions" },
      },
    },
    {
      $project: {
        _id:         0,
        date:        "$_id.date",
        featureType: "$_id.featureType",
        sessions:    1,
        conversions: 1,
        avgDuration:     { $round: ["$avgDuration",     1] },
        avgScroll:       { $round: ["$avgScroll",       1] },
        avgInteractions: { $round: ["$avgInteractions", 1] },
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ["$conversions", { $max: ["$sessions", 1] }] }, 100] },
            1,
          ],
        },
      },
    },
    { $sort: { date: 1, featureType: 1 } },
  ]);

  return res.status(200).json({ success: true, days: Number(days), data });
};