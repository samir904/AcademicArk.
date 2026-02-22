import HomepageSectionEvent    from "../MODELS/HomepageSectionEvent.model.js";
import HomepageAnalyticsSnapshot from "../MODELS/HomepageAnalyticsSnapshot.model.js";
import { EXCLUDED_ANALYTICS_USER_IDS } from "../CONSTANTS/analyticsConfig.js";

const SECTION_ORDER = [
  "continue_where", "study_material_today", "new_notes_badge",
  "quick_actions",  "recommended",          "trending",
  "attendance",     "downloads",            "leaderboard",
];

const HOUR_LABELS = [
  "12 AM","1 AM","2 AM","3 AM","4 AM","5 AM",
  "6 AM","7 AM","8 AM","9 AM","10 AM","11 AM",
  "12 PM","1 PM","2 PM","3 PM","4 PM","5 PM",
  "6 PM","7 PM","8 PM","9 PM","10 PM","11 PM",
];

// ─────────────────────────────────────────────
// 🔧 LIVE FALLBACK — used when no snapshots exist
// ─────────────────────────────────────────────
async function computeLiveAnalytics(since) {
  const [result] = await HomepageSectionEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id:              null,
        totalImpressions: { $sum: { $cond: [{ $eq: ["$eventType", "IMPRESSION"] }, 1, 0] } },
        totalClicks:      { $sum: { $cond: [{ $eq: ["$eventType", "CLICK"]      }, 1, 0] } },
        uniqueVisitorSet: { $addToSet: "$userId"    },
        uniqueSessionSet: { $addToSet: "$sessionId" }, // ✅ FIX 1 — track sessions
      },
    },
    {
      $project: {
        _id:              0,
        totalImpressions: 1,
        totalClicks:      1,
        uniqueVisitors:   { $size: "$uniqueVisitorSet" },
        totalVisits:      { $size: "$uniqueSessionSet" }, // ✅ FIX 1 — project totalVisits
      },
    },
  ]);

  const data = result || {
    totalImpressions: 0,
    totalClicks:      0,
    uniqueVisitors:   0,
    totalVisits:      0,
  };

  data.overallCTR = data.totalImpressions > 0
    ? parseFloat(((data.totalClicks / data.totalImpressions) * 100).toFixed(2))
    : 0;

  return data;
}

// ─────────────────────────────────────────────
// 📥 LOG EVENTS
// ─────────────────────────────────────────────
export const logHomepageEvent = async (req, res) => {
  try {
    const userId     = req.user.id;
    const { events } = req.body;

    if (!Array.isArray(events) || !events.length) {
      return res.status(400).json({ success: false, message: "No events" });
    }
// ✅ Silently skip dev/tester accounts — don't pollute analytics
    const isDevUser = EXCLUDED_ANALYTICS_USER_IDS
      .some((id) => id.equals(userId));

    if (isDevUser) {
      return res.status(200).json({ success: true, skipped: true });
    }
    const docs = events
      .filter(e => e.section && e.eventType)
      .map(e => ({
        userId,
        sessionId:  e.sessionId  || null,
        section:    e.section,
        eventType:  e.eventType,
        clickMeta:  e.clickMeta  || {},
        deviceType: e.deviceType || "DESKTOP",
        createdAt:  new Date(),
      }));

    if (docs.length) {
      HomepageSectionEvent.insertMany(docs, { ordered: false })
        .catch(err => console.error("Event insertMany error:", err));
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("logHomepageEvent error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 📊 OVERVIEW
// ─────────────────────────────────────────────
export const getHomepageAnalytics = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await HomepageAnalyticsSnapshot.find({
      generatedAt: { $gte: since },
    }).sort({ date: -1 }).lean();

    if (!snapshots.length) {
      const live = await computeLiveAnalytics(since);
      return res.status(200).json({ success: true, data: live, fromSnapshot: false });
    }

    const merged = snapshots.reduce((acc, snap) => {
      acc.totalImpressions += snap.overview?.totalImpressions ?? 0;
      acc.totalClicks      += snap.overview?.totalClicks      ?? 0;
      // ✅ visits = SUM across days (same user on 2 days = 2 visits — correct)
      acc.totalVisits      += snap.overview?.totalVisits      ?? 0;
      // ✅ uniqueVisitors = MAX across days (can't dedupe without re-query)
      acc.uniqueVisitors    = Math.max(acc.uniqueVisitors, snap.overview?.uniqueVisitors ?? 0);
      return acc;
    }, { totalImpressions: 0, totalClicks: 0, uniqueVisitors: 0, totalVisits: 0 });

    merged.overallCTR = merged.totalImpressions > 0
      ? parseFloat(((merged.totalClicks / merged.totalImpressions) * 100).toFixed(2))
      : 0;

    res.status(200).json({ success: true, data: merged, days, fromSnapshot: true });

  } catch (err) {
    console.error("getHomepageAnalytics error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 📋 SECTION CTR
// ─────────────────────────────────────────────
export const getHomepageCTRBySection = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const raw = await HomepageSectionEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id:   { section: "$section", eventType: "$eventType" },
          count: { $sum: 1 },
        },
      },
    ]);

    const sectionMap = {};
    raw.forEach(({ _id, count }) => {
      if (!sectionMap[_id.section])
        sectionMap[_id.section] = { impressions: 0, clicks: 0 };
      if (_id.eventType === "IMPRESSION") sectionMap[_id.section].impressions = count;
      if (_id.eventType === "CLICK")      sectionMap[_id.section].clicks      = count;
    });

    const sections = Object.entries(sectionMap)
      .map(([section, data]) => ({
        section,
        impressions: data.impressions,
        clicks:      data.clicks,
        ctr: data.impressions > 0
          ? parseFloat(((data.clicks / data.impressions) * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => b.ctr - a.ctr);

    res.status(200).json({ success: true, data: sections, days });

  } catch (err) {
    console.error("getHomepageCTRBySection error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 🏆 TOP CARDS
// ─────────────────────────────────────────────
export const getHomepageTopCards = async (req, res) => {
  try {
    const days  = parseInt(req.query.days)  || 7;
    const limit = parseInt(req.query.limit) || 10;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topCards = await HomepageSectionEvent.aggregate([
      {
        $match: {
          createdAt:                { $gte: since },
          eventType:                "CLICK",
          "clickMeta.resourceId":   { $ne: null },
          "clickMeta.resourceType": "NOTE",
        },
      },
      {
        $group: {
          _id:          "$clickMeta.resourceId",
          clicks:       { $sum: 1 },
          uniqueUsers:  { $addToSet: "$userId"  },
          sections:     { $addToSet: "$section" },
          topSection:   { $first:    "$section" },
          lastClickedAt:{ $max:      "$createdAt" },
          // ✅ Collect positions then avg in project — avoids $$REMOVE issues
          positions:    {
            $push: {
              $cond: [
                { $ne: ["$clickMeta.position", null] },
                "$clickMeta.position",
                "$$REMOVE",
              ],
            },
          },
        },
      },
      { $sort:  { clicks: -1 } },
      { $limit: limit },
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
          resourceId:    "$_id",
          clicks:        1,
          uniqueUsers:   { $size: "$uniqueUsers" },
          sections:      1,
          topSection:    1,
          lastClickedAt: 1,
          // ✅ Safe avg — only from collected non-null positions
          avgPosition: {
            $cond: [
              { $gt: [{ $size: "$positions" }, 0] },
              { $round: [{ $avg: "$positions" }, 1] },
              null,
            ],
          },
          title:    { $ifNull: ["$note.title",    "Deleted Note"] },
          subject:  { $ifNull: ["$note.subject",  "Unknown"]      },
          category: { $ifNull: ["$note.category", "Notes"]        },
        },
      },
    ]);

    const totalClicks = topCards.reduce((s, c) => s + c.clicks, 0);

    const ranked = topCards.map((card, i) => ({
      rank: i + 1,
      ...card,
      sharePct: totalClicks > 0
        ? Math.round((card.clicks / totalClicks) * 100)
        : 0,
    }));

    res.status(200).json({ success: true, data: ranked, days, totalClicks });

  } catch (err) {
    console.error("getHomepageTopCards error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 📱 DEVICES
// ─────────────────────────────────────────────
export const getHomepageDeviceBreakdown = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const raw = await HomepageSectionEvent.aggregate([
      { $match: { createdAt: { $gte: since }, eventType: "IMPRESSION" } },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
    ]);

    const counts = { MOBILE: 0, TABLET: 0, DESKTOP: 0 };
    raw.forEach(d => { if (d._id) counts[d._id] = d.count; });

    const total     = Object.values(counts).reduce((a, b) => a + b, 0);
    const breakdown = Object.entries(counts).map(([device, count]) => ({
      device,
      count,
      percentage: total > 0
        ? parseFloat(((count / total) * 100).toFixed(1))
        : 0,
    }));

    res.status(200).json({ success: true, data: breakdown, total, days });

  } catch (err) {
    console.error("getHomepageDeviceBreakdown error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 📈 DAILY TREND
// ─────────────────────────────────────────────
export const getHomepageDailyTrend = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await HomepageAnalyticsSnapshot.find({
      generatedAt: { $gte: since },
    }).sort({ date: 1 }).select("date overview").lean();

    if (snapshots.length) {
      const trend = snapshots.map(s => ({
        date:        s.date,
        impressions: s.overview?.totalImpressions ?? 0,
        clicks:      s.overview?.totalClicks      ?? 0,
        ctr:         s.overview?.overallCTR       ?? 0,
        visitors:    s.overview?.uniqueVisitors   ?? 0,
        visits:      s.overview?.totalVisits      ?? 0, // ✅ include visits
      }));
      return res.status(200).json({ success: true, data: trend, fromSnapshot: true });
    }

    // ── Fallback live
    const raw = await HomepageSectionEvent.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date:      { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
            eventType: "$eventType",
          },
          count:           { $sum: 1 },
          uniqueUserSet:   { $addToSet: "$userId"    },
          uniqueSessionSet:{ $addToSet: "$sessionId" }, // ✅ FIX
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const dateMap = {};
    raw.forEach(({ _id, count, uniqueUserSet, uniqueSessionSet }) => {
      if (!dateMap[_id.date])
        dateMap[_id.date] = { impressions: 0, clicks: 0, visitors: 0, visits: 0 };
      if (_id.eventType === "IMPRESSION") {
        dateMap[_id.date].impressions = count;
        dateMap[_id.date].visitors    = uniqueUserSet.length;
        dateMap[_id.date].visits      = uniqueSessionSet.length; // ✅ FIX
      }
      if (_id.eventType === "CLICK")
        dateMap[_id.date].clicks = count;
    });

    const trend = Object.entries(dateMap).map(([date, data]) => ({
      date,
      impressions: data.impressions,
      clicks:      data.clicks,
      visitors:    data.visitors,
      visits:      data.visits,
      ctr: data.impressions > 0
        ? parseFloat(((data.clicks / data.impressions) * 100).toFixed(2))
        : 0,
    }));

    res.status(200).json({ success: true, data: trend, fromSnapshot: false });

  } catch (err) {
    console.error("getHomepageDailyTrend error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// 🪜 DROPOFF FUNNEL
// ─────────────────────────────────────────────
export const getHomepageSectionDropoff = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const raw = await HomepageSectionEvent.aggregate([
      { $match: { createdAt: { $gte: since }, eventType: "IMPRESSION" } },
      { $group: { _id: "$section", impressions: { $sum: 1 } } },
    ]);

    const impressionMap = {};
    raw.forEach(r => { impressionMap[r._id] = r.impressions; });

    const baseline =
      impressionMap["continue_where"]      ||
      impressionMap["study_material_today"] ||
      Math.max(...Object.values(impressionMap), 1);

    const dropoff = SECTION_ORDER
      .filter(s  => impressionMap[s] !== undefined)
      .map((section, i) => ({
        position:    i + 1,
        section,
        impressions: impressionMap[section] || 0,
        dropoffPct:  parseFloat(
          (((impressionMap[section] || 0) / baseline) * 100).toFixed(1)
        ),
      }));

    res.status(200).json({ success: true, data: dropoff, days });

  } catch (err) {
    console.error("getHomepageSectionDropoff error:", err);
    res.status(500).json({ success: false });
  }
};

// ─────────────────────────────────────────────
// ⏰ PEAK TIMES
// ─────────────────────────────────────────────
export const getHomepagePeakTimes = async (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [hourlyData, dailyData, weekdayData] = await Promise.all([

      // ✅ FIX 3 — removed eventType filter so CLICK + IMPRESSION both count
      // OR keep IMPRESSION only but remove the broken $cond for clicks
      HomepageSectionEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: "IMPRESSION" } },
        {
          $group: {
            _id:         { hour: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } } },
            count:       { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
        { $sort: { "_id.hour": 1 } },
      ]),

      HomepageSectionEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: "IMPRESSION" } },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format:   "%Y-%m-%d",
                  date:     "$createdAt",
                  timezone: "Asia/Kolkata",
                },
              },
            },
            count:       { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      HomepageSectionEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: "IMPRESSION" } },
        {
          $group: {
            _id: {
              weekday: { $dayOfWeek: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            },
            count:       { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
        { $sort: { "_id.weekday": 1 } },
      ]),
    ]);

    // ── Format hourly
    const hourMap = {};
    hourlyData.forEach(h => { hourMap[h._id.hour] = h; });

    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour:        i,
      label:       HOUR_LABELS[i],
      impressions: hourMap[i]?.count               || 0,
      uniqueUsers: hourMap[i]?.uniqueUsers?.length || 0,
    }));

    const peakHour = hourly.reduce((max, h) =>
      h.impressions > max.impressions ? h : max, hourly[0]
    );

    // ── Format weekday
    const WEEKDAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const weekdayMap = {};
    weekdayData.forEach(w => {
      const idx = w._id.weekday - 1; // MongoDB 1=Sun → index 0
      weekdayMap[idx] = w;
    });

    const weekdays = Array.from({ length: 7 }, (_, i) => ({
      day:         i,
      label:       WEEKDAY_LABELS[i],
      impressions: weekdayMap[i]?.count               || 0,
      uniqueUsers: weekdayMap[i]?.uniqueUsers?.length || 0,
    }));

    const peakWeekday = weekdays.reduce((max, d) =>
      d.impressions > max.impressions ? d : max, weekdays[0]
    );

    // ── Format daily
    const daily = dailyData.map(d => ({
      date:        d._id.date,
      impressions: d.count,
      uniqueUsers: d.uniqueUsers.length,
    }));

    // ── Slot totals
    const slotTotals = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    hourly.forEach(({ hour, impressions }) => {
      if      (hour >= 5  && hour <= 11) slotTotals.morning   += impressions;
      else if (hour >= 12 && hour <= 16) slotTotals.afternoon += impressions;
      else if (hour >= 17 && hour <= 20) slotTotals.evening   += impressions;
      else                               slotTotals.night     += impressions;
    });

    const peakSlot = Object.entries(slotTotals)
      .sort((a, b) => b[1] - a[1])[0][0];

    res.status(200).json({
      success: true,
      days,
      data: {
        hourly,
        weekdays,
        daily,
        peakHour:    { hour: peakHour.hour,    label: peakHour.label,    impressions: peakHour.impressions    },
        peakWeekday: { day:  peakWeekday.day,   label: peakWeekday.label, impressions: peakWeekday.impressions },
        peakSlot,
        slotTotals,
        insight: buildPeakInsight(peakHour, peakWeekday, peakSlot),
      },
    });

  } catch (err) {
    console.error("getHomepagePeakTimes error:", err);
    res.status(500).json({ success: false });
  }
};

function buildPeakInsight(peakHour, peakWeekday, peakSlot) {
  const WEEKDAY_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return `Most students visit on ${WEEKDAY_FULL[peakWeekday.day]}s `
    + `during ${peakSlot} hours (peak at ${peakHour.label} IST).`;
}

// ─────────────────────────────────────────────
// ⚙️ GENERATE DAILY SNAPSHOT
// ─────────────────────────────────────────────
export const generateDailySnapshot = async () => {
  try {
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr  = today.toISOString().split("T")[0];

    const [sectionStats, topCards, deviceStats, overviewRaw, peakHours] =
      await Promise.all([

        HomepageSectionEvent.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: { section: "$section", eventType: "$eventType" }, count: { $sum: 1 } } },
        ]),

        HomepageSectionEvent.aggregate([
          {
            $match: {
              createdAt:              { $gte: today, $lt: tomorrow },
              eventType:              "CLICK",
              "clickMeta.resourceId": { $ne: null },
            },
          },
          { $group: { _id: "$clickMeta.resourceId", clicks: { $sum: 1 } } },
          { $sort:  { clicks: -1 } },
          { $limit: 10 },
          { $lookup: { from: "notes", localField: "_id", foreignField: "_id", as: "note" } },
          { $unwind: { path: "$note", preserveNullAndEmptyArrays: true } },
          { $project: { resourceId: "$_id", title: "$note.title", clicks: 1 } },
        ]),

        HomepageSectionEvent.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow }, eventType: "IMPRESSION" } },
          { $group: { _id: "$deviceType", count: { $sum: 1 } } },
        ]),

        // ✅ FIX 2 — add uniqueSessionSet for totalVisits
        HomepageSectionEvent.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          {
            $group: {
              _id:              null,
              totalImpressions: { $sum: { $cond: [{ $eq: ["$eventType", "IMPRESSION"] }, 1, 0] } },
              totalClicks:      { $sum: { $cond: [{ $eq: ["$eventType", "CLICK"]      }, 1, 0] } },
              uniqueVisitorSet: { $addToSet: "$userId"    },
              uniqueSessionSet: { $addToSet: "$sessionId" }, // ✅ FIX
            },
          },
          {
            $project: {
              _id:              0,
              totalImpressions: 1,
              totalClicks:      1,
              uniqueVisitors:   { $size: "$uniqueVisitorSet" },
              totalVisits:      { $size: "$uniqueSessionSet" }, // ✅ FIX
              overallCTR: {
                $cond: [
                  { $gt: ["$totalImpressions", 0] },
                  { $round: [{ $multiply: [{ $divide: ["$totalClicks", "$totalImpressions"] }, 100] }, 2] },
                  0,
                ],
              },
            },
          },
        ]),

        HomepageSectionEvent.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow }, eventType: "IMPRESSION" } },
          {
            $group: {
              _id:   { hour: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } } },
              count: { $sum: 1 },
            },
          },
          { $sort:  { count: -1 } },
          { $limit: 3 },
        ]),
      ]);

    // ── Build sections
    const sectionMap = {};
    sectionStats.forEach(({ _id, count }) => {
      if (!sectionMap[_id.section])
        sectionMap[_id.section] = { impressions: 0, clicks: 0 };
      if (_id.eventType === "IMPRESSION") sectionMap[_id.section].impressions = count;
      if (_id.eventType === "CLICK")      sectionMap[_id.section].clicks      = count;
    });

    const sections = Object.entries(sectionMap)
      .map(([section, data]) => ({
        section,
        impressions: data.impressions,
        clicks:      data.clicks,
        ctr: data.impressions > 0
          ? parseFloat(((data.clicks / data.impressions) * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => b.ctr - a.ctr);

    // ── Device breakdown
    const deviceBreakdown = { mobile: 0, tablet: 0, desktop: 0 };
    deviceStats.forEach(d => {
      if (d._id) deviceBreakdown[d._id.toLowerCase()] = d.count;
    });

    // ── Peak hours
    const topPeakHours = peakHours.map(h => ({
      hour:  h._id.hour,
      label: HOUR_LABELS[h._id.hour],
      count: h.count,
    }));

    const overview = overviewRaw[0] || {
      totalImpressions: 0,
      totalClicks:      0,
      uniqueVisitors:   0,
      totalVisits:      0,  // ✅ FIX
      overallCTR:       0,
    };

    await HomepageAnalyticsSnapshot.findOneAndUpdate(
      { date: dateStr },
      {
        date:            dateStr,
        overview,        // ✅ now includes totalVisits
        sections,
        topClickedCards: topCards,
        deviceBreakdown,
        topPeakHours,
        generatedAt:     new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Homepage snapshot generated for ${dateStr}`, {
      impressions: overview.totalImpressions,
      clicks:      overview.totalClicks,
      visits:      overview.totalVisits,   // ✅ now logs correctly
      visitors:    overview.uniqueVisitors,
    });

  } catch (err) {
    console.error("generateDailySnapshot error:", err);
  }
};

// ─────────────────────────────────────────────
// 🎯 CTA BREAKDOWN — ✅ FIX 4: added try/catch
// ─────────────────────────────────────────────
export const getCTABreakdown = async (req, res) => {
  try {                                            // ✅ FIX 4
    const days  = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await HomepageSectionEvent.aggregate([
      {
        $match: {
          eventType:            "CLICK",
          createdAt:            { $gte: since },
          "clickMeta.ctaLabel": { $ne: null, $exists: true },
        },
      },
      {
        $group: {
          _id:         { section: "$section", ctaLabel: "$clickMeta.ctaLabel" },
          clicks:      { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id:         0,
          section:     "$_id.section",
          ctaLabel:    "$_id.ctaLabel",
          clicks:      1,
          uniqueUsers: { $size: "$uniqueUsers" },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    const grouped = data.reduce((acc, row) => {
      if (!acc[row.section]) acc[row.section] = [];
      acc[row.section].push({
        ctaLabel:    row.ctaLabel,
        clicks:      row.clicks,
        uniqueUsers: row.uniqueUsers,
      });
      return acc;
    }, {});

    res.status(200).json({ success: true, days, data: { flat: data, grouped } });

  } catch (err) {                                  // ✅ FIX 4
    console.error("getCTABreakdown error:", err);
    res.status(500).json({ success: false });
  }
};
