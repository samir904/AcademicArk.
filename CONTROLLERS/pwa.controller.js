// CONTROLLERS/pwa.controller.js
import PWAInstall from "../MODELS/PWAInstall.model.js";
import AppError from "../UTIL/error.util.js";

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────

// Build the find filter — prefer userId, fallback to fingerprint

// ✅ Always fingerprint — userId is just metadata saved alongside
const buildFilter = (fingerprint) => {
  if (!fingerprint) return null;
  return { fingerprint };   // device-level, always
};

// ✅ Extra fields to always merge when user is logged in
const userMeta = (req, fingerprint) => ({
  ...(req.user?.id && { user: req.user.id }),   // link user when known
  fingerprint,
});
// Short UA slice for storage
const shortUA = (ua = "") => ua.slice(0, 120);

// ────────────────────────────────────────────────────────────────────
// 1. RECORD PROMPT SHOWN
//    Called when the install modal becomes visible to the user
// ────────────────────────────────────────────────────────────────────
// ── 1. recordPromptShown — ADD deviceType ──────────────────────────
export const recordPromptShown = async (req, res, next) => {
  try {
    const {
      fingerprint,
      platform = "unknown",
      deviceType = "unknown",    // ✅ ADD
      browser,
      userAgent,                 // ✅ ADD
      entryPage,
    } = req.body;

    const filter = buildFilter(fingerprint);
    if (!filter) return res.status(200).json({ success: true });

    await PWAInstall.findOneAndUpdate(
      filter,
      {
        $set: {
          promptShownAt: new Date(),
          platform,
          deviceType,            // ✅ NOW SAVED
          browser: shortUA(browser),
          userAgent: shortUA(userAgent || ""),  // ✅ NOW SAVED
          entryPage,
          ...(req.user?.id && { user: req.user.id }),
        },
        $inc: { promptCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// ────────────────────────────────────────────────────────────────────
// 2. RECORD PROMPT ACTION
//    Called when user clicks Install / Not Now / ignores
// ────────────────────────────────────────────────────────────────────
export const recordPromptAction = async (req, res, next) => {
  try {
    const { action, fingerprint } = req.body;
    // action = 'installed' | 'dismissed' | 'ignored'

    if (!["installed", "dismissed", "ignored"].includes(action)) {
      return next(new AppError("Invalid action", 400));
    }

    const filter = buildFilter(fingerprint);
    if (!filter) return res.status(200).json({ success: true });

    // On dismiss → set 7-day cooldown
    const nextPromptAt = action === "dismissed"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null;

    const update = {
      $set: {
        promptAction: action,
        actionAt: new Date(),
        ...(nextPromptAt && { nextPromptAt }),
        ...(req.user?.id && { user: req.user.id }),
        ...(fingerprint && { fingerprint }),
        // If native prompt accepted, also mark installed here
        ...(action === "installed" && {
          isInstalled: true,
          installedAt: new Date(),
        }),
      },
    };

    await PWAInstall.findOneAndUpdate(filter, update, {
      upsert: true, new: true, setDefaultsOnInsert: true,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ────────────────────────────────────────────────────────────────────
// 3. RECORD INSTALL
//    Called by the browser's `appinstalled` event — most reliable signal
// ────────────────────────────────────────────────────────────────────
// ── 2. recordInstall — ADD deviceType ─────────────────────────────
export const recordInstall = async (req, res, next) => {
  try {
    const {
      fingerprint,
      platform = "unknown",
      deviceType = "unknown",    // ✅ ADD
      browser,
      userAgent,                 // ✅ ADD
    } = req.body;

    const filter = buildFilter(fingerprint);
    if (!filter) return res.status(200).json({ success: true });

    await PWAInstall.findOneAndUpdate(
      filter,
      {
        $set: {
          isInstalled: true,
          installedAt: new Date(),
          promptAction: "installed",
          actionAt: new Date(),
          platform,
          deviceType,            // ✅ NOW SAVED
          browser: shortUA(browser),
          userAgent: shortUA(userAgent || ""),  // ✅ NOW SAVED
          ...(req.user?.id && { user: req.user.id }),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ────────────────────────────────────────────────────────────────────
// 4. RECORD SESSION
//    Called on app load — tells us if user is in browser or installed PWA
//    Header: X-Client-Mode: 'pwa' | 'browser'  (set by axios interceptor)
// ────────────────────────────────────────────────────────────────────
// CONTROLLERS/pwa.controller.js
// ── 3. recordSession — ADD ALL device fields ───────────────────────
// CONTROLLERS/pwa.controller.js — recordSession

export const recordSession = async (req, res, next) => {
  try {
    const {
      fingerprint,
      entryPage,
      sessionDurationSeconds = 0,
      platform = "unknown",
      deviceType = "unknown",
      browser,
      userAgent,
      clientMode = "browser",        // ✅ now from body, not header
    } = req.body;

    // ✅ read from body — header fallback kept for Postman testing
    const mode = clientMode || req.headers["x-client-mode"] || "browser";
    const source = mode === "pwa" ? "installed_pwa" : "browser";

    const filter = buildFilter(fingerprint);
    if (!filter) return res.status(200).json({ success: true });

    const existing = await PWAInstall.findOne(filter).lean();

    const wentBack =
      existing?.isInstalled &&
      existing?.lastSeenAs === "installed_pwa" &&
      source === "browser";

    const prevAvg = existing?.avgSessionDurationSeconds || 0;
    const prevCount = existing?.pwaSessionCount || 0;
    const newAvg = source === "installed_pwa" && sessionDurationSeconds > 0
      ? Math.round((prevAvg * prevCount + sessionDurationSeconds) / (prevCount + 1))
      : prevAvg;

    // CONTROLLERS/pwa.controller.js — recordSession

    // CONTROLLERS/pwa.controller.js — recordSession

    await PWAInstall.findOneAndUpdate(
      filter,
      {
        $set: {
          lastSeenAs: source,
          lastActiveAt: new Date(),
          lastEntryPage: entryPage,
          avgSessionDurationSeconds: newAvg,
          lastSessionDurationSeconds: sessionDurationSeconds,
          platform,
          deviceType,
          browser: shortUA(browser || ""),
          userAgent: shortUA(userAgent || ""),
          ...(wentBack && { wentBackToBrowser: true, wentBackAt: new Date() }),
          ...(req.user?.id && { user: req.user.id }),
          ...(!existing?.firstSeenAt && { firstSeenAt: new Date() }),
          ...(source === "installed_pwa" && !existing?.firstPWAOpenAt && {
            firstPWAOpenAt: new Date(),
          }),
          // ✅ KEY FIX: Track last PWA open time separately — never overwritten by browser
          ...(source === "installed_pwa" && {
            lastPWAActiveAt: new Date(),
          }),
        },
        ...(entryPage && {
          $push: {
            lastSeenPages: {
              $each: [{ page: entryPage, seenAt: new Date(), mode: source }],
              $slice: -15,
            },
          },
        }),
        ...(source === "installed_pwa" && {
          $inc: { pwaSessionCount: 1, totalPageViews: 1 },
        }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );


    res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// CONTROLLERS/pwa.controller.js — ADD this new function at the bottom

// ────────────────────────────────────────────────────────────────────
// 7. RECORD PAGE VIEW
//    Called on every React Router navigation — tracks pages visited
// ────────────────────────────────────────────────────────────────────
export const recordPageView = async (req, res, next) => {
  try {
    const { fingerprint, page, clientMode = "browser" } = req.body;

    const filter = buildFilter(fingerprint);
    if (!filter) return res.status(200).json({ success: true });

    const source = clientMode === "pwa" ? "installed_pwa" : "browser";

    await PWAInstall.findOneAndUpdate(
      filter,
      {
        $set: { lastEntryPage: page, lastActiveAt: new Date() },
        $push: {
          lastSeenPages: {
            $each: [{ page, seenAt: new Date(), mode: source }],
            $slice: -15,    // keep last 15 page visits
          },
        },
        ...(source === "installed_pwa" && {
          $inc: { totalPageViews: 1 },
        }),
      },
      { upsert: false }    // ✅ don't create — only update existing records
    );

    res.status(200).json({ success: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ────────────────────────────────────────────────────────────────────
// 5. CHECK SHOULD PROMPT
//    Frontend calls this to ask: "should I show the modal right now?"
//    Respects 7-day cooldown stored in DB (in case localStorage cleared)
// ────────────────────────────────────────────────────────────────────
// ✅ Now device-aware — checks THIS device's record only
export const checkShouldPrompt = async (req, res, next) => {
  try {
    const fingerprint = req.query.fingerprint;
    if (!fingerprint) return res.json({ shouldPrompt: true });

    const record = await PWAInstall.findOne({ fingerprint }).lean();

    if (!record) return res.json({ shouldPrompt: true });
    if (record.isInstalled) return res.json({ shouldPrompt: false }); // THIS device installed

    if (record.nextPromptAt && new Date() < new Date(record.nextPromptAt)) {
      return res.json({
        shouldPrompt: false,
        nextPromptAt: record.nextPromptAt,
      });
    }

    return res.json({ shouldPrompt: true });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// ────────────────────────────────────────────────────────────────────
// 6. GET INSTALL STATS  (admin only)
// ────────────────────────────────────────────────────────────────────
export const getInstallStats = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      summary,
      todayStats,
      retentionStats,
      byPlatform,
      byDeviceType,
      userInstallCoverage,
      topEntryPages,
      recentInstalls,
      dailyInstalls,
      hourlyToday,
    ] = await Promise.all([

      // ── 1. Overall summary ────────────────────────────────────────
      // ── 1. Overall summary ─────────────────────────────────────────────
PWAInstall.aggregate([
  {
    $group: {
      _id:              null,
      totalDevices:     { $sum: 1 },
      totalPrompted:    { $sum: { $cond: [{ $gt:  ["$promptCount",  0] }, 1, 0] } },
      totalInstalled:   { $sum: { $cond: ["$isInstalled", 1, 0] } },
      totalDismissed:   { $sum: { $cond: [{ $eq: ["$promptAction", "dismissed"] }, 1, 0] } },
      totalIgnored:     { $sum: { $cond: [{ $eq: ["$promptAction", "ignored"]   }, 1, 0] } },
      totalPWASessions: { $sum: "$pwaSessionCount" },
      avgSessionSecs:   { $avg: "$avgSessionDurationSeconds" },
      wentBackCount:    { $sum: { $cond: ["$wentBackToBrowser", 1, 0] } },
      // ✅ ADD — devices that actually opened as PWA at least once
      totalPWAUsers:    { $sum: { $cond: [{ $gt: ["$pwaSessionCount", 0] }, 1, 0] } },
    },
  },
]),


      // ── 2. TODAY — opened app / installs / new users ──────────────
      PWAInstall.aggregate([
        {
          $facet: {
            // PWA opens today (lastActiveAt >= today AND source = pwa)
            openedTodayPWA: [
              {
                $match: {
                  pwaSessionCount: { $gt: 0 },
                  lastPWAActiveAt: { $gte: todayStart },  // ✅ FIX
                },
              },
              { $count: "count" },
            ],
            // Browser opens today
            openedTodayBrowser: [
              {
                $match: {
                  lastSeenAs: "browser",
                  lastActiveAt: { $gte: todayStart },
                },
              },
              { $count: "count" },
            ],
            // New installs today
            installedToday: [
              {
                $match: { installedAt: { $gte: todayStart } },
              },
              { $count: "count" },
            ],
            // Prompts shown today
            promptsToday: [
              {
                $match: { promptShownAt: { $gte: todayStart } },
              },
              { $count: "count" },
            ],
          },
        },
      ]),

      // ── 3. Retention — DAU / WAU / MAU ───────────────────────────
      PWAInstall.aggregate([
        {
          $facet: {
            dau: [
              {
                $match: {
                  // ✅ FIX: lastPWAActiveAt — not lastSeenAs
                  // User may have gone back to browser but still opened PWA today
                  pwaSessionCount: { $gt: 0 },
                  lastPWAActiveAt: { $gte: todayStart },
                },
              },
              { $count: "count" },
            ],
            wau: [
              {
                $match: {
                  pwaSessionCount: { $gt: 0 },
                  lastPWAActiveAt: { $gte: weekAgo },  // ✅ FIX
                },
              },
              { $count: "count" },
            ],
            mau: [
              {
                $match: {
                  pwaSessionCount: { $gt: 0 },
                  lastPWAActiveAt: { $gte: monthAgo },  // ✅ FIX
                },
              },
              { $count: "count" },
            ],
          // getInstallStats — Fix inactive30d match

inactive30d: [
  {
    $match: {
      isInstalled:     true,
      pwaSessionCount: { $gt: 0 },        // ✅ MUST have opened as PWA before
      lastPWAActiveAt: { $lt: monthAgo }, // ✅ AND not opened in 30d
      // Remove the $or with null — null means never opened, not inactive
    },
  },
  { $count: "count" },
],

            newThisWeek: [
              { $match: { installedAt: { $gte: weekAgo } } },
              { $count: "count" },
            ],
          },
        },
      ]),
      // ── 4. By platform ─────────────────────────────────────────────
      PWAInstall.aggregate([
        { $match: { isInstalled: true } },
        {
          $group: {
            _id: "$platform",
            installs: { $sum: 1 },
            activeLast7d: {
  $sum: {
    $cond: [{ $gte: ["$lastPWAActiveAt", weekAgo] }, 1, 0]  // ✅ FIX
  }
},
            avgSessions: { $avg: "$pwaSessionCount" },
            avgSessionSecs: { $avg: "$avgSessionDurationSeconds" },
          },
        },
        { $sort: { installs: -1 } },
      ]),

      // ── 5. Mobile vs Desktop vs Tablet ─────────────────────────────
      PWAInstall.aggregate([
        { $match: { isInstalled: true } },
        {
          $group: {
            _id: "$deviceType",
            installs: { $sum: 1 },
           activeToday: {
  $sum: {
    $cond: [{ $gte: ["$lastPWAActiveAt", todayStart] }, 1, 0]  // ✅ FIX
  }
},
            activeLast7d: {
  $sum: {
    $cond: [{ $gte: ["$lastPWAActiveAt", weekAgo] }, 1, 0]  // ✅ FIX
  }
},
            avgSessions: { $avg: "$pwaSessionCount" },
          },
        },
        { $sort: { installs: -1 } },
      ]),

      // ── 6. Users installed on 2+ devices ───────────────────────────
      PWAInstall.aggregate([
        { $match: { isInstalled: true, user: { $ne: null } } },
        {
          $group: {
            _id: "$user",
            devices: { $addToSet: "$deviceType" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            usersOnBothDevices: {
              $sum: { $cond: [{ $gt: ["$count", 1] }, 1, 0] }
            },
            usersOnOneDevice: {
              $sum: { $cond: [{ $eq: ["$count", 1] }, 1, 0] }
            },
          },
        },
      ]),

      // ── 7. Top entry pages (where users come from) ─────────────────
      PWAInstall.aggregate([
        { $match: { entryPage: { $ne: null } } },
        { $group: { _id: "$entryPage", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),

      // ── 8. Last 10 installs ────────────────────────────────────────
      PWAInstall.find({ isInstalled: true })
        .sort({ installedAt: -1 })
        .limit(10)
        .populate("user", "name email avatar")
        .select("user fingerprint platform deviceType browser installedAt pwaSessionCount lastSeenAs lastActiveAt avgSessionDurationSeconds")
        .lean(),

      // ── 9. Daily installs — last 30 days by deviceType ─────────────
      PWAInstall.aggregate([
        { $match: { installedAt: { $gte: monthAgo } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$installedAt" } },
              deviceType: "$deviceType",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // ── 10. Hourly PWA opens today (for "opens today" chart) ────────
      PWAInstall.aggregate([
        {
          $match: {
            pwaSessionCount: { $gt: 0 },
            lastPWAActiveAt: { $gte: todayStart },  // ✅ FIX
          },
        },
        {
          $group: {
            _id: { $hour: "$lastPWAActiveAt" },   // ✅ FIX: hour of last PWA open
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // ── Shape response ──────────────────────────────────────────────
    const s = summary[0] || {};
    const t = todayStats[0] || {};
    const ret = retentionStats[0] || {};

    const extract = (facetArr) => facetArr?.[0]?.count || 0;

    const totalInstalled = s.totalInstalled || 0;
    const totalPrompted = s.totalPrompted || 0;

    res.status(200).json({
      success: true,
      data: {

        // ── Today ──────────────────────────────────────────────────
        today: {
          openedAsPWA: extract(t.openedTodayPWA),
          openedAsBrowser: extract(t.openedTodayBrowser),
          newInstalls: extract(t.installedToday),
          promptsShown: extract(t.promptsToday),
        },

        // ── Retention ──────────────────────────────────────────────
        retention: {
          dau: extract(ret.dau),          // opened PWA today
          wau: extract(ret.wau),          // opened PWA last 7d
          mau: extract(ret.mau),          // opened PWA last 30d
          dauWauRatio: ret.wau?.[0]?.count
            ? ((extract(ret.dau) / extract(ret.wau)) * 100).toFixed(1) + "%"
            : "0%",
          newThisWeek: extract(ret.newThisWeek),
          inactive30d: extract(ret.inactive30d),  // likely uninstalled
        },

        // ── Overall ────────────────────────────────────────────────
        // getInstallStats — Shape response section

// ── Overall ────────────────────────────────────────────────────────
summary: {
  ...s,
  conversionRate: totalPrompted
    ? ((totalInstalled / totalPrompted) * 100).toFixed(1) + "%"
    : "0%",
  avgSessionMins: s.avgSessionSecs
    ? (s.avgSessionSecs / 60).toFixed(1)
    : "0",
  // ✅ FIX: only devices that opened as PWA can "uninstall"
  uninstallRate: s.totalPWAUsers      // devices with pwaSessionCount > 0
    ? ((extract(ret.inactive30d) / s.totalPWAUsers) * 100).toFixed(1) + "%"
    : "0%",
},

        byPlatform,
        byDeviceType,
        userInstallCoverage: userInstallCoverage[0] || {},
        topEntryPages,
        recentInstalls,
        dailyInstalls,
        hourlyToday,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// CONTROLLERS/pwa.controller.js — ADD at the bottom

// ────────────────────────────────────────────────────────────────────
// 8. GET USER PWA PROFILE  (logged-in user sees their own data)
//    GET /pwa/me
// ────────────────────────────────────────────────────────────────────
export const getUserPWAProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const fingerprint = req.query.fingerprint;

    // ── Build query — prefer userId if logged in, fallback to fingerprint
    const query = userId
      ? { user: userId }
      : fingerprint
        ? { fingerprint }
        : null;

    if (!query) return res.status(200).json({ success: true, data: null });

    // ── Fetch ALL devices for this user ─────────────────────────────
    const devices = await PWAInstall.find(query)
      .sort({ lastActiveAt: -1 })
      .lean();

    if (!devices.length) {
      return res.status(200).json({ success: true, data: null });
    }

    // ── Aggregate across all user's devices ─────────────────────────
    const totalPWASessions = devices.reduce((s, d) => s + (d.pwaSessionCount || 0), 0);
    const totalPageViews = devices.reduce((s, d) => s + (d.totalPageViews || 0), 0);
    const installedDevices = devices.filter(d => d.isInstalled);
    const activeDevices = devices.filter(d =>
      d.lastActiveAt && new Date() - new Date(d.lastActiveAt) < 7 * 24 * 60 * 60 * 1000
    );

    // ── Most visited pages across all devices ───────────────────────
    const pageFreq = {};
    for (const device of devices) {
      for (const entry of (device.lastSeenPages || [])) {
        if (!entry.page) continue;
        pageFreq[entry.page] = (pageFreq[entry.page] || 0) + 1;
      }
    }
    const topPages = Object.entries(pageFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([page, count]) => ({ page, count }));

    // ── Session duration stats ───────────────────────────────────────
    const sessionDurations = devices
      .filter(d => d.avgSessionDurationSeconds > 0)
      .map(d => d.avgSessionDurationSeconds);

    const avgSessionSecs = sessionDurations.length
      ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
      : 0;

    // ── Engagement score (0-100) ─────────────────────────────────────
    // Weighted: sessions (40%) + pageviews (30%) + recency (20%) + devices (10%)
    const sessionScore = Math.min(totalPWASessions / 20, 1) * 40;
    const pageScore = Math.min(totalPageViews / 50, 1) * 30;
    const deviceScore = Math.min(installedDevices.length / 3, 1) * 10;
    const daysSinceLast = devices[0]?.lastActiveAt
      ? (Date.now() - new Date(devices[0].lastActiveAt)) / (24 * 60 * 60 * 1000)
      : 30;
    const recencyScore = Math.max(0, 1 - daysSinceLast / 30) * 20;
    const engagementScore = Math.round(sessionScore + pageScore + deviceScore + recencyScore);

    // ── Device breakdown ─────────────────────────────────────────────
    const devicesFormatted = devices.map(d => ({
      fingerprint: d.fingerprint,
      platform: d.platform,
      deviceType: d.deviceType,
      browser: d.browser,
      isInstalled: d.isInstalled,
      installedAt: d.installedAt,
      lastSeenAs: d.lastSeenAs,
      lastActiveAt: d.lastActiveAt,
      pwaSessionCount: d.pwaSessionCount,
      totalPageViews: d.totalPageViews,
      avgSessionDurationSeconds: d.avgSessionDurationSeconds,
      lastSessionDurationSeconds: d.lastSessionDurationSeconds,
      wentBackToBrowser: d.wentBackToBrowser,
      wentBackAt: d.wentBackAt,
      firstSeenAt: d.firstSeenAt,
      firstPWAOpenAt: d.firstPWAOpenAt,
      recentPages: (d.lastSeenPages || []).slice(-5), // last 5 pages per device
    }));

    // ── User journey timeline (merged across all devices) ───────────
    const allPageEvents = devices
      .flatMap(d => (d.lastSeenPages || []).map(p => ({
        ...p,
        deviceType: d.deviceType,
        platform: d.platform,
      })))
      .sort((a, b) => new Date(b.seenAt) - new Date(a.seenAt))
      .slice(0, 20);  // last 20 events across all devices

    res.status(200).json({
      success: true,
      data: {
        // ── Overview ──────────────────────────────────────────────
        overview: {
          totalDevices: devices.length,
          installedDevices: installedDevices.length,
          activeDevicesLast7d: activeDevices.length,
          totalPWASessions,
          totalPageViews,
          avgSessionMins: (avgSessionSecs / 60).toFixed(1),
          engagementScore,     // 0-100
          firstSeenAt: devices.reduce((min, d) =>
            d.firstSeenAt && (!min || d.firstSeenAt < min) ? d.firstSeenAt : min, null),
          firstPWAOpenAt: devices.reduce((min, d) =>
            d.firstPWAOpenAt && (!min || d.firstPWAOpenAt < min) ? d.firstPWAOpenAt : min, null),
          lastActiveAt: devices[0]?.lastActiveAt || null,
          lastSeenAs: devices[0]?.lastSeenAs || null,
          wentBackToBrowser: devices.some(d => d.wentBackToBrowser),
        },

        // ── Per-device breakdown ───────────────────────────────────
        devices: devicesFormatted,

        // ── Content behavior ───────────────────────────────────────
        topPages,
        recentJourney: allPageEvents,

        // ── Prompt history ─────────────────────────────────────────
        promptHistory: {
          wasPrompted: devices.some(d => d.promptCount > 0),
          totalPrompts: devices.reduce((s, d) => s + (d.promptCount || 0), 0),
          lastAction: devices[0]?.promptAction || null,
          lastShownAt: devices[0]?.promptShownAt || null,
        },
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// ────────────────────────────────────────────────────────────────────
// 9. GET ANY USER'S PWA PROFILE  (admin only)
//    GET /pwa/admin/user/:userId
// ────────────────────────────────────────────────────────────────────
export const getAdminUserPWAProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const devices = await PWAInstall.find({ user: userId })
      .populate("user", "name email avatar role createdAt")
      .sort({ lastActiveAt: -1 })
      .lean();

    if (!devices.length) {
      return res.status(404).json({ success: false, message: "No PWA data for this user" });
    }

    // Reuse same aggregation logic
    const totalPWASessions = devices.reduce((s, d) => s + (d.pwaSessionCount || 0), 0);
    const totalPageViews = devices.reduce((s, d) => s + (d.totalPageViews || 0), 0);

    const pageFreq = {};
    for (const device of devices) {
      for (const entry of (device.lastSeenPages || [])) {
        if (!entry.page) continue;
        pageFreq[entry.page] = (pageFreq[entry.page] || 0) + 1;
      }
    }
    const topPages = Object.entries(pageFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    const allPageEvents = devices
      .flatMap(d => (d.lastSeenPages || []).map(p => ({
        ...p,
        deviceType: d.deviceType,
        platform: d.platform,
        browser: d.browser,
      })))
      .sort((a, b) => new Date(b.seenAt) - new Date(a.seenAt))
      .slice(0, 30);

    res.status(200).json({
      success: true,
      data: {
        user: devices[0].user,
        totalDevices: devices.length,
        totalPWASessions,
        totalPageViews,
        devices: devices,
        topPages,
        fullJourney: allPageEvents,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};


// ────────────────────────────────────────────────────────────────────
// 10. GET ALL USERS PWA LIST  (admin — paginated)
//     GET /pwa/admin/users?page=1&limit=20&filter=installed
// ────────────────────────────────────────────────────────────────────
export const getAdminUsersList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || "all";
    // filter: 'all' | 'installed' | 'active' | 'wentBack' | 'notInstalled'
    const skip = (page - 1) * limit;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Build filter query ───────────────────────────────────────────
    const filterMap = {
      all: {},
      installed: { isInstalled: true },
      active: { isInstalled: true, lastActiveAt: { $gte: weekAgo } },
      wentBack: { wentBackToBrowser: true },
      notInstalled: { isInstalled: false, promptCount: { $gt: 0 } },
      inactive: { isInstalled: true, lastActiveAt: { $lt: monthAgo } },
    };

    const matchQuery = filterMap[filter] || {};

    const [records, total] = await Promise.all([
      PWAInstall.find(matchQuery)
        .populate("user", "name email avatar role createdAt")
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-lastSeenPages -userAgent")  // exclude heavy fields from list
        .lean(),
      PWAInstall.countDocuments(matchQuery),
    ]);

    res.status(200).json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        filterCounts: {
          // Quick counts for filter tabs in admin UI
          all: await PWAInstall.countDocuments({}),
          installed: await PWAInstall.countDocuments({ isInstalled: true }),
          active: await PWAInstall.countDocuments({ isInstalled: true, lastActiveAt: { $gte: weekAgo } }),
          wentBack: await PWAInstall.countDocuments({ wentBackToBrowser: true }),
          notInstalled: await PWAInstall.countDocuments({ isInstalled: false, promptCount: { $gt: 0 } }),
          inactive: await PWAInstall.countDocuments({ isInstalled: true, lastActiveAt: { $lt: monthAgo } }),
        },
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

