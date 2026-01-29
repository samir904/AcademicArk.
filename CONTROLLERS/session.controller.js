// =====================================
// 📊 CONTROLLERS/sessionController.js
// =====================================

import UserSession from "../MODELS/userSession.model.js";
import { UAParser } from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { updateProgressFromReaderExit } from "../services/studyProgressUpdater.service.js";
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

class SessionController {
    // ✅ START A NEW SESSION
    async startSession(req, res) {
        try {
            const { referrerSource, entryPage } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }

            // 🔍 Parse user-agent
            const parser = new UAParser(req.get("user-agent"));
            const result = parser.getResult();

            let deviceType = "DESKTOP";
            if (result.device.type === "mobile") deviceType = "MOBILE";
            if (result.device.type === "tablet") deviceType = "TABLET";

            // 🔎 1. CHECK FOR EXISTING ACTIVE SESSION
            const existingSession = await UserSession.findOne({
                userId,
                status: "ACTIVE",
                "deviceInfo.deviceType": deviceType
            }).sort({ lastActivityTime: -1 });

            // 🔁 2. REUSE SESSION IF NOT EXPIRED
            if (existingSession) {
                const inactiveTime =
                    Date.now() - new Date(existingSession.lastActivityTime).getTime();

                if (inactiveTime < SESSION_TIMEOUT) {
                    // ✅ RESUME SESSION
                    existingSession.lastActivityTime = new Date();
                    await existingSession.save();

                    return res.status(200).json({
                        success: true,
                        message: "Session resumed",
                        data: {
                            sessionId: existingSession.sessionId,
                            resumed: true
                        }
                    });
                }

                // ❌ SESSION EXPIRED → CLOSE IT
                existingSession.status = "ABANDONED";
                existingSession.endTime = existingSession.lastActivityTime;
                existingSession.duration = Math.floor(
                    (existingSession.endTime - existingSession.startTime) / 1000
                );

                await existingSession.save();
            }

            // 🆕 3. CREATE NEW SESSION
            const sessionId = `${userId}-${uuidv4()}`;

            const newSession = new UserSession({
                userId,
                sessionId,
                status: "ACTIVE",
                deviceInfo: {
                    deviceType,
                    userAgent: req.get("user-agent"),
                    browser: result.browser.name,
                    browserVersion: result.browser.version,
                    osName: result.os.name,
                    osVersion: result.os.version
                },
                location: {
                    ipAddress: req.ip,
                    country: req.headers["cf-ipcountry"] || "Unknown"
                },
                referrer: {
                    source: referrerSource || "DIRECT",
                    refUrl: req.get("referer") || null
                },
                entryPage: entryPage || "HOMEPAGE",
                lastActivityTime: new Date()
            });

            await newSession.save();

            return res.status(201).json({
                success: true,
                message: "New session started",
                data: {
                    sessionId,
                    resumed: false
                }
            });

        } catch (error) {
            console.error("Session start error:", error);
            res.status(500).json({
                success: false,
                message: "Error starting session",
                error: error.message
            });
        }
    }


    // ✅ END SESSION
    async endSession(req, res) {
        try {
            const { sessionId, exitPage } = req.body;

            const session = await UserSession.findOne({ sessionId });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }

            // Calculate duration
            const endTime = new Date();
            const duration = Math.floor((endTime - session.startTime) / 1000); // seconds

            // Check if bounce
            const isBounce = session.engagement.pageViews === 1 && duration < 30;

            // Update session
            session.endTime = endTime;
            session.duration = duration;
            session.status = isBounce ? "ABANDONED" : "ENDED";
            session.exitPage = exitPage || null;
            session.bounceInfo = {
                isBounce,
                bounceTime: isBounce ? duration : null
            };

            await session.save();

            res.status(200).json({
                success: true,
                message: "Session ended",
                data: {
                    sessionId,
                    duration,
                    isBounce
                }
            });
        } catch (error) {
            console.error("Session end error:", error);
            res.status(500).json({
                success: false,
                message: "Error ending session",
                error: error.message
            });
        }
    }

    async trackPageView(req, res) {
        const { sessionId, pageName, scrollDepth = 0 } = req.body;

        const session = await UserSession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false });
        }

        session.engagement.pageViews += 1;

        const safeScrollDepth = Math.min(100, Math.max(0, Number(scrollDepth) || 0));
        if (safeScrollDepth > session.engagement.maxScrollDepth) {
            session.engagement.maxScrollDepth = safeScrollDepth;
        }

        session.lastActivityTime = new Date();
        await session.save();

        res.json({ success: true });
    }


    async trackPageExit(req, res) {
  const { sessionId, pageName, timeSpent, resourceId, resourceType } = req.body;

  const session = await UserSession.findOne({ sessionId });
  if (!session) return res.status(404).json({ success: false });

  session.pages.push({
    pageName,
    timeSpent,
    resourceId,
    resourceType,
    scrollDepth: session.engagement.maxScrollDepth,
    clickCount: session.engagement.totalClicks,
    isExitPage: true,
    visitTime: new Date()
  });

  session.lastActivityTime = new Date();
  await session.save();
//   console.log('resources_type',resourceType);
//   console.log('resource-id',resourceId);
   // 🔥 ONLY HERE we update study time
  if (
    pageName === "NOTE_READER" &&
    resourceType === "NOTE" &&
    resourceId &&
    timeSpent > 0
  ) {
    await updateProgressFromReaderExit({
      userId: session.userId,
      noteId: resourceId,
      timeSpentSeconds: timeSpent
    });
  }

//   console.log('session after exit saved sesion ',session,'with session id ',sessionId,'last activity',session.lastActivityTime);
  res.json({ success: true });
}


    // ✅ TRACK NOTE INTERACTION
    async trackNoteInteraction(req, res) {
        try {
            const { sessionId, interactionType, noteId } = req.body;
            // interactionType: "viewed", "downloaded", "bookmarked", "rated", "clicked"

            const session = await UserSession.findOne({ sessionId });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }

            // Update note interactions
            if (session.engagement.noteInteractions[interactionType] !== undefined) {
                session.engagement.noteInteractions[interactionType] += 1;
            }

            // Record event
            let eventType = "CUSTOM";
            if (interactionType === "viewed") eventType = "NOTE_VIEW";
            if (interactionType === "downloaded") eventType = "NOTE_DOWNLOAD";
            if (interactionType === "bookmarked") eventType = "NOTE_BOOKMARK";
            if (interactionType === "rated") eventType = "NOTE_RATE";
            if (interactionType === "clicked") eventType = "NOTE_CLICK";

            session.events.push({
                eventType,
                eventName: `Note ${interactionType}`,
                timestamp: new Date(),
                resourceId: noteId
            });

            // Track as conversion if download
            if (interactionType === "downloaded") {
                session.conversions.push({
                    type: "DOWNLOAD",
                    timestamp: new Date(),
                    resourceId: noteId
                });
            }

            session.lastActivityTime = new Date();
            await session.save();

            res.status(200).json({
                success: true,
                message: `Note interaction tracked: ${interactionType}`,
                data: {
                    interactions: session.engagement.noteInteractions
                }
            });
        } catch (error) {
            console.error("Note interaction error:", error);
            res.status(500).json({
                success: false,
                message: "Error tracking note interaction",
                error: error.message
            });
        }
    }

    // ✅ TRACK CLICKS & HOMEPAGE SECTION EVENTS
    async trackClickEvent(req, res) {
        try {
            const { sessionId, clickType, impression = false, section } = req.body;
            // clickType: continueWhere | recommendedNote | trendingNote
            // section: HOMEPAGE_CONTINUE_WHERE | HOMEPAGE_RECOMMENDED | HOMEPAGE_TRENDING

            const session = await UserSession.findOne({ sessionId });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }
           if (impression === true && section) {
  const alreadyTracked = session.events.some(
    e =>
      e.eventType === "HOMEPAGE_SECTION_IMPRESSION" &&
      e.metadata?.section === section &&
      Math.abs(new Date(e.timestamp) - Date.now()) < 3000
  );

  if (alreadyTracked) {
    return res.status(200).json({ ignored: true });
  }
}


            /* ===============================
               1️⃣ SECTION IMPRESSION
               =============================== */
            if (impression === true && section) {
                // Counters
                session.clickThroughData.totalSectionImpressions += 1;

                if (clickType === "continueWhere") {
                    session.clickThroughData.continueWhereSectionImpressions += 1;
                }
                if (clickType === "recommendedNote") {
                    session.clickThroughData.recommendedSectionImpressions += 1;
                }
                if (clickType === "trendingNote") {
                    session.clickThroughData.trendingSectionImpressions += 1;
                }

                // Explicit event (🔥 THIS WAS MISSING)
                session.events.push({
                    eventType: "HOMEPAGE_SECTION_IMPRESSION",
                    eventName: `${section}_IMPRESSION`,
                    timestamp: new Date(),
                    metadata: { section, clickType }
                });
            }

            /* ===============================
               2️⃣ ACTUAL CLICK (NOT impression)
               =============================== */
            if (impression !== true && section) {
                // Engagement counters
                session.engagement.totalClicks += 1;
                session.clickThroughData.totalSectionClicks += 1;

                if (clickType === "continueWhere") {
                    session.clickThroughData.continueWhereSectionClicks += 1;
                }
                if (clickType === "recommendedNote") {
                    session.clickThroughData.recommendedNoteClicks += 1;
                }
                if (clickType === "trendingNote") {
                    session.clickThroughData.trendingNotesClicks += 1;
                }

                // Explicit click event
                session.events.push({
                    eventType: "HOMEPAGE_SECTION_CLICK",
                    eventName: `${section}_CLICK`,
                    timestamp: new Date(),
                    metadata: { section, clickType }
                });
            }

            /* ===============================
               3️⃣ CTR CALCULATION (SAFE)
               =============================== */
            if (session.clickThroughData.totalSectionImpressions > 0) {
                session.clickThroughData.ctr = Number(
                    (
                        session.clickThroughData.totalSectionClicks /
                        session.clickThroughData.totalSectionImpressions
                    ) * 100
                ).toFixed(2);
            }

            session.lastActivityTime = new Date();
            await session.save();

            return res.status(200).json({
                success: true,
                message: "Homepage interaction tracked",
                data: {
                    impressions: session.clickThroughData.totalSectionImpressions,
                    clicks: session.clickThroughData.totalSectionClicks,
                    ctr: session.clickThroughData.ctr
                }
            });
        } catch (error) {
            console.error("Click tracking error:", error);
            return res.status(500).json({
                success: false,
                message: "Error tracking click",
                error: error.message
            });
        }
    }

    // ✅ KEEP SESSION ALIVE (ping)
    async pingSession(req, res) {
        try {
            const { sessionId } = req.body;

            const session = await UserSession.findOneAndUpdate(
                { sessionId },
                { lastActivityTime: new Date() },
                { new: true }
            );

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Session not found"
                });
            }

            res.status(200).json({
                success: true,
                message: "Session kept alive",
                data: {
                    sessionId,
                    lastActivityTime: session.lastActivityTime
                }
            });
        } catch (error) {
            console.error("Ping error:", error);
            res.status(500).json({
                success: false,
                message: "Error pinging session",
                error: error.message
            });
        }
    }

    // ✅ GET ACTIVE SESSION
    async getActiveSession(req, res) {
        try {
            const { userId } = req.params;

            const session = await UserSession.findOne({
                userId,
                status: "ACTIVE"
            }).sort({ startTime: -1 });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "No active session"
                });
            }

            res.status(200).json({
                success: true,
                data: session
            });
        } catch (error) {
            console.error("Get session error:", error);
            res.status(500).json({
                success: false,
                message: "Error retrieving session",
                error: error.message
            });
        }
    }

    // ✅ GET SESSION ANALYTICS
    async getSessionAnalytics(req, res) {
        try {
            const { userId, timeRange = 7 } = req.query; // Default 7 days

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - timeRange);

            const sessions = await UserSession.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        avgDuration: { $avg: "$duration" },
                        avgPageViews: { $avg: "$engagement.pageViews" },
                        avgClicks: { $avg: "$engagement.totalClicks" },
                        totalDownloads: { $sum: "$engagement.noteInteractions.downloaded" },
                        totalBookmarks: { $sum: "$engagement.noteInteractions.bookmarked" },
                        totalRatings: { $sum: "$engagement.noteInteractions.rated" },
                        bounceRate: {
                            $avg: {
                                $cond: [
                                    { $eq: ["$bounceInfo.isBounce", true] },
                                    1,
                                    0
                                ]
                            }
                        },
                        avgCTR: { $avg: "$clickThroughData.ctr" }
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                data: sessions[0] || {
                    totalSessions: 0,
                    avgDuration: 0,
                    avgPageViews: 0,
                    avgClicks: 0,
                    totalDownloads: 0,
                    totalBookmarks: 0,
                    totalRatings: 0,
                    bounceRate: 0,
                    avgCTR: 0
                }
            });
        } catch (error) {
            console.error("Analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Error retrieving analytics",
                error: error.message
            });
        }
    }

    // ✅ GET PAGE ENGAGEMENT METRICS
    async getPageMetrics(req, res) {
        try {
            const { userId, pageName } = req.query;

            const metrics = await UserSession.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $unwind: "$pages"
                },
                {
                    $match: {
                        "pages.pageName": pageName
                    }
                },
                {
                    $group: {
                        _id: "$pages.pageName",
                        viewCount: { $sum: 1 },
                        avgTimeSpent: { $avg: "$pages.timeSpent" },
                        avgScrollDepth: { $avg: "$pages.scrollDepth" },
                        totalClicks: { $sum: "$pages.clickCount" }
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                data: metrics[0] || {
                    viewCount: 0,
                    avgTimeSpent: 0,
                    avgScrollDepth: 0,
                    totalClicks: 0
                }
            });
        } catch (error) {
            console.error("Page metrics error:", error);
            res.status(500).json({
                success: false,
                message: "Error retrieving page metrics",
                error: error.message
            });
        }
    }
}

export default new SessionController();