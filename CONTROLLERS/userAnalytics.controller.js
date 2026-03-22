// src/CONTROLLERS/userAnalytics.controller.js
import User from "../MODELS/user.model.js";
// import AppError from "../UTILS/appError.js";
import asyncHandler from "../UTIL/asyncHandler.js";
// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────
const now       = () => new Date();
const daysAgo   = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const weeksAgo  = (n) => daysAgo(n * 7);
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

// ══════════════════════════════════════════════
// 📅 ACQUISITION
// ══════════════════════════════════════════════

// GET /acquisition/monthly?year=2025
export const getMonthlyAcquisition = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const data = await User.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31T23:59:59`),
        },
      },
    },
    {
      $group: {
        _id:   { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill all 12 months — even months with 0
  const MONTHS = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  const filled = MONTHS.map((label, i) => {
    const found = data.find((d) => d._id === i + 1);
    return { month: label, monthNumber: i + 1, count: found?.count ?? 0 };
  });

  const total = filled.reduce((s, d) => s + d.count, 0);
  const peak  = filled.reduce((a, b) => (b.count > a.count ? b : a), filled[0]);

  res.status(200).json({
    success: true,
    year,
    total,
    peak,
    data: filled,
  });
});

// GET /acquisition/yearly?from=2023&to=2026
export const getYearlyAcquisition = asyncHandler(async (req, res) => {
  const from = parseInt(req.query.from) || 2023;
  const to   = parseInt(req.query.to)   || new Date().getFullYear();

  const data = await User.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${from}-01-01`),
          $lte: new Date(`${to}-12-31T23:59:59`),
        },
      },
    },
    {
      $group: {
        _id:   { $year: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        year:  "$_id",
        count: 1,
        _id:   0,
      },
    },
  ]);

  // Fill missing years
  const filled = [];
  for (let y = from; y <= to; y++) {
    const found = data.find((d) => d.year === y);
    filled.push({ year: y, count: found?.count ?? 0 });
  }

  res.status(200).json({
    success: true,
    from,
    to,
    total: filled.reduce((s, d) => s + d.count, 0),
    data:  filled,
  });
});

// GET /acquisition/daily?days=30
export const getDailyAcquisition = asyncHandler(async (req, res) => {
  const days  = parseInt(req.query.days) || 30;
  const since = daysAgo(days);

  const data = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ]);

  // Fill every day in range
  const filled = [];
  for (let i = days - 1; i >= 0; i--) {
    const d     = daysAgo(i);
    const label = d.toISOString().split("T")[0];
    const found = data.find((r) => r.date === label);
    filled.push({ date: label, count: found?.count ?? 0 });
  }

  res.status(200).json({
    success: true,
    days,
    total: filled.reduce((s, d) => s + d.count, 0),
    data:  filled,
  });
});

// GET /acquisition/auth-provider
export const getAcquisitionByAuthProvider = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    {
      $group: {
        _id:   { $ifNull: ["$authProvider", "email"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $project: { provider: "$_id", count: 1, _id: 0 } },
  ]);

  const total = data.reduce((s, d) => s + d.count, 0);
  const withPct = data.map((d) => ({
    ...d,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  res.status(200).json({ success: true, total, data: withPct });
});

// ══════════════════════════════════════════════
// 🔥 ENGAGEMENT
// ══════════════════════════════════════════════

// GET /engagement/dau?days=30
export const getDailyActiveUsers = asyncHandler(async (req, res) => {
  const days  = parseInt(req.query.days) || 30;
  const since = daysAgo(days);

  const data = await User.aggregate([
    {
      $match: {
        lastHomepageVisit: { $gte: since, $ne: null },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$lastHomepageVisit" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ]);

  // Fill gaps
  const filled = [];
  for (let i = days - 1; i >= 0; i--) {
    const label = daysAgo(i).toISOString().split("T")[0];
    const found = data.find((r) => r.date === label);
    filled.push({ date: label, dau: found?.count ?? 0 });
  }

  const avg = Math.round(
    filled.reduce((s, d) => s + d.dau, 0) / filled.length
  );
  const peak = filled.reduce((a, b) => (b.dau > a.dau ? b : a), filled[0]);

  res.status(200).json({ success: true, days, avg, peak, data: filled });
});

// GET /engagement/wau?weeks=8
export const getWeeklyActiveUsers = asyncHandler(async (req, res) => {
  const weeks = parseInt(req.query.weeks) || 8;
  const since = weeksAgo(weeks);

  const data = await User.aggregate([
    {
      $match: {
        lastHomepageVisit: { $gte: since, $ne: null },
      },
    },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: "$lastHomepageVisit" },
          week: { $isoWeek:     "$lastHomepageVisit" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.week": 1 } },
    {
      $project: {
        week:  { $concat: [{ $toString: "$_id.year" }, "-W", { $toString: "$_id.week" }] },
        count: 1,
        _id:   0,
      },
    },
  ]);

  res.status(200).json({ success: true, weeks, data });
});

// GET /engagement/mau?months=6
export const getMonthlyActiveUsers = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const since  = monthsAgo(months);

  const data = await User.aggregate([
    {
      $match: {
        lastHomepageVisit: { $gte: since, $ne: null },
      },
    },
    {
      $group: {
        _id: {
          year:  { $year:  "$lastHomepageVisit" },
          month: { $month: "$lastHomepageVisit" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    {
      $project: {
        period: {
          $concat: [
            { $toString: "$_id.year" }, "-",
            { $cond: [
                { $lt: ["$_id.month", 10] },
                { $concat: ["0", { $toString: "$_id.month" }] },
                { $toString: "$_id.month" },
            ]},
          ],
        },
        count: 1,
        _id:   0,
      },
    },
  ]);

  res.status(200).json({ success: true, months, data });
});

// GET /engagement/returning?days=30
// "Returning" = lastHomepageVisit is on a DIFFERENT calendar day than createdAt
export const getReturningUsers = asyncHandler(async (req, res) => {
  const days  = parseInt(req.query.days) || 30;
  const since = daysAgo(days);

  const [result] = await User.aggregate([
    {
      $match: {
        lastHomepageVisit: { $gte: since, $ne: null },
      },
    },
    {
      $addFields: {
        signupDay:  { $dateToString: { format: "%Y-%m-%d", date: "$createdAt"          } },
        visitDay:   { $dateToString: { format: "%Y-%m-%d", date: "$lastHomepageVisit"  } },
      },
    },
    {
      $group: {
        _id:       null,
        total:     { $sum: 1 },
        returning: {
          $sum: {
            $cond: [{ $ne: ["$signupDay", "$visitDay"] }, 1, 0],
          },
        },
        newVisit: {
          $sum: {
            $cond: [{ $eq: ["$signupDay", "$visitDay"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const total     = result?.total     ?? 0;
  const returning = result?.returning ?? 0;
  const newVisit  = result?.newVisit  ?? 0;

  res.status(200).json({
    success: true,
    days,
    total,
    returning,
    new: newVisit,
    returningRate: total > 0 ? `${Math.round((returning / total) * 100)}%` : "0%",
  });
});

// GET /engagement/churned?inactiveDays=30
export const getChurnedUsers = asyncHandler(async (req, res) => {
  const inactiveDays = parseInt(req.query.inactiveDays) || 30;
  const cutoff       = daysAgo(inactiveDays);

  const [result] = await User.aggregate([
    {
      $facet: {
        // Never visited at all
        neverVisited: [
          { $match: { lastHomepageVisit: null } },
          { $count: "count" },
        ],
        // Visited but not recently
        inactive: [
          {
            $match: {
              lastHomepageVisit: { $lt: cutoff, $ne: null },
            },
          },
          { $count: "count" },
        ],
        // Active
        active: [
          {
            $match: {
              lastHomepageVisit: { $gte: cutoff },
            },
          },
          { $count: "count" },
        ],
        total: [
          { $count: "count" },
        ],
      },
    },
  ]);

  const total       = result.total[0]?.count       ?? 0;
  const active      = result.active[0]?.count      ?? 0;
  const inactive    = result.inactive[0]?.count    ?? 0;
  const neverVisited= result.neverVisited[0]?.count ?? 0;
  const churned     = inactive + neverVisited;

  res.status(200).json({
    success: true,
    inactiveDays,
    total,
    active,
    inactive,
    neverVisited,
    churned,
    churnRate:   total > 0 ? `${Math.round((churned  / total) * 100)}%` : "0%",
    activeRate:  total > 0 ? `${Math.round((active   / total) * 100)}%` : "0%",
  });
});

// GET /engagement/homepage-trend?days=30
export const getHomepageVisitTrend = asyncHandler(async (req, res) => {
  const days  = parseInt(req.query.days) || 30;
  const since = daysAgo(days);

  const data = await User.aggregate([
    { $match: { lastHomepageVisit: { $gte: since, $ne: null } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$lastHomepageVisit" },
        },
        visits: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", visits: 1, _id: 0 } },
  ]);

  // Fill all days
  const filled = [];
  for (let i = days - 1; i >= 0; i--) {
    const label = daysAgo(i).toISOString().split("T")[0];
    const found = data.find((r) => r.date === label);
    filled.push({ date: label, visits: found?.visits ?? 0 });
  }

  res.status(200).json({ success: true, days, data: filled });
});

// ══════════════════════════════════════════════
// 📚 STUDY BEHAVIOUR
// ══════════════════════════════════════════════

// GET /study/streak-distribution
export const getStudyStreakDistribution = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    {
      $bucket: {
        groupBy: "$studyStreak",
        boundaries: [0, 1, 4, 8, 15, 31, 100],
        default:    "100+",
        output:     { count: { $sum: 1 } },
      },
    },
  ]);

  const labels = ["0", "1–3", "4–7", "8–14", "15–30", "31–99", "100+"];
  const formatted = data.map((d, i) => ({
    bucket: labels[i] ?? d._id,
    count:  d.count,
  }));

  res.status(200).json({ success: true, data: formatted });
});

// GET /study/time-distribution
export const getStudyTimeDistribution = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    {
      $bucket: {
        groupBy:    "$totalStudyTimeMinutes",
        boundaries: [0, 1, 61, 301, 601, 1501],
        default:    "1500+",
        output:     { count: { $sum: 1 } },
      },
    },
  ]);

  const labels = ["0 min", "1–60 min", "1–5 hrs", "5–10 hrs", "10–25 hrs", "25+ hrs"];
  const formatted = data.map((d, i) => ({
    bucket: labels[i] ?? d._id,
    count:  d.count,
  }));

  res.status(200).json({ success: true, data: formatted });
});

// GET /study/planner-adoption
export const getPlannerAdoptionStats = asyncHandler(async (req, res) => {
  const [result] = await User.aggregate([
    {
      $facet: {
        adopted: [
          { $match: { "plannerSetup.isCompleted": true } },
          { $count: "count" },
        ],
        notAdopted: [
          { $match: { "plannerSetup.isCompleted": { $ne: true } } },
          { $count: "count" },
        ],
        total: [
          { $count: "count" },
        ],
        // Monthly adoption trend
        trend: [
          { $match: { "plannerSetup.isCompleted": true, "plannerSetup.completedAt": { $ne: null } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m", date: "$plannerSetup.completedAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { month: "$_id", count: 1, _id: 0 } },
        ],
      },
    },
  ]);

  const total    = result.total[0]?.count    ?? 0;
  const adopted  = result.adopted[0]?.count  ?? 0;
  const notAdopted = result.notAdopted[0]?.count ?? 0;

  res.status(200).json({
    success: true,
    total,
    adopted,
    notAdopted,
    adoptionRate: total > 0 ? `${Math.round((adopted / total) * 100)}%` : "0%",
    trend: result.trend,
  });
});

// GET /study/top-users?limit=20
export const getTopStudyUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const data = await User.find(
    { totalStudyTimeMinutes: { $gt: 0 } },
    {
      fullName:              1,
      email:                 1,
      "avatar.secure_url":   1,
      totalStudyTimeMinutes: 1,
      studyStreak:           1,
      "academicProfile.branch":   1,
      "academicProfile.semester": 1,
    }
  )
    .sort({ totalStudyTimeMinutes: -1 })
    .limit(limit)
    .lean();

  const formatted = data.map((u, i) => ({
    rank:          i + 1,
    fullName:      u.fullName,
    email:         u.email,
    avatar:        u.avatar?.secure_url ?? null,
    hoursStudied:  Math.round((u.totalStudyTimeMinutes / 60) * 10) / 10,
    studyStreak:   u.studyStreak,
    branch:        u.academicProfile?.branch   ?? "—",
    semester:      u.academicProfile?.semester ?? "—",
  }));

  res.status(200).json({ success: true, limit, data: formatted });
});

// ══════════════════════════════════════════════
// 👤 PROFILE HEALTH
// ══════════════════════════════════════════════

// GET /profile/completion-funnel
export const getProfileCompletionFunnel = asyncHandler(async (req, res) => {
  const [result] = await User.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],

        hasAvatar: [
          { $match: { "avatar.secure_url": { $ne: null, $exists: true, $gt: "" } } },
          { $count: "count" },
        ],

        hasBio: [
          { $match: { bio: { $exists: true, $ne: "", $ne: null } } },
          { $count: "count" },
        ],

        hasAcademicProfile: [
          { $match: { "academicProfile.isCompleted": true } },
          { $count: "count" },
        ],

        hasSocialLink: [
          {
            $match: {
              $or: [
                { "socialLinks.github":   { $ne: "", $exists: true } },
                { "socialLinks.linkedin": { $ne: "", $exists: true } },
                { "socialLinks.twitter":  { $ne: "", $exists: true } },
                { "socialLinks.website":  { $ne: "", $exists: true } },
              ],
            },
          },
          { $count: "count" },
        ],

        // "Full profile" = has all 4
        fullProfile: [
          {
            $match: {
              "avatar.secure_url":        { $ne: null, $gt: "" },
              bio:                        { $ne: "", $ne: null },
              "academicProfile.isCompleted": true,
              $or: [
                { "socialLinks.github":   { $ne: "" } },
                { "socialLinks.linkedin": { $ne: "" } },
                { "socialLinks.twitter":  { $ne: "" } },
                { "socialLinks.website":  { $ne: "" } },
              ],
            },
          },
          { $count: "count" },
        ],
      },
    },
  ]);

  const total = result.total[0]?.count ?? 0;

  const steps = [
    { step: "Total Users",         count: total },
    { step: "Has Avatar",          count: result.hasAvatar[0]?.count          ?? 0 },
    { step: "Has Bio",             count: result.hasBio[0]?.count             ?? 0 },
    { step: "Academic Profile",    count: result.hasAcademicProfile[0]?.count ?? 0 },
    { step: "Has Social Link",     count: result.hasSocialLink[0]?.count      ?? 0 },
    { step: "Full Profile",        count: result.fullProfile[0]?.count        ?? 0 },
  ].map((s) => ({
    ...s,
    percentage: total > 0 ? Math.round((s.count / total) * 100) : 0,
  }));

  res.status(200).json({ success: true, total, steps });
});

// GET /profile/social-links
export const getSocialLinkAdoption = asyncHandler(async (req, res) => {
  const [result] = await User.aggregate([
    {
      $facet: {
        github: [
          { $match: { "socialLinks.github": { $ne: "", $exists: true, $ne: null } } },
          { $count: "count" },
        ],
        linkedin: [
          { $match: { "socialLinks.linkedin": { $ne: "", $exists: true, $ne: null } } },
          { $count: "count" },
        ],
        twitter: [
          { $match: { "socialLinks.twitter": { $ne: "", $exists: true, $ne: null } } },
          { $count: "count" },
        ],
        website: [
          { $match: { "socialLinks.website": { $ne: "", $exists: true, $ne: null } } },
          { $count: "count" },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total = result.total[0]?.count ?? 0;

  const platforms = ["github", "linkedin", "twitter", "website"].map((p) => ({
    platform:   p,
    count:      result[p][0]?.count ?? 0,
    percentage: total > 0 ? Math.round(((result[p][0]?.count ?? 0) / total) * 100) : 0,
  }));

  res.status(200).json({ success: true, total, data: platforms });
});

// GET /profile/bio-adoption
export const getBioAdoptionStats = asyncHandler(async (req, res) => {
  const [result] = await User.aggregate([
    {
      $facet: {
        hasBio: [
          { $match: { bio: { $exists: true, $ne: "", $ne: null } } },
          { $count: "count" },
        ],
        noBio: [
          { $match: { $or: [{ bio: "" }, { bio: null }, { bio: { $exists: false } }] } },
          { $count: "count" },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total  = result.total[0]?.count  ?? 0;
  const hasBio = result.hasBio[0]?.count ?? 0;
  const noBio  = result.noBio[0]?.count  ?? 0;

  res.status(200).json({
    success:    true,
    total,
    hasBio,
    noBio,
    adoptionRate: total > 0 ? `${Math.round((hasBio / total) * 100)}%` : "0%",
  });
});

// GET /profile/visibility
export const getPublicVsPrivateProfiles = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    {
      $group: {
        _id:   "$isProfilePublic",
        count: { $sum: 1 },
      },
    },
  ]);

  const publicCount  = data.find((d) => d._id === true)?. count  ?? 0;
  const privateCount = data.find((d) => d._id === false)?.count  ?? 0;
  const total        = publicCount + privateCount;

  res.status(200).json({
    success: true,
    total,
    public:  publicCount,
    private: privateCount,
    publicRate:  total > 0 ? `${Math.round((publicCount  / total) * 100)}%` : "0%",
    privateRate: total > 0 ? `${Math.round((privateCount / total) * 100)}%` : "0%",
  });
});

// ══════════════════════════════════════════════
// 💳 PAYWALL / ACCESS
// ══════════════════════════════════════════════

// GET /access/paid-vs-free
export const getPaidVsFreeRatio = asyncHandler(async (req, res) => {
  const now_ = now();

  const [result] = await User.aggregate([
    {
      $facet: {
        paid: [
          {
            $match: {
              "access.plan":      { $ne: null },
              "access.expiresAt": { $gt: now_ },
            },
          },
          { $count: "count" },
        ],
        expired: [
          {
            $match: {
              "access.plan":      { $ne: null },
              "access.expiresAt": { $lte: now_ },
            },
          },
          { $count: "count" },
        ],
        free: [
          { $match: { "access.plan": null } },
          { $count: "count" },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total   = result.total[0]?.count   ?? 0;
  const paid    = result.paid[0]?.count    ?? 0;
  const expired = result.expired[0]?.count ?? 0;
  const free    = result.free[0]?.count    ?? 0;

  res.status(200).json({
    success: true,
    total,
    paid,
    expired,
    free,
    paidRate:    total > 0 ? `${Math.round((paid    / total) * 100)}%` : "0%",
    expiredRate: total > 0 ? `${Math.round((expired / total) * 100)}%` : "0%",
    freeRate:    total > 0 ? `${Math.round((free    / total) * 100)}%` : "0%",
  });
});

// GET /access/plan-distribution
export const getPlanDistribution = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    { $match: { "access.plan": { $ne: null } } },
    {
      $lookup: {
        from:         "plans",
        localField:   "access.plan",
        foreignField: "_id",
        as:           "planDoc",
      },
    },
    { $unwind: { path: "$planDoc", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id:      "$planDoc.name",
        count:    { $sum: 1 },
        active:   {
          $sum: { $cond: [{ $gt: ["$access.expiresAt", now()] }, 1, 0] },
        },
        expired:  {
          $sum: { $cond: [{ $lte: ["$access.expiresAt", now()] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
    {
      $project: {
        planName: { $ifNull: ["$_id", "Unknown"] },
        count:    1,
        active:   1,
        expired:  1,
        _id:      0,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    total: data.reduce((s, d) => s + d.count, 0),
    data,
  });
});

// GET /access/download-stats?days=7
export const getDailyDownloadStats = asyncHandler(async (req, res) => {
  const days  = parseInt(req.query.days) || 7;
  const since = daysAgo(days);

  // downloadsToday is a daily counter reset each day —
  // we use lastDownloadDate to group by day
  const data = await User.aggregate([
    {
      $match: {
        "access.lastDownloadDate": { $gte: since, $ne: null },
        "access.downloadsToday":   { $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date:   "$access.lastDownloadDate",
          },
        },
        totalDownloads:   { $sum: "$access.downloadsToday" },
        activeDownloaders:{ $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date:              "$_id",
        totalDownloads:    1,
        activeDownloaders: 1,
        _id:               0,
      },
    },
  ]);

  // Fill gaps
  const filled = [];
  for (let i = days - 1; i >= 0; i--) {
    const label = daysAgo(i).toISOString().split("T")[0];
    const found = data.find((r) => r.date === label);
    filled.push({
      date:              label,
      totalDownloads:    found?.totalDownloads    ?? 0,
      activeDownloaders: found?.activeDownloaders ?? 0,
    });
  }

  res.status(200).json({
    success: true,
    days,
    totalOverPeriod: filled.reduce((s, d) => s + d.totalDownloads, 0),
    data: filled,
  });
});

// GET /access/expiring?withinDays=7
export const getExpiringSubscriptions = asyncHandler(async (req, res) => {
  const withinDays = parseInt(req.query.withinDays) || 7;
  const now_       = now();
  const cutoff     = daysAgo(-withinDays); // future date

  const data = await User.find(
    {
      "access.plan":      { $ne: null },
      "access.expiresAt": { $gt: now_, $lte: cutoff },
    },
    {
      fullName:           1,
      email:              1,
      "access.expiresAt": 1,
      "access.plan":      1,
    }
  )
    .populate("access.plan", "name price")
    .sort({ "access.expiresAt": 1 })
    .lean();

  res.status(200).json({
    success:    true,
    withinDays,
    count:      data.length,
    data,
  });
});

// ══════════════════════════════════════════════
// 🔐 ROLES
// ══════════════════════════════════════════════

// GET /roles/distribution
export const getRoleDistribution = asyncHandler(async (req, res) => {
  const data = await User.aggregate([
    {
      $group: {
        _id:   "$role",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $project: { role: "$_id", count: 1, _id: 0 } },
  ]);

  const total = data.reduce((s, d) => s + d.count, 0);
  const withPct = data.map((d) => ({
    ...d,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  res.status(200).json({ success: true, total, data: withPct });
});

// ══════════════════════════════════════════════
// 🔄 COHORT ANALYTICS
// ══════════════════════════════════════════════

// GET /cohort/retention?months=6
// Returns a cohort table:
// Each row = signup month
// Cols = % still active after Week1 / Week2 / Month1 / Month2 / Month3
export const getCohortRetention = asyncHandler(async (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 12);
  const since  = monthsAgo(months);

  const users = await User.find(
    { createdAt: { $gte: since } },
    { createdAt: 1, lastHomepageVisit: 1 }
  ).lean();

  // Build cohort map: key = "YYYY-MM"
  const cohorts = {};

  users.forEach((u) => {
    const cohortKey = u.createdAt.toISOString().slice(0, 7); // "2025-03"
    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = { total: 0, w1: 0, w2: 0, m1: 0, m2: 0, m3: 0 };
    }

    cohorts[cohortKey].total++;

    if (!u.lastHomepageVisit) return;

    const signupMs  = u.createdAt.getTime();
    const visitMs   = u.lastHomepageVisit.getTime();
    const diffDays  = (visitMs - signupMs) / (1000 * 60 * 60 * 24);

    if (diffDays >= 1  && diffDays <= 7)   cohorts[cohortKey].w1++;
    if (diffDays >= 8  && diffDays <= 14)  cohorts[cohortKey].w2++;
    if (diffDays >= 15 && diffDays <= 30)  cohorts[cohortKey].m1++;
    if (diffDays >= 31 && diffDays <= 60)  cohorts[cohortKey].m2++;
    if (diffDays >= 61 && diffDays <= 90)  cohorts[cohortKey].m3++;
  });

  const pct = (n, total) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const table = Object.entries(cohorts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, c]) => ({
      cohort,
      total:  c.total,
      week1:  { count: c.w1, rate: `${pct(c.w1, c.total)}%` },
      week2:  { count: c.w2, rate: `${pct(c.w2, c.total)}%` },
      month1: { count: c.m1, rate: `${pct(c.m1, c.total)}%` },
      month2: { count: c.m2, rate: `${pct(c.m2, c.total)}%` },
      month3: { count: c.m3, rate: `${pct(c.m3, c.total)}%` },
    }));

  res.status(200).json({ success: true, months, cohorts: table });
});

// GET /cohort/signup-to-first-action
// How quickly users returned after signup
export const getSignupToFirstAction = asyncHandler(async (req, res) => {
  const users = await User.find(
    {},
    { createdAt: 1, lastHomepageVisit: 1, lastStudyDate: 1 }
  ).lean();

  const buckets = {
    sameDay:  0,  // 0 days
    d1to3:    0,  // 1–3 days
    d4to7:    0,  // 4–7 days
    w2:       0,  // 8–14 days
    w3plus:   0,  // 15+ days
    never:    0,  // no homepage visit ever
  };

  users.forEach((u) => {
    if (!u.lastHomepageVisit) {
      buckets.never++;
      return;
    }

    const diffDays =
      (u.lastHomepageVisit.getTime() - u.createdAt.getTime()) /
      (1000 * 60 * 60 * 24);

    if (diffDays < 1)       buckets.sameDay++;
    else if (diffDays <= 3) buckets.d1to3++;
    else if (diffDays <= 7) buckets.d4to7++;
    else if (diffDays <= 14)buckets.w2++;
    else                    buckets.w3plus++;
  });

  const total = users.length;
  const pct   = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const data = [
    { bucket: "Same day",    count: buckets.sameDay, percentage: pct(buckets.sameDay)  },
    { bucket: "1–3 days",    count: buckets.d1to3,   percentage: pct(buckets.d1to3)    },
    { bucket: "4–7 days",    count: buckets.d4to7,   percentage: pct(buckets.d4to7)    },
    { bucket: "8–14 days",   count: buckets.w2,      percentage: pct(buckets.w2)       },
    { bucket: "15+ days",    count: buckets.w3plus,  percentage: pct(buckets.w3plus)   },
    { bucket: "Never",       count: buckets.never,   percentage: pct(buckets.never)    },
  ];

  res.status(200).json({ success: true, total, data });
});

// ══════════════════════════════════════════════
// 📊 OVERVIEW — all key metrics in one call
// ══════════════════════════════════════════════

export const getUserAnalyticsOverview = asyncHandler(async (req, res) => {
  const now_     = now();
  const today    = daysAgo(0);
  const last7    = daysAgo(7);
  const last30   = daysAgo(30);
  const last90   = daysAgo(90);

  const [result] = await User.aggregate([
    {
      $facet: {

        // ── Totals ────────────────────────────
        total:          [{ $count: "count" }],

        newToday:       [{ $match: { createdAt:          { $gte: today  } } }, { $count: "count" }],
        newLast7:       [{ $match: { createdAt:          { $gte: last7  } } }, { $count: "count" }],
        newLast30:      [{ $match: { createdAt:          { $gte: last30 } } }, { $count: "count" }],

        // ── Engagement ────────────────────────
        activeLast7:    [{ $match: { lastHomepageVisit:  { $gte: last7  } } }, { $count: "count" }],
        activeLast30:   [{ $match: { lastHomepageVisit:  { $gte: last30 } } }, { $count: "count" }],
        churned30:      [{ $match: { $or: [
                            { lastHomepageVisit: { $lt: last30 } },
                            { lastHomepageVisit: null },
                          ]}}, { $count: "count" }],

        // ── Profiles ──────────────────────────
        profileComplete:[{ $match: { "academicProfile.isCompleted": true  } }, { $count: "count" }],
        hasBio:         [{ $match: { bio:  { $ne: "", $ne: null }          } }, { $count: "count" }],
        hasAvatar:      [{ $match: { "avatar.secure_url": { $gt: "" }      } }, { $count: "count" }],

        // ── Study ─────────────────────────────
        studyingLast7:  [{ $match: { lastStudyDate: { $gte: last7 }        } }, { $count: "count" }],
        plannerAdopted: [{ $match: { "plannerSetup.isCompleted": true       } }, { $count: "count" }],

        // ── Paywall ───────────────────────────
        paidActive:     [{ $match: { "access.plan": { $ne: null }, "access.expiresAt": { $gt: now_ } } }, { $count: "count" }],

        // ── Roles ─────────────────────────────
        roleBreakdown: [
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $project: { role: "$_id", count: 1, _id: 0 } },
        ],

        // ── Auth Providers ────────────────────
        authBreakdown: [
          { $group: { _id: { $ifNull: ["$authProvider", "email"] }, count: { $sum: 1 } } },
          { $project: { provider: "$_id", count: 1, _id: 0 } },
        ],
      },
    },
  ]);

  const total = result.total[0]?.count ?? 0;
  const pct   = (n) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "0%");

  res.status(200).json({
    success: true,
    generatedAt: now_,
    overview: {
      // Totals
      totalUsers:     total,
      newToday:       result.newToday[0]?.count    ?? 0,
      newLast7Days:   result.newLast7[0]?.count    ?? 0,
      newLast30Days:  result.newLast30[0]?.count   ?? 0,

      // Engagement
      activeLast7Days:  result.activeLast7[0]?.count  ?? 0,
      activeLast30Days: result.activeLast30[0]?.count ?? 0,
      churnedUsers:     result.churned30[0]?.count    ?? 0,
      activeRate30:     pct(result.activeLast30[0]?.count ?? 0),
      churnRate30:      pct(result.churned30[0]?.count    ?? 0),

      // Profiles
      profileCompletion: {
        completed:  result.profileComplete[0]?.count ?? 0,
        rate:       pct(result.profileComplete[0]?.count ?? 0),
        hasBio:     result.hasBio[0]?.count   ?? 0,
        hasAvatar:  result.hasAvatar[0]?.count ?? 0,
      },

      // Study
      study: {
        activeStudiersLast7: result.studyingLast7[0]?.count  ?? 0,
        plannerAdopted:      result.plannerAdopted[0]?.count ?? 0,
        plannerAdoptionRate: pct(result.plannerAdopted[0]?.count ?? 0),
      },

      // Paywall
      access: {
        paidActive: result.paidActive[0]?.count ?? 0,
        paidRate:   pct(result.paidActive[0]?.count ?? 0),
      },

      // Breakdowns
      roleBreakdown: result.roleBreakdown,
      authBreakdown: result.authBreakdown,
    },
  });
});
