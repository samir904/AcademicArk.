import UserSession from '../MODELS/userSession.model.js';
import User from '../MODELS/user.model.js';
import mongoose from 'mongoose';

class AdminAnalyticsController {
    // ═════════════════════════════════════════════════════════════
    // TAB 1: OVERVIEW - Health of Platform (FIXED)
    // ═════════════════════════════════════════════════════════════

    async getOverview(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            // 1️⃣ Core metrics (FIX: extract from array)
            const overviewAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        avgSessionDuration: { $avg: '$duration' },
                        totalPageViews: { $sum: '$engagement.pageViews' },
                        totalDownloads: { $sum: '$engagement.noteInteractions.downloaded' }
                    }
                }
            ]);
            const overview = overviewAgg[0] || {};

            // 2️⃣ Calculate bounce rate (FIX: extract from array)
            const bounceAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        bouncedSessions: {
                            $sum: {
                                $cond: ['$bounceInfo.isBounce', 1, 0]
                            }
                        }
                    }
                },
                {
                    $project: {
                        bounceRate: {
                            $cond: [
                                { $eq: ['$totalSessions', 0] },
                                0,
                                {
                                    $round: [
                                        { $multiply: [{ $divide: ['$bouncedSessions', '$totalSessions'] }, 100] },
                                        2
                                    ]
                                }
                            ]
                        }
                    }
                }
            ]);
            const bounceRateData = bounceAgg[0]|| {};

            // 3️⃣ Active users today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeUsersToday = await UserSession.distinct('userId', {
                startTime: { $gte: today }
            });

            // 4️⃣ Downloads today (FIX: extract from array)
            const downloadsTodayAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: today }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDownloads: { $sum: '$engagement.noteInteractions.downloaded' }
                    }
                }
            ]);
            const downloadsData = downloadsTodayAgg[0] || {};

            res.status(200).json({
                success: true,
                data: {
                    timeRange: `${range} days`,
                    totalSessions: overview.totalSessions || 0,
                    activeUsersToday: activeUsersToday.length,
                    avgSessionDuration: Math.round(overview.avgSessionDuration || 0),
                    bounceRate: bounceRateData.bounceRate || 0,
                    totalPageViews: overview.totalPageViews || 0,
                    downloadsToday: downloadsData.totalDownloads || 0,
                    totalDownloads: overview.totalDownloads || 0
                }
            });
        } catch (error) {
            console.error('Overview error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching overview',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 2: SESSIONS & USERS
    // ═════════════════════════════════════════════════════════════

    async getSessionsTimeline(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            // FIX: Use startTime for consistency, not createdAt
            const timeline = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$startTime' }
                        },
                        sessions: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$userId' },
                        avgDuration: { $avg: '$duration' },
                        avgPageViews: { $avg: '$engagement.pageViews' }
                    }
                },
                {
                    $project: {
                        date: '$_id',
                        sessions: 1,
                        uniqueUsers: { $size: '$uniqueUsers' },
                        avgDuration: { $round: ['$avgDuration', 0] },
                        avgPageViews: { $round: ['$avgPageViews', 2] },
                        _id: 0
                    }
                },
                {
                    $sort: { date: 1 }
                }
            ]);

            res.status(200).json({
                success: true,
                data: timeline
            });
        } catch (error) {
            console.error('Sessions timeline error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching sessions timeline',
                error: error.message
            });
        }
    }

    async getReturningUsers(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            // FIX: Extract from array properly
            const returningAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        sessionCount: { $sum: 1 }
                    }
                },
                {
                    $match: {
                        sessionCount: { $gte: 2 }
                    }
                },
                {
                    $count: 'returningUsers'
                }
            ]);
            const returningData = returningAgg[0] || {};

            const totalUsers = await UserSession.distinct('userId', {
                startTime: { $gte: startDate }
            });

            const returning = returningData.returningUsers || 0;
            const newUsers = totalUsers.length - returning;

            res.status(200).json({
                success: true,
                data: {
                    totalUniqueUsers: totalUsers.length,
                    returningUsers: returning,
                    newUsers: newUsers,
                    returningPercentage: totalUsers.length > 0 
                        ? ((returning / totalUsers.length) * 100).toFixed(2)
                        : 0
                }
            });
        } catch (error) {
            console.error('Returning users error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching returning users',
                error: error.message
            });
        }
    }

    async getNewUsers(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            // FIX: Extract from array properly
            const newUsersAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        sessionCount: { $sum: 1 }
                    }
                },
                {
                    $match: {
                        sessionCount: 1
                    }
                },
                {
                    $count: 'newUsers'
                }
            ]);
            const newUsersData = newUsersAgg[0] || {};

            res.status(200).json({
                success: true,
                data: {
                    newUsers: newUsersData.newUsers || 0
                }
            });
        } catch (error) {
            console.error('New users error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching new users',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 3: PAGE ANALYTICS
    // ═════════════════════════════════════════════════════════════

    async getTopPages(req, res) {
        try {
            const { range = 7, limit = 10 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const topPages = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $unwind: '$pages'
                },
                {
                    $group: {
                        _id: '$pages.pageName',
                        views: { $sum: 1 },
                        avgTimeSpent: { $avg: '$pages.timeSpent' },
                        avgScrollDepth: { $avg: '$pages.scrollDepth' },
                        exitPercentage: {
                            $avg: {
                                $cond: ['$pages.isExitPage', 1, 0]
                            }
                        }
                    }
                },
                {
                    $project: {
                        pageName: '$_id',
                        views: 1,
                        avgTimeSpent: { $round: ['$avgTimeSpent', 0] },
                        avgScrollDepth: { $round: ['$avgScrollDepth', 2] },
                        exitPercentage: { $round: [{ $multiply: ['$exitPercentage', 100] }, 2] },
                        _id: 0
                    }
                },
                {
                    $sort: { views: -1 }
                },
                {
                    $limit: parseInt(limit)
                }
            ]);

            res.status(200).json({
                success: true,
                data: topPages
            });
        } catch (error) {
            console.error('Top pages error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching top pages',
                error: error.message
            });
        }
    }

    async getPageEngagement(req, res) {
        try {
            const { pageName } = req.query;

            if (!pageName) {
                return res.status(400).json({
                    success: false,
                    message: 'pageName query parameter required'
                });
            }

            const engagement = await UserSession.aggregate([
                {
                    $unwind: '$pages'
                },
                {
                    $match: {
                        'pages.pageName': pageName
                    }
                },
                {
                    $group: {
                        _id: '$pages.pageName',
                        totalViews: { $sum: 1 },
                        avgTimeSpent: { $avg: '$pages.timeSpent' },
                        avgScrollDepth: { $avg: '$pages.scrollDepth' },
                        avgClicks: { $avg: '$pages.clickCount' },
                        totalClicks: { $sum: '$pages.clickCount' }
                    }
                },
                {
                    $project: {
                        pageName: '$_id',
                        totalViews: 1,
                        avgTimeSpent: { $round: ['$avgTimeSpent', 0] },
                        avgScrollDepth: { $round: ['$avgScrollDepth', 2] },
                        avgClicks: { $round: ['$avgClicks', 2] },
                        totalClicks: 1,
                        _id: 0
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                data: engagement || {}
            });
        } catch (error) {
            console.error('Page engagement error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching page engagement',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 4: NOTES ANALYTICS
    // ═════════════════════════════════════════════════════════════

   async getTopViewedNotes(req, res) {
  try {
    const { range = 7, limit = 10 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(range));

    const topViewed = await UserSession.aggregate([
      // 1️⃣ Filter sessions by date
      {
        $match: {
          startTime: { $gte: startDate }
        }
      },

      // 2️⃣ Expand events
      { $unwind: '$events' },

      // 3️⃣ Only NOTE_VIEW events
      {
        $match: {
          'events.eventType': 'NOTE_VIEW',
          'events.resourceId': { $exists: true }
        }
      },

      // 4️⃣ Group by noteId
      {
        $group: {
          _id: '$events.resourceId',
          views: { $sum: 1 }
        }
      },

      // 5️⃣ Sort by views
      { $sort: { views: -1 } },

      // 6️⃣ Limit
      { $limit: Number(limit) },

      // 7️⃣ Join with notes collection
      {
        $lookup: {
          from: 'notes',          // 🔴 must be Mongo collection name
          localField: '_id',
          foreignField: '_id',
          as: 'note'
        }
      },

      // 8️⃣ Flatten note
      { $unwind: '$note' },

      // 9️⃣ Final shape
      {
        $project: {
          _id: 0,
          noteId: '$_id',
          title: '$note.title',
          subject: '$note.subject',
          semester: '$note.semester',
          views: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: topViewed
    });

  } catch (error) {
    console.error('Top viewed notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top viewed notes',
      error: error.message
    });
  }
}


    async getTopDownloadedNotes(req, res) {
  try {
    const { range = 7, limit = 10 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(range));

    const topDownloaded = await UserSession.aggregate([
      // 1️⃣ Filter sessions by date
      {
        $match: {
          startTime: { $gte: startDate }
        }
      },

      // 2️⃣ Expand events
      { $unwind: '$events' },

      // 3️⃣ Only NOTE_DOWNLOAD events
      {
        $match: {
          'events.eventType': 'NOTE_DOWNLOAD',
          'events.resourceId': { $exists: true }
        }
      },

      // 4️⃣ Group by noteId
      {
        $group: {
          _id: '$events.resourceId',
          downloads: { $sum: 1 }
        }
      },

      // 5️⃣ Sort by downloads
      { $sort: { downloads: -1 } },

      // 6️⃣ Limit
      { $limit: Number(limit) },

      // 7️⃣ Join with notes collection
      {
        $lookup: {
          from: 'notes',                // 👈 collection name (VERY IMPORTANT)
          localField: '_id',             // resourceId
          foreignField: '_id',           // note _id
          as: 'note'
        }
      },

      // 8️⃣ Flatten note array
      { $unwind: '$note' },

      // 9️⃣ Shape final response
      {
        $project: {
          _id: 0,
          noteId: '$_id',
          title: '$note.title',
          subject: '$note.subject',
          semester: '$note.semester',
          downloads: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: topDownloaded
    });

  } catch (error) {
    console.error('Top downloaded notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top downloaded notes',
      error: error.message
    });
  }
}


    async getNotesFunnel(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const funnelAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        views: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$events',
                                        as: 'event',
                                        cond: { $eq: ['$$event.eventType', 'NOTE_VIEW'] }
                                    }
                                }
                            }
                        },
                        clicks: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$events',
                                        as: 'event',
                                        cond: { $eq: ['$$event.eventType', 'NOTE_CLICK'] }
                                    }
                                }
                            }
                        },
                        downloads: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$events',
                                        as: 'event',
                                        cond: { $eq: ['$$event.eventType', 'NOTE_DOWNLOAD'] }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        views: 1,
                        clicks: 1,
                        downloads: 1,
                        clickThroughRate: {
                            $cond: [
                                { $eq: ['$views', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$clicks', '$views'] }, 100] }, 2] }
                            ]
                        },
                        downloadConversionRate: {
                            $cond: [
                                { $eq: ['$clicks', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$downloads', '$clicks'] }, 100] }, 2] }
                            ]
                        },
                        overallConversion: {
                            $cond: [
                                { $eq: ['$views', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$downloads', '$views'] }, 100] }, 2] }
                            ]
                        },
                        _id: 0
                    }
                }
            ]);

            // FIX: Extract from array
            const funnel = funnelAgg[0] || {
                views: 0,
                clicks: 0,
                downloads: 0,
                clickThroughRate: 0,
                downloadConversionRate: 0,
                overallConversion: 0
            };

            res.status(200).json({
                success: true,
                data: funnel
            });
        } catch (error) {
            console.error('Notes funnel error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching notes funnel',
                error: error.message
            });
        }
    }

    async getDeadContent(req, res) {
        try {
            const { range = 30, minViews = 5, maxDownloads = 1 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const deadContent = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $unwind: '$events'
                },
                {
                    $group: {
                        _id: '$events.resourceId',
                        views: {
                            $sum: {
                                $cond: [{ $eq: ['$events.eventType', 'NOTE_VIEW'] }, 1, 0]
                            }
                        },
                        downloads: {
                            $sum: {
                                $cond: [{ $eq: ['$events.eventType', 'NOTE_DOWNLOAD'] }, 1, 0]
                            }
                        }
                    }
                },
                {
                    $match: {
                        views: { $gte: parseInt(minViews) },
                        downloads: { $lte: parseInt(maxDownloads) }
                    }
                },
                {
                    $project: {
                        noteId: '$_id',
                        views: 1,
                        downloads: 1,
                        // FIX: Safe divide with $cond
                        conversionRate: {
                            $cond: [
                                { $eq: ['$views', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$downloads', '$views'] }, 100] }, 2] }
                            ]
                        },
                        _id: 0
                    }
                },
                {
                    $sort: { views: -1 }
                },
                {
                    $limit: 20
                }
            ]);

            res.status(200).json({
                success: true,
                data: deadContent
            });
        } catch (error) {
            console.error('Dead content error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching dead content',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 5: FUNNEL & CONVERSIONS
    // ═════════════════════════════════════════════════════════════

    async getDownloadFunnel(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const funnelAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        homepage: {
                            $sum: {
                                $cond: [{
                                    $in: ['HOMEPAGE', {
                                        $map: { input: '$pages', as: 'p', in: '$$p.pageName' }
                                    }]
                                }, 1, 0]
                            }
                        },
                        notesList: {
                            $sum: {
                                $cond: [{
                                    $in: ['NOTES_LIST', {
                                        $map: { input: '$pages', as: 'p', in: '$$p.pageName' }
                                    }]
                                }, 1, 0]
                            }
                        },
                        noteDetail: {
                            $sum: {
                                $cond: [{
                                    $in: ['NOTE_DETAIL', {
                                        $map: { input: '$pages', as: 'p', in: '$$p.pageName' }
                                    }]
                                }, 1, 0]
                            }
                        },
                        downloads: { $sum: '$engagement.noteInteractions.downloaded' }
                    }
                },
                {
                    $project: {
                        step1_homepage: '$homepage',
                        step2_notesList: '$notesList',
                        step3_noteDetail: '$noteDetail',
                        step4_download: '$downloads',
                        // FIX: Safe divide with $cond for all drops
                        drop1: {
                            $cond: [
                                { $eq: ['$homepage', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$homepage', '$notesList'] }, '$homepage'] }, 100] }, 2] }
                            ]
                        },
                        drop2: {
                            $cond: [
                                { $eq: ['$notesList', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$notesList', '$noteDetail'] }, '$notesList'] }, 100] }, 2] }
                            ]
                        },
                        drop3: {
                            $cond: [
                                { $eq: ['$noteDetail', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$noteDetail', '$downloads'] }, '$noteDetail'] }, 100] }, 2] }
                            ]
                        },
                        _id: 0
                    }
                }
            ]);

            // FIX: Extract from array
            const funnel = funnelAgg[0] || {};

            res.status(200).json({
                success: true,
                data: funnel
            });
        } catch (error) {
            console.error('Download funnel error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching download funnel',
                error: error.message
            });
        }
    }

    async getConversionsSummary(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const conversionsAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        sessionsWithConversions: {
                            $sum: {
                                $cond: [{
                                    $gt: [{ $size: '$conversions' }, 0]
                                }, 1, 0]
                            }
                        },
                        totalConversions: {
                            $sum: { $size: '$conversions' }
                        },
                        downloadConversions: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$conversions',
                                        as: 'conv',
                                        cond: { $eq: ['$$conv.type', 'DOWNLOAD'] }
                                    }
                                }
                            }
                        },
                        bookmarkConversions: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$conversions',
                                        as: 'conv',
                                        cond: { $eq: ['$$conv.type', 'BOOKMARK'] }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        totalSessions: 1,
                        sessionsWithConversions: 1,
                        totalConversions: 1,
                        downloadConversions: 1,
                        bookmarkConversions: 1,
                        // FIX: Safe divide
                        conversionRate: {
                            $cond: [
                                { $eq: ['$totalSessions', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$sessionsWithConversions', '$totalSessions'] }, 100] }, 2] }
                            ]
                        },
                        _id: 0
                    }
                }
            ]);

            // FIX: Extract from array
            const conversions = conversionsAgg[0] || {};

            res.status(200).json({
                success: true,
                data: conversions
            });
        } catch (error) {
            console.error('Conversions error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching conversions',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 6: ENGAGEMENT & CTR
    // ═════════════════════════════════════════════════════════════

  async getCTRBySection(req, res) {
  try {
    const { range = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const ctrAgg = await UserSession.aggregate([
      {
        $match: {
          startTime: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,

          continueWhereImpressions: {
            $sum: { $ifNull: ['$clickThroughData.continueWhereSectionImpressions', 0] }
          },
          continueWhereClicks: {
            $sum: { $ifNull: ['$clickThroughData.continueWhereSectionClicks', 0] }
          },

          recommendedImpressions: {
            $sum: { $ifNull: ['$clickThroughData.recommendedSectionImpressions', 0] }
          },
          recommendedClicks: {
            $sum: { $ifNull: ['$clickThroughData.recommendedNoteClicks', 0] }
          },

          trendingImpressions: {
            $sum: { $ifNull: ['$clickThroughData.trendingSectionImpressions', 0] }
          },
          trendingClicks: {
            $sum: { $ifNull: ['$clickThroughData.trendingNotesClicks', 0] }
          }
        }
      },
      {
        $project: {
          sections: [
            {
              name: 'Continue Where',
              impressions: '$continueWhereImpressions',
              clicks: '$continueWhereClicks',
              ctr: {
                $cond: [
                  { $eq: ['$continueWhereImpressions', 0] },
                  0,
                  { $round: [{ $multiply: [{ $divide: ['$continueWhereClicks', '$continueWhereImpressions'] }, 100] }, 2] }
                ]
              }
            },
            {
              name: 'Recommended Notes',
              impressions: '$recommendedImpressions',
              clicks: '$recommendedClicks',
              ctr: {
                $cond: [
                  { $eq: ['$recommendedImpressions', 0] },
                  0,
                  { $round: [{ $multiply: [{ $divide: ['$recommendedClicks', '$recommendedImpressions'] }, 100] }, 2] }
                ]
              }
            },
            {
              name: 'Trending Notes',
              impressions: '$trendingImpressions',
              clicks: '$trendingClicks',
              ctr: {
                $cond: [
                  { $eq: ['$trendingImpressions', 0] },
                  0,
                  { $round: [{ $multiply: [{ $divide: ['$trendingClicks', '$trendingImpressions'] }, 100] }, 2] }
                ]
              }
            }
          ],
          _id: 0
        }
      },
      { $unwind: '$sections' },
      { $replaceRoot: { newRoot: '$sections' } }
    ]);

    res.status(200).json({
      success: true,
      data: ctrAgg
    });

  } catch (error) {
    console.error('CTR error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching CTR data',
      error: error.message
    });
  }
}


    async getEngagementSummary(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const engagementAgg = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgPageViews: { $avg: '$engagement.pageViews' },
                        avgClicks: { $avg: '$engagement.totalClicks' },
                        avgScrollDepth: { $avg: '$engagement.maxScrollDepth' },
                        totalBookmarks: { $sum: '$engagement.noteInteractions.bookmarked' },
                        totalRatings: { $sum: '$engagement.noteInteractions.rated' },
                        avgSessionDuration: { $avg: '$duration' }
                    }
                },
                {
                    $project: {
                        avgPageViews: { $round: ['$avgPageViews', 2] },
                        avgClicks: { $round: ['$avgClicks', 2] },
                        avgScrollDepth: { $round: ['$avgScrollDepth', 2] },
                        totalBookmarks: 1,
                        totalRatings: 1,
                        avgSessionDuration: { $round: ['$avgSessionDuration', 0] },
                        _id: 0
                    }
                }
            ]);

            // FIX: Extract from array
            const engagement = engagementAgg[0] || {};

            res.status(200).json({
                success: true,
                data: engagement
            });
        } catch (error) {
            console.error('Engagement summary error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching engagement summary',
                error: error.message
            });
        }
    }

    // ═════════════════════════════════════════════════════════════
    // TAB 7: DEVICES & TECH
    // ═════════════════════════════════════════════════════════════

    async getDeviceBreakdown(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const devices = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$deviceInfo.deviceType',
                        sessions: { $sum: 1 },
                        users: { $addToSet: '$userId' },
                        avgDuration: { $avg: '$duration' }
                    }
                },
                {
                    $project: {
                        deviceType: '$_id',
                        sessions: 1,
                        uniqueUsers: { $size: '$users' },
                        avgDuration: { $round: ['$avgDuration', 0] },
                        _id: 0
                    }
                }
            ]);

            const totalSessions = devices.reduce((sum, d) => sum + d.sessions, 0);

            const devicesWithPercentage = devices.map(d => ({
                ...d,
                percentage: totalSessions > 0 
                    ? parseFloat(((d.sessions / totalSessions) * 100).toFixed(2))
                    : 0
            }));

            res.status(200).json({
                success: true,
                data: devicesWithPercentage
            });
        } catch (error) {
            console.error('Device breakdown error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching device breakdown',
                error: error.message
            });
        }
    }

    async getBrowserBreakdown(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const browsers = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate },
                        'deviceInfo.browser': { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$deviceInfo.browser',
                        sessions: { $sum: 1 },
                        users: { $addToSet: '$userId' }
                    }
                },
                {
                    $project: {
                        browser: '$_id',
                        sessions: 1,
                        uniqueUsers: { $size: '$users' },
                        _id: 0
                    }
                },
                {
                    $sort: { sessions: -1 }
                }
            ]);

            res.status(200).json({
                success: true,
                data: browsers
            });
        } catch (error) {
            console.error('Browser breakdown error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching browser breakdown',
                error: error.message
            });
        }
    }

    async getOSBreakdown(req, res) {
        try {
            const { range = 7 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - range);

            const os = await UserSession.aggregate([
                {
                    $match: {
                        startTime: { $gte: startDate },
                        'deviceInfo.osName': { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$deviceInfo.osName',
                        sessions: { $sum: 1 },
                        users: { $addToSet: '$userId' }
                    }
                },
                {
                    $project: {
                        osName: '$_id',
                        sessions: 1,
                        uniqueUsers: { $size: '$users' },
                        _id: 0
                    }
                },
                {
                    $sort: { sessions: -1 }
                }
            ]);

            res.status(200).json({
                success: true,
                data: os
            });
        } catch (error) {
            console.error('OS breakdown error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching OS breakdown',
                error: error.message
            });
        }
    }
}

export default new AdminAnalyticsController();
