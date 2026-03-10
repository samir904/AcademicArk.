// CONTROLLERS/arkShotSession.controller.js
import ArkShotSession from "../MODELS/arkShotSession.model.js";
import AppError       from "../UTIL/error.util.js";
import { v4 as uuidv4 } from "uuid";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — detect device from user-agent
// ─────────────────────────────────────────────────────────────────────────────
const detectDevice = (ua = "") => {
  if (/mobile/i.test(ua))  return "mobile";
  if (/tablet/i.test(ua))  return "tablet";
  return "desktop";
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  START SESSION
//     POST /api/v1/arkshots/sessions/start
//     Body: { entrySource, semester, subject, unit, collectionId }
// ─────────────────────────────────────────────────────────────────────────────
export const startArkShotSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      entrySource  = "direct",
      semester     = null,
      subject      = null,
      unit         = null,
      collectionId = null,
    } = req.body;

    // ── Validate entrySource ──────────────────────
    const validSources = [
      "homepage_section", "direct", "collection",
      "subject_feed", "revision_reminder", "notification"
    ];
    if (!validSources.includes(entrySource)) {
      return next(new AppError(`Invalid entrySource: ${entrySource}`, 400));
    }

    // ── Close any stale active sessions ──────────
    // If user opens ArkShots without ending previous session
    // mark them as abandoned (session_timeout)
    const staleSession = await ArkShotSession.findOne({
      user:    userId,
      endedAt: null,           // still active
    }).sort({ startedAt: -1 });

    if (staleSession) {
      staleSession.endedAt      = new Date();
      staleSession.dropOffReason = "session_timeout";
      await staleSession.save(); // triggers pre("save") duration calc
    }

    // ── Create new session ─────────────────────────
    const sessionId = uuidv4();
    const device    = detectDevice(req.headers["user-agent"]);

    const session = await ArkShotSession.create({
      user:        userId,
      sessionId,
      entrySource,
      device,
      context: {
        semester:     semester     ? Number(semester) : null,
        subject:      subject      || null,
        unit:         unit         ? Number(unit) : null,
        collectionId: collectionId || null,
      },
      startedAt: new Date(),
    });

    console.log(`🎯 ArkShot session started [${entrySource}] — user: ${userId}`);

    res.status(201).json({
      success:   true,
      sessionId: session.sessionId,   // ✅ frontend stores this in state/redux
      message:   "Session started",
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  END SESSION
//     PATCH /api/v1/arkshots/sessions/:sessionId/end
//     Body: { dropOffReason, isCompleted }
//     Called: on page leave / tab close (beforeunload) / manual
// ─────────────────────────────────────────────────────────────────────────────
export const endArkShotSession = async (req, res, next) => {
  try {
    const userId         = req.user.id;
    const { sessionId }  = req.params;
    const {
      dropOffReason = "navigated_away",
      isCompleted   = false,
    } = req.body;

    // ── Validate dropOffReason ────────────────────
    const validReasons = [
      "tab_closed", "navigated_away",
      "session_timeout", "completed_feed", null
    ];
    if (!validReasons.includes(dropOffReason)) {
      return next(new AppError(`Invalid dropOffReason: ${dropOffReason}`, 400));
    }

    const session = await ArkShotSession.findOne({
      sessionId,
      user: userId,
    });

    if (!session) return next(new AppError("Session not found", 404));

    // ── Already ended ─────────────────────────────
    if (session.endedAt) {
      return res.status(200).json({
        success: true,
        message: "Session already ended",
        data: {
          totalDurationSeconds: session.totalDurationSeconds,
          totalShotsViewed:     session.totalShotsViewed,
        },
      });
    }

    // ── End it ────────────────────────────────────
    session.endedAt       = new Date();
    session.dropOffReason = dropOffReason;
    session.isCompleted   = isCompleted;
    await session.save();   // pre("save") auto-calculates totalDurationSeconds

    console.log(
      `✅ ArkShot session ended — ` +
      `duration: ${session.totalDurationSeconds}s | ` +
      `shots: ${session.totalShotsViewed} | ` +
      `reason: ${dropOffReason}`
    );

    res.status(200).json({
      success: true,
      message: "Session ended",
      data: {
        totalDurationSeconds: session.totalDurationSeconds,
        totalShotsViewed:     session.totalShotsViewed,
        totalLiked:           session.totalLiked,
        totalMastered:        session.totalMastered,
        totalSkipped:         session.totalSkipped,
        isCompleted:          session.isCompleted,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  GET MY SESSION HISTORY
//     GET /api/v1/arkshots/sessions/my/history?page=1&limit=10
// ─────────────────────────────────────────────────────────────────────────────
export const getMySessionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 10;
    const skip   = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      ArkShotSession
        .find({ user: userId })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "sessionId entrySource context startedAt endedAt " +
          "totalDurationSeconds totalShotsViewed totalLiked " +
          "totalMastered totalSkipped isCompleted device dropOffReason"
        )
        // ✅ Populate lastShotSeen for "Continue from here"
        .populate("lastShotSeen", "title subject unit semester resolvedTheme")
        .lean({ virtuals: true }),
      ArkShotSession.countDocuments({ user: userId }),
    ]);

    // ── Aggregate personal stats ──────────────────
    const personalStats = await ArkShotSession.aggregate([
      { $match: { user: userId } },        // ← NOTE: use userId as ObjectId in real query
      {
        $group: {
          _id:                   null,
          totalSessions:         { $sum: 1 },
          totalTimeSeconds:      { $sum: "$totalDurationSeconds" },
          totalShotsViewed:      { $sum: "$totalShotsViewed" },
          totalMastered:         { $sum: "$totalMastered" },
          avgSessionDuration:    { $avg: "$totalDurationSeconds" },
          avgShotsPerSession:    { $avg: "$totalShotsViewed" },
          completedSessions:     { $sum: { $cond: ["$isCompleted", 1, 0] } },
        }
      }
    ]);

    const stats = personalStats[0] || {
      totalSessions:      0,
      totalTimeSeconds:   0,
      totalShotsViewed:   0,
      totalMastered:      0,
      avgSessionDuration: 0,
      avgShotsPerSession: 0,
      completedSessions:  0,
    };

    res.status(200).json({
      success: true,
      data:    sessions,
      stats: {
        ...stats,
        totalTimeMinutes: Math.round(stats.totalTimeSeconds / 60),
      },
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4️⃣  ADMIN — SESSION ANALYTICS DASHBOARD
//     GET /api/v1/arkshots/sessions/admin/analytics
//     Query: ?days=7&semester=4&subject=CN&entrySource=homepage_section
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminSessionAnalytics = async (req, res, next) => {
  try {
    const {
      days        = 7,
      semester    = null,
      subject     = null,
      entrySource = null,
    } = req.query;

    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // ── Base match filter ─────────────────────────
    const matchFilter = { startedAt: { $gte: since } };
    if (semester)    matchFilter["context.semester"] = Number(semester);
    if (subject)     matchFilter["context.subject"]  = subject;
    if (entrySource) matchFilter.entrySource         = entrySource;

    const [
      overallStats,
      entrySourceBreakdown,
      deviceBreakdown,
      dropOffBreakdown,
      dailySessionTrend,
      topSubjects,
      activeSessions,
    ] = await Promise.all([

      // ── Overall stats ─────────────────────────
      ArkShotSession.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id:                  null,
            totalSessions:        { $sum: 1 },
            completedSessions:    { $sum: { $cond: ["$isCompleted", 1, 0] } },
            totalShotsViewed:     { $sum: "$totalShotsViewed" },
            totalLiked:           { $sum: "$totalLiked" },
            totalMastered:        { $sum: "$totalMastered" },
            totalSkipped:         { $sum: "$totalSkipped" },
            avgDurationSeconds:   { $avg: "$totalDurationSeconds" },
            avgShotsPerSession:   { $avg: "$totalShotsViewed" },
          }
        }
      ]),

      // ── Which entry point is working best ─────
      ArkShotSession.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id:          "$entrySource",
            count:        { $sum: 1 },
            avgShots:     { $avg: "$totalShotsViewed" },
            avgDuration:  { $avg: "$totalDurationSeconds" },
            completed:    { $sum: { $cond: ["$isCompleted", 1, 0] } },
          }
        },
        { $sort: { count: -1 } }
      ]),

      // ── Mobile vs Desktop ─────────────────────
      ArkShotSession.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id:   "$device",
            count: { $sum: 1 },
            avgDuration: { $avg: "$totalDurationSeconds" },
          }
        }
      ]),

      // ── Why are users leaving ─────────────────
      ArkShotSession.aggregate([
        { $match: { ...matchFilter, endedAt: { $ne: null } } },
        {
          $group: {
            _id:   "$dropOffReason",
            count: { $sum: 1 },
          }
        },
        { $sort: { count: -1 } }
      ]),

      // ── Daily session trend (last N days) ─────
      ArkShotSession.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$startedAt" }
            },
            sessions:     { $sum: 1 },
            shotsViewed:  { $sum: "$totalShotsViewed" },
            avgDuration:  { $avg: "$totalDurationSeconds" },
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // ── Which subjects get most sessions ──────
      ArkShotSession.aggregate([
        { $match: { ...matchFilter, "context.subject": { $ne: null } } },
        {
          $group: {
            _id:         "$context.subject",
            sessions:    { $sum: 1 },
            avgShots:    { $avg: "$totalShotsViewed" },
            avgDuration: { $avg: "$totalDurationSeconds" },
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 10 }
      ]),

      // ── Currently active sessions ─────────────
      ArkShotSession.countDocuments({ endedAt: null }),
    ]);

    const stats = overallStats[0] || {};

    res.status(200).json({
      success: true,
      data: {
        // ── Overview ──────────────────────────────
        overview: {
          totalSessions:      stats.totalSessions      || 0,
          completedSessions:  stats.completedSessions  || 0,
          completionRate:     stats.totalSessions
            ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
            : 0,
          activeSessions,                              // live right now
          totalShotsViewed:   stats.totalShotsViewed   || 0,
          totalLiked:         stats.totalLiked         || 0,
          totalMastered:      stats.totalMastered      || 0,
          totalSkipped:       stats.totalSkipped       || 0,
          avgDurationSeconds: Math.round(stats.avgDurationSeconds || 0),
          avgDurationMinutes: Math.round((stats.avgDurationSeconds || 0) / 60 * 10) / 10,
          avgShotsPerSession: Math.round(stats.avgShotsPerSession || 0),
        },

        // ── Breakdowns ────────────────────────────
        entrySourceBreakdown,  // homepage vs direct vs collection
        deviceBreakdown,       // mobile vs desktop
        dropOffBreakdown,      // why leaving
        topSubjects,           // which subjects are popular

        // ── Trend ─────────────────────────────────
        dailySessionTrend,     // chart data — sessions per day

        // ── Meta ──────────────────────────────────
        filters: { days: Number(days), semester, subject, entrySource },
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ✅ ADD this endpoint to arkShotSession routes
// PATCH /api/v1/arkshots/sessions/:sessionId/context

export const updateSessionContext = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { semester, subject, unit, collectionId } = req.body;

    await ArkShotSession.findOneAndUpdate(
      { sessionId, user: req.user.id, endedAt: null },
      {
        $set: {
          // Only update what changed
          ...(semester     && { "context.semester":     Number(semester) }),
          ...(subject      && { "context.subject":      subject }),
          ...(unit         && { "context.unit":         Number(unit) }),
          ...(collectionId && { "context.collectionId": collectionId }),
        }
      }
    );

    res.status(200).json({ success: true, message: "Context updated" });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};
