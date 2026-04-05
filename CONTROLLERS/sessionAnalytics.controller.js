// CONTROLLERS/sessionAnalytics.controller.js
import mongoose from "mongoose";
import ArkShotSession from "../MODELS/arkShotSession.model.js";

// ── Shared helper ─────────────────────────────────────────────────────────
const getSince = (days) =>
  new Date(Date.now() - parseInt(days || 30) * 24 * 60 * 60 * 1000);

const activeMatch = (since) => ({
  totalShotsViewed: { $gt: 0 },
  createdAt: { $gte: since },
});

// ─────────────────────────────────────────────────────────────────────────
// 1. OVERVIEW — top-level KPIs
// GET /api/v1/admin/sessions/overview?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getSessionOverview = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const [agg] = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:                    null,
          totalSessions:          { $sum: 1 },
          completedSessions:      { $sum: { $cond: ["$isCompleted", 1, 0] } },
          uniqueUsers:            { $addToSet: "$user" },
          totalShotsViewed:       { $sum: "$totalShotsViewed" },
          totalUniqueShotsViewed: { $sum: "$uniqueShotsViewed" },
          totalDurationSeconds:   { $sum: "$totalDurationSeconds" },
          avgDurationSeconds:     { $avg: "$totalDurationSeconds" },
          avgShotsPerSession:     { $avg: "$totalShotsViewed" },
          avgLikedPerSession:     { $avg: "$totalLiked" },
          avgMasteredPerSession:  { $avg: "$totalMastered" },
          avgBookmarkedPerSession:{ $avg: "$totalBookmarked" },
          avgSkippedPerSession:   { $avg: "$totalSkipped" },
          totalLiked:             { $sum: "$totalLiked" },
          totalMastered:          { $sum: "$totalMastered" },
          totalBookmarked:        { $sum: "$totalBookmarked" },
          totalSkipped:           { $sum: "$totalSkipped" },
          // review ratio = re-visits / total shots
          totalReviewShots: {
            $sum: {
              $size: {
                $filter: {
                  input: "$shotsViewed",
                  as:    "s",
                  cond:  "$$s.isReview",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id:                    0,
          totalSessions:          1,
          completedSessions:      1,
          completionRate:         {
            $round: [
              { $multiply: [
                { $divide: ["$completedSessions", { $max: ["$totalSessions", 1] }] },
                100,
              ]},
              1,
            ],
          },
          uniqueUsers:            { $size: "$uniqueUsers" },
          totalShotsViewed:       1,
          totalUniqueShotsViewed: 1,
          reviewRatio:            {
            $round: [
              { $multiply: [
                { $divide: ["$totalReviewShots", { $max: ["$totalShotsViewed", 1] }] },
                100,
              ]},
              1,
            ],
          },
          totalDurationSeconds:   1,
          avgDurationSeconds:     { $round: ["$avgDurationSeconds", 0] },
          avgShotsPerSession:     { $round: ["$avgShotsPerSession", 1] },
          totalLiked:             1,
          totalMastered:          1,
          totalBookmarked:        1,
          totalSkipped:           1,
          avgLikedPerSession:     { $round: ["$avgLikedPerSession", 2] },
          avgMasteredPerSession:  { $round: ["$avgMasteredPerSession", 2] },
        },
      },
    ]);

    res.json({ success: true, data: agg || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 2. TIMELINE — daily session volume + avg duration
// GET /api/v1/admin/sessions/timeline?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getSessionTimeline = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const daily = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          sessions:           { $sum: 1 },
          uniqueUsers:        { $addToSet: "$user" },
          totalShots:         { $sum: "$totalShotsViewed" },
          avgDuration:        { $avg: "$totalDurationSeconds" },
          avgShotsPerSession: { $avg: "$totalShotsViewed" },
          totalLiked:         { $sum: "$totalLiked" },
          totalMastered:      { $sum: "$totalMastered" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id:                0,
          date:               "$_id",
          sessions:           1,
          uniqueUsers:        { $size: "$uniqueUsers" },
          totalShots:         1,
          avgDuration:        { $round: ["$avgDuration", 0] },
          avgShotsPerSession: { $round: ["$avgShotsPerSession", 1] },
          totalLiked:         1,
          totalMastered:      1,
        },
      },
    ]);

    res.json({ success: true, data: daily });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 3. ENGAGEMENT — per-shot level signals aggregated
// GET /api/v1/admin/sessions/engagement?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getEngagementAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    // Unwind shotsViewed for per-shot level stats
    const shotLevel = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      { $unwind: "$shotsViewed" },
      {
        $group: {
          _id:                    null,
          totalShotEvents:        { $sum: 1 },
          avgTimePerShot:         { $avg: "$shotsViewed.timeSpentSeconds" },
          avgReadDepth:           { $avg: "$shotsViewed.readDepthPercent" },
          avgPauseCount:          { $avg: "$shotsViewed.pauseCount" },
          avgTotalPauseSeconds:   { $avg: "$shotsViewed.totalPauseSeconds" },
          avgHesitations:         { $avg: "$shotsViewed.hesitationCount" },
          totalExpandedDef:       { $sum: { $cond: ["$shotsViewed.expandedDefinition", 1, 0] } },
          totalOpenedDiagram:     { $sum: { $cond: ["$shotsViewed.openedDiagram", 1, 0] } },
          totalReviews:           { $sum: { $cond: ["$shotsViewed.isReview", 1, 0] } },
          // read depth buckets
          depth0_25:  { $sum: { $cond: [{ $lte: ["$shotsViewed.readDepthPercent", 25] }, 1, 0] } },
          depth26_50: { $sum: { $cond: [{ $and: [
            { $gt:  ["$shotsViewed.readDepthPercent", 25] },
            { $lte: ["$shotsViewed.readDepthPercent", 50] },
          ]}, 1, 0] } },
          depth51_80: { $sum: { $cond: [{ $and: [
            { $gt:  ["$shotsViewed.readDepthPercent", 50] },
            { $lte: ["$shotsViewed.readDepthPercent", 80] },
          ]}, 1, 0] } },
          depth81_100: { $sum: { $cond: [{ $gt: ["$shotsViewed.readDepthPercent", 80] }, 1, 0] } },
          // time-on-shot buckets
          time0_2:   { $sum: { $cond: [{ $lte: ["$shotsViewed.timeSpentSeconds", 2] }, 1, 0] } },
          time3_5:   { $sum: { $cond: [{ $and: [
            { $gt:  ["$shotsViewed.timeSpentSeconds", 2] },
            { $lte: ["$shotsViewed.timeSpentSeconds", 5] },
          ]}, 1, 0] } },
          time6_15:  { $sum: { $cond: [{ $and: [
            { $gt:  ["$shotsViewed.timeSpentSeconds", 5] },
            { $lte: ["$shotsViewed.timeSpentSeconds", 15] },
          ]}, 1, 0] } },
          time15plus: { $sum: { $cond: [{ $gt: ["$shotsViewed.timeSpentSeconds", 15] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id:                  0,
          totalShotEvents:      1,
          avgTimePerShot:       { $round: ["$avgTimePerShot", 1] },
          avgReadDepth:         { $round: ["$avgReadDepth", 1] },
          avgPauseCount:        { $round: ["$avgPauseCount", 2] },
          avgTotalPauseSeconds: { $round: ["$avgTotalPauseSeconds", 1] },
          avgHesitations:       { $round: ["$avgHesitations", 2] },
          totalExpandedDef:     1,
          totalOpenedDiagram:   1,
          totalReviews:         1,
          readDepthBuckets: {
            "0-25":   "$depth0_25",
            "26-50":  "$depth26_50",
            "51-80":  "$depth51_80",
            "81-100": "$depth81_100",
          },
          timeOnShotBuckets: {
            "0-2s":   "$time0_2",
            "3-5s":   "$time3_5",
            "6-15s":  "$time6_15",
            "15s+":   "$time15plus",
          },
        },
      },
    ]);

    // action distribution
    const actionDist = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      { $unwind: "$shotsViewed" },
      { $group: { _id: "$shotsViewed.action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        ...(shotLevel[0] || {}),
        actionDistribution: actionDist,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 4. BEHAVIOUR — scroll velocity, fast-swipes, deep reads
// GET /api/v1/admin/sessions/behaviour?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getBehaviourAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const [agg] = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:                  null,
          totalSessions:        { $sum: 1 },
          // velocity
          avgVelocity:          { $avg: "$scrollBehaviour.avgVelocityMs" },
          // sessions with suspiciously low velocity (possible bug: <10ms)
          suspiciousVelocity:   {
            $sum: {
              $cond: [
                { $and: [
                  { $ne:  ["$scrollBehaviour.avgVelocityMs", null] },
                  { $lt:  ["$scrollBehaviour.avgVelocityMs", 10] },
                ]},
                1, 0,
              ],
            },
          },
          avgPauseSeconds:      { $avg: "$scrollBehaviour.avgPauseSeconds" },
          totalHesitations:     { $sum: "$scrollBehaviour.totalHesitations" },
          avgHesitationsPerSes: { $avg: "$scrollBehaviour.totalHesitations" },
          totalFastSwipes:      { $sum: "$scrollBehaviour.fastSwipeCount" },
          totalDeepReads:       { $sum: "$scrollBehaviour.deepReadCount" },
          avgDeepReadsPerSes:   { $avg: "$scrollBehaviour.deepReadCount" },
          avgReadDepth:         { $avg: "$scrollBehaviour.avgReadDepthPercent" },
          // skimmer sessions (fastSwipeCount > 5)
          skimmerSessions:      {
            $sum: { $cond: [{ $gt: ["$scrollBehaviour.fastSwipeCount", 5] }, 1, 0] },
          },
          // deep engagement sessions (deepReadCount >= 80% of shots)
          deepEngagementSessions: {
            $sum: {
              $cond: [
                { $gte: [
                  { $divide: ["$scrollBehaviour.deepReadCount", { $max: ["$totalShotsViewed", 1] }] },
                  0.8,
                ]},
                1, 0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id:                    0,
          totalSessions:          1,
          avgVelocityMs:          { $round: ["$avgVelocity", 0] },
          suspiciousVelocitySessions: "$suspiciousVelocity",
          avgPauseSeconds:        { $round: ["$avgPauseSeconds", 2] },
          totalHesitations:       1,
          avgHesitationsPerSession: { $round: ["$avgHesitationsPerSes", 2] },
          totalFastSwipes:        1,
          totalDeepReads:         1,
          avgDeepReadsPerSession: { $round: ["$avgDeepReadsPerSes", 1] },
          avgReadDepthPercent:    { $round: ["$avgReadDepth", 1] },
          skimmerSessions:        1,
          deepEngagementSessions: 1,
          skimmerRate:            {
            $round: [
              { $multiply: [
                { $divide: ["$skimmerSessions", { $max: ["$totalSessions", 1] }] }, 100,
              ]}, 1,
            ],
          },
          deepEngagementRate:     {
            $round: [
              { $multiply: [
                { $divide: ["$deepEngagementSessions", { $max: ["$totalSessions", 1] }] }, 100,
              ]}, 1,
            ],
          },
        },
      },
    ]);

    res.json({ success: true, data: agg || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 5. VIEW MODE — snap vs list breakdown
// GET /api/v1/admin/sessions/viewmode?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getViewModeAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const byMode = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:                "$viewMode",
          sessions:           { $sum: 1 },
          uniqueUsers:        { $addToSet: "$user" },
          avgDuration:        { $avg: "$totalDurationSeconds" },
          avgShots:           { $avg: "$totalShotsViewed" },
          avgDeepReads:       { $avg: "$scrollBehaviour.deepReadCount" },
          avgReadDepth:       { $avg: "$scrollBehaviour.avgReadDepthPercent" },
          avgHesitations:     { $avg: "$scrollBehaviour.totalHesitations" },
          totalLiked:         { $sum: "$totalLiked" },
          totalMastered:      { $sum: "$totalMastered" },
        },
      },
      {
        $project: {
          _id:          0,
          mode:         "$_id",
          sessions:     1,
          uniqueUsers:  { $size: "$uniqueUsers" },
          avgDuration:  { $round: ["$avgDuration", 0] },
          avgShots:     { $round: ["$avgShots", 1] },
          avgDeepReads: { $round: ["$avgDeepReads", 1] },
          avgReadDepth: { $round: ["$avgReadDepth", 1] },
          avgHesitations: { $round: ["$avgHesitations", 2] },
          totalLiked:   1,
          totalMastered:1,
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    // mode switch stats
    const [switchStats] = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:             null,
          totalSessions:   { $sum: 1 },
          switchedCount:   { $sum: { $cond: ["$modeSwitch.switched", 1, 0] } },
          avgSwitchCount:  { $avg: "$modeSwitch.switchCount" },
          // started as snap → ended as list
          snapToList: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$modeSwitch.startedAs", "snap"] },
                  { $eq: ["$modeSwitch.endedAs",   "list"] },
                ]},
                1, 0,
              ],
            },
          },
          // started as list → ended as snap
          listToSnap: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$modeSwitch.startedAs", "list"] },
                  { $eq: ["$modeSwitch.endedAs",   "snap"] },
                ]},
                1, 0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id:            0,
          switchedCount:  1,
          switchRate:     {
            $round: [
              { $multiply: [
                { $divide: ["$switchedCount", { $max: ["$totalSessions", 1] }] }, 100,
              ]}, 1,
            ],
          },
          avgSwitchCount: { $round: ["$avgSwitchCount", 2] },
          snapToList:     1,
          listToSnap:     1,
        },
      },
    ]);

    res.json({
      success: true,
      data: { byMode, switchStats: switchStats || {} },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 6. A/B TEST — snap_default vs list_default
// GET /api/v1/admin/sessions/abtest?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getABTestAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const byVariant = await ArkShotSession.aggregate([
      {
        $match: {
          ...activeMatch(since),
          "abTest.experimentId": { $ne: null },
        },
      },
      {
        $group: {
          _id:              "$abTest.variant",
          experimentId:     { $first: "$abTest.experimentId" },
          sessions:         { $sum: 1 },
          uniqueUsers:      { $addToSet: "$user" },
          avgDuration:      { $avg: "$totalDurationSeconds" },
          avgShots:         { $avg: "$totalShotsViewed" },
          avgLiked:         { $avg: "$totalLiked" },
          avgMastered:      { $avg: "$totalMastered" },
          avgDeepReads:     { $avg: "$scrollBehaviour.deepReadCount" },
          avgReadDepth:     { $avg: "$scrollBehaviour.avgReadDepthPercent" },
          avgHesitations:   { $avg: "$scrollBehaviour.totalHesitations" },
          completedCount:   { $sum: { $cond: ["$isCompleted", 1, 0] } },
        },
      },
      {
        $project: {
          _id:            0,
          variant:        "$_id",
          experimentId:   1,
          sessions:       1,
          uniqueUsers:    { $size: "$uniqueUsers" },
          avgDuration:    { $round: ["$avgDuration", 0] },
          avgShots:       { $round: ["$avgShots", 1] },
          avgLiked:       { $round: ["$avgLiked", 2] },
          avgMastered:    { $round: ["$avgMastered", 2] },
          avgDeepReads:   { $round: ["$avgDeepReads", 1] },
          avgReadDepth:   { $round: ["$avgReadDepth", 1] },
          avgHesitations: { $round: ["$avgHesitations", 2] },
          completionRate: {
            $round: [
              { $multiply: [
                { $divide: ["$completedCount", { $max: ["$sessions", 1] }] }, 100,
              ]}, 1,
            ],
          },
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    res.json({ success: true, data: byVariant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 7. ENTRY SOURCE — funnel by source
// GET /api/v1/admin/sessions/entrysource?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getEntrySourceAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const bySource = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:          "$entrySource",
          sessions:     { $sum: 1 },
          uniqueUsers:  { $addToSet: "$user" },
          avgDuration:  { $avg: "$totalDurationSeconds" },
          avgShots:     { $avg: "$totalShotsViewed" },
          avgLiked:     { $avg: "$totalLiked" },
          avgMastered:  { $avg: "$totalMastered" },
          avgReadDepth: { $avg: "$scrollBehaviour.avgReadDepthPercent" },
        },
      },
      {
        $project: {
          _id:         0,
          source:      "$_id",
          sessions:    1,
          uniqueUsers: { $size: "$uniqueUsers" },
          avgDuration: { $round: ["$avgDuration", 0] },
          avgShots:    { $round: ["$avgShots", 1] },
          avgLiked:    { $round: ["$avgLiked", 2] },
          avgMastered: { $round: ["$avgMastered", 2] },
          avgReadDepth:{ $round: ["$avgReadDepth", 1] },
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    res.json({ success: true, data: bySource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 8. TOP SHOTS — most engaged shots across all sessions
// GET /api/v1/admin/sessions/topshots?days=30&limit=15
// ─────────────────────────────────────────────────────────────────────────
export const getTopShotsAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);
    const limit = parseInt(req.query.limit) || 15;

    const topShots = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      { $unwind: "$shotsViewed" },
      {
        $group: {
          _id:              "$shotsViewed.arkShot",
          totalViews:       { $sum: 1 },
          uniqueSessions:   { $addToSet: "$_id" },
          uniqueUsers:      { $addToSet: "$user" },
          avgTimeSpent:     { $avg: "$shotsViewed.timeSpentSeconds" },
          avgReadDepth:     { $avg: "$shotsViewed.readDepthPercent" },
          avgPauseSeconds:  { $avg: "$shotsViewed.totalPauseSeconds" },
          avgHesitations:   { $avg: "$shotsViewed.hesitationCount" },
          totalReviews:     { $sum: { $cond: ["$shotsViewed.isReview", 1, 0] } },
          expandedDefCount: { $sum: { $cond: ["$shotsViewed.expandedDefinition", 1, 0] } },
          openedDiagramCount:{ $sum: { $cond: ["$shotsViewed.openedDiagram", 1, 0] } },
        },
      },
      {
        $project: {
          _id:              0,
          shotId:           "$_id",
          totalViews:       1,
          uniqueSessions:   { $size: "$uniqueSessions" },
          uniqueUsers:      { $size: "$uniqueUsers" },
          avgTimeSpent:     { $round: ["$avgTimeSpent", 1] },
          avgReadDepth:     { $round: ["$avgReadDepth", 1] },
          avgPauseSeconds:  { $round: ["$avgPauseSeconds", 1] },
          avgHesitations:   { $round: ["$avgHesitations", 2] },
          totalReviews:     1,
          expandedDefCount: 1,
          openedDiagramCount: 1,
          // engagement score = weighted composite
          engagementScore: {
            $round: [
              { $add: [
                { $multiply: ["$avgTimeSpent",    2.0] },
                { $multiply: ["$avgPauseSeconds", 1.5] },
                { $multiply: ["$totalReviews",    3.0] },
                { $multiply: ["$avgHesitations",  1.0] },
              ]},
              1,
            ],
          },
        },
      },
      { $sort: { engagementScore: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from:         "arkshots",
          localField:   "shotId",
          foreignField: "_id",
          as:           "shot",
        },
      },
      { $unwind: { path: "$shot", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          shotId:           1,
          totalViews:       1,
          uniqueSessions:   1,
          uniqueUsers:      1,
          avgTimeSpent:     1,
          avgReadDepth:     1,
          avgPauseSeconds:  1,
          avgHesitations:   1,
          totalReviews:     1,
          expandedDefCount: 1,
          openedDiagramCount:1,
          engagementScore:  1,
          title:            "$shot.title",
          subject:          "$shot.subject",
          unit:             "$shot.unit",
          semester:         "$shot.semester",
        },
      },
    ]);

    res.json({ success: true, data: topShots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 9. DROP-OFF — reasons + shot position patterns
// GET /api/v1/admin/sessions/dropoff?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getDropOffAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    // By reason
    const byReason = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      { $group: { _id: "$dropOffReason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, reason: "$_id", count: 1 } },
    ]);

    // Drop-off by shot count bucket (how many shots before leaving)
    const byDepth = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $bucket: {
          groupBy: "$totalShotsViewed",
          boundaries: [1, 3, 6, 11, 21, 51, 101],
          default: "100+",
          output: {
            sessions:    { $sum: 1 },
            avgDuration: { $avg: "$totalDurationSeconds" },
          },
        },
      },
      {
        $project: {
          _id:         0,
          shotsRange:  "$_id",
          sessions:    1,
          avgDuration: { $round: ["$avgDuration", 0] },
        },
      },
    ]);

    res.json({
      success: true,
      data: { byReason, byDepth },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 10. DEVICE — mobile vs desktop vs tablet
// GET /api/v1/admin/sessions/device?days=30
// ─────────────────────────────────────────────────────────────────────────
export const getDeviceAnalytics = async (req, res) => {
  try {
    const since = getSince(req.query.days);

    const byDevice = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:          "$device",
          sessions:     { $sum: 1 },
          uniqueUsers:  { $addToSet: "$user" },
          avgDuration:  { $avg: "$totalDurationSeconds" },
          avgShots:     { $avg: "$totalShotsViewed" },
          avgReadDepth: { $avg: "$scrollBehaviour.avgReadDepthPercent" },
          avgHesitations:{ $avg: "$scrollBehaviour.totalHesitations" },
          totalLiked:   { $sum: "$totalLiked" },
          totalMastered:{ $sum: "$totalMastered" },
        },
      },
      {
        $project: {
          _id:          0,
          device:       "$_id",
          sessions:     1,
          uniqueUsers:  { $size: "$uniqueUsers" },
          avgDuration:  { $round: ["$avgDuration", 0] },
          avgShots:     { $round: ["$avgShots", 1] },
          avgReadDepth: { $round: ["$avgReadDepth", 1] },
          avgHesitations: { $round: ["$avgHesitations", 2] },
          totalLiked:   1,
          totalMastered:1,
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    // device × viewMode cross breakdown
    const crossBreakdown = await ArkShotSession.aggregate([
      { $match: activeMatch(since) },
      {
        $group: {
          _id:      { device: "$device", viewMode: "$viewMode" },
          sessions: { $sum: 1 },
          avgShots: { $avg: "$totalShotsViewed" },
          avgDuration: { $avg: "$totalDurationSeconds" },
        },
      },
      {
        $project: {
          _id:      0,
          device:   "$_id.device",
          viewMode: "$_id.viewMode",
          sessions: 1,
          avgShots: { $round: ["$avgShots", 1] },
          avgDuration: { $round: ["$avgDuration", 0] },
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    res.json({
      success: true,
      data: { byDevice, crossBreakdown },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};