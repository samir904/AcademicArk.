import FilterAnalytics from "../MODELS/filterAnalytics.model.js";
import SavedFilter from "../MODELS/savedFilterSchema.model.js";
import mongoose from "mongoose";
/**
 * 🔹 1. Track Filter Event
 */
export const trackFilterEvent = async (req, res) => {
  const {
    semester,
    subject,
    category,
    unit,
    videoChapter,
    uploadedBy,
    resultsCount = 0,
    deviceInfo  // ✨ NEW: Accept device info from frontend
  } = req.body;

  console.log('📊 Tracking filter event:', {
    userId: req.user?._id || req.user?.id || null,
    sessionId: req.headers["x-session-id"],
    deviceInfo,  // ✅ Log device info
    body: req.body
  });

  if (!semester) {
    return res.status(400).json({
      success: false,
      message: "Semester is required"
    });
  }

  await FilterAnalytics.create({
    userId: req.user?._id || req.user?.id || null,
    sessionId: req.headers["x-session-id"] || null,
    semester,
    subject,
    category,
    unit,
    videoChapter,
    uploadedBy,
    resultsCount,
    hasResults: resultsCount > 0,
    deviceInfo: deviceInfo || { platform: null, browser: null, os: null }  // ✅ Add device info
  });

  return res.status(201).json({
    success: true,
    message: "Filter tracked successfully"
  });
};


/**
 * 🔹 2. Mark Download After Filter
 */
export const markDownloadAfterFilter = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"];
    const { noteId } = req.body;

    console.log('📥 [DOWNLOAD] Mark download request:', {
      sessionId,
      noteId,
      userId: req.user?._id || req.user?.id || null
    });

    if (!sessionId) {
      console.error('❌ [DOWNLOAD] No session ID provided');
      return res.status(400).json({
        success: false,
        message: "Session ID missing"
      });
    }

    // ✅ FIXED: Find most recent filter with actual filtering (not just semester)
    // Skip entries that only have semester (preview mode)
    const filterEntry = await FilterAnalytics.findOne({ 
      sessionId, 
      downloadedAfterFilter: false,
      $or: [
        { subject: { $exists: true, $ne: null } },  // Has subject
        { category: { $exists: true, $ne: null } }, // Or has category
        { unit: { $exists: true, $ne: null } }      // Or has unit
      ]
    }).sort({ createdAt: -1 });

    if (!filterEntry) {
      console.warn('⚠️ [DOWNLOAD] No matching filter entry found');
      
      // Fallback: Try to find ANY recent entry (even semester-only)
      const fallbackEntry = await FilterAnalytics.findOne({
        sessionId,
        downloadedAfterFilter: false
      }).sort({ createdAt: -1 });

      if (!fallbackEntry) {
        return res.status(404).json({
          success: false,
          message: "No recent filter activity found for this session"
        });
      }

      // Use fallback but log warning
      console.warn('⚠️ [DOWNLOAD] Using fallback entry (semester-only)');
      
      // Calculate time to conversion
      const timeToDownload = Date.now() - fallbackEntry.createdAt.getTime();

      // Update fallback entry
      const result = await FilterAnalytics.findByIdAndUpdate(
        fallbackEntry._id,
        { 
          downloadedAfterFilter: true,
          downloadedAt: new Date(),
          downloadedNoteId: noteId || null,
          timeToDownload
        },
        { new: true }
      );

      console.log('✅ [DOWNLOAD] Marked (fallback):', {
        entryId: result._id,
        semester: result.semester,
        subject: result.subject || 'N/A',
        timeToDownload: `${(timeToDownload / 1000).toFixed(2)}s`
      });

      return res.json({
        success: true,
        message: "Download marked successfully",
        data: {
          semester: result.semester,
          subject: result.subject || null,
          category: result.category || null,
          timeToDownload
        }
      });
    }

    // ✅ Calculate time to conversion
    const timeToDownload = Date.now() - filterEntry.createdAt.getTime();

    // ✅ Update with download info
    const result = await FilterAnalytics.findByIdAndUpdate(
      filterEntry._id,
      { 
        downloadedAfterFilter: true,
        downloadedAt: new Date(),
        downloadedNoteId: noteId || null,
        timeToDownload
      },
      { new: true }
    );

    console.log('✅ [DOWNLOAD] Marked successfully:', {
      entryId: result._id,
      semester: result.semester,
      subject: result.subject || 'N/A',
      category: result.category || 'N/A',
      unit: result.unit || 'N/A',
      timeToDownload: `${(timeToDownload / 1000).toFixed(2)}s`
    });

    return res.json({
      success: true,
      message: "Download marked successfully",
      data: {
        semester: result.semester,
        subject: result.subject || null,
        category: result.category || null,
        unit: result.unit || null,
        timeToDownload
      }
    });

  } catch (error) {
    console.error('❌ [DOWNLOAD] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark download"
    });
  }
};


/**
 * ✨ NEW: Track Note View (without download)
 */
export const trackNoteView = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"];
    const { noteId } = req.body;

    console.log('👁️ [VIEW] Track request:', { sessionId, noteId });

    if (!sessionId) {
      console.warn('⚠️ [VIEW] No session ID');
      return res.status(400).json({
        success: false,
        message: "Session ID required"
      });
    }

    if (!noteId) {
      console.warn('⚠️ [VIEW] No note ID');
      return res.status(400).json({
        success: false,
        message: "Note ID required"
      });
    }

    // ✅ Find most recent filter entry for this session (not yet downloaded)
    const filterEntry = await FilterAnalytics.findOne({
      sessionId,
      downloadedAfterFilter: false
    }).sort({ createdAt: -1 });

    if (!filterEntry) {
      console.warn('⚠️ [VIEW] No active filter session found');
      return res.status(404).json({
        success: false,
        message: "No active filter session found"
      });
    }

    // ✅ Check if this note was already viewed in this session
    const alreadyViewed = filterEntry.viewedNotes.some(
      v => v.noteId.toString() === noteId
    );

    if (alreadyViewed) {
      console.log('ℹ️ [VIEW] Note already viewed in this session');
      return res.json({
        success: true,
        message: "Already tracked"
      });
    }

    // ✅ Update with new view
    const updated = await FilterAnalytics.findByIdAndUpdate(
      filterEntry._id,
      { 
        $push: { 
          viewedNotes: { 
            noteId, 
            viewedAt: new Date() 
          } 
        },
        $inc: { 
          'engagement.notesClicked': 1 
        }
      },
      { new: true }
    );

    console.log('✅ [VIEW] Tracked:', {
      sessionId,
      noteId,
      totalViewed: updated.viewedNotes.length
    });

    return res.json({
      success: true,
      message: "Note view tracked",
      data: {
        totalViewed: updated.viewedNotes.length,
        notesClicked: updated.engagement.notesClicked
      }
    });

  } catch (error) {
    console.error('❌ [VIEW] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to track view"
    });
  }
};



/**
 * 🔹 3. Check Preset Suggestion (3 Times Rule)
 */
export const checkPresetSuggestion = async (req, res) => {
  try {
    let { semester, subject, category, unit } = req.query;
    const userId = req.user?.id || req.user?._id;

    // ✅ FIX: Filter out 'undefined' strings and empty values
    semester = semester && semester !== 'undefined' ? semester : null;
    subject = subject && subject !== 'undefined' ? subject.trim() : null;
    category = category && category !== 'undefined' ? category : null;
    unit = unit && unit !== 'undefined' ? unit : null;

    console.log('💡 [PRESET SUGGESTION] Check request (cleaned):', {
      userId,
      semester,
      subject,
      category,
      unit
    });

    // ✅ Must have at least semester + subject
    if (!semester || !subject) {
      console.log('⏭️ [PRESET SUGGESTION] Missing required filters');
      return res.json({ 
        success: true, 
        showSuggestion: false,
        reason: 'missing_filters'
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // ✅ Build query filter with only valid values
    const queryFilter = {
      userId: userObjectId,
      semester: Number(semester),
      subject: subject.toLowerCase().trim()
    };

    // ✅ Only add if they're valid (not null/undefined)
    if (category) queryFilter.category = category;
    if (unit) queryFilter.unit = Number(unit);

    console.log('🔍 [PRESET SUGGESTION] Query filter:', queryFilter);

    const frequency = await FilterAnalytics.countDocuments(queryFilter);

    console.log('📊 [PRESET SUGGESTION] Filter frequency:', frequency);

    if (frequency < 3) {
      console.log('⏳ [PRESET SUGGESTION] Not enough usage (need 3+)');
      return res.json({
        success: true,
        showSuggestion: false,
        frequency,
        reason: 'not_enough_uses'
      });
    }

    // ✅ Check existing presets
    const allUserPresets = await SavedFilter.find({ 
      userId: userObjectId 
    });

    console.log(`🔍 [PRESET SUGGESTION] Checking ${allUserPresets.length} existing presets`);

    const matchingPreset = allUserPresets.find(preset => {
      const filters = preset.filters;
      
      // Semester must match
      if (filters.semester !== Number(semester)) return false;
      
      // Subject must match (case-insensitive, trimmed)
      if (filters.subject?.toLowerCase().trim() !== subject.toLowerCase().trim()) return false;
      
      // Category comparison (handle nulls)
      const presetCategory = filters.category || null;
      const searchCategory = category || null;
      if (presetCategory !== searchCategory) return false;
      
      // Unit comparison (handle nulls)
      const presetUnit = filters.unit ? Number(filters.unit) : null;
      const searchUnit = unit ? Number(unit) : null;
      if (presetUnit !== searchUnit) return false;
      
      return true;
    });

    if (matchingPreset) {
      console.log('✅ [PRESET SUGGESTION] Already saved as preset:', matchingPreset.name);
      return res.json({
        success: true,
        showSuggestion: false,
        reason: 'already_saved',
        existingPreset: matchingPreset.name
      });
    }

    console.log('🎯 [PRESET SUGGESTION] No matching preset found - Showing suggestion!');
    
    return res.json({
      success: true,
      showSuggestion: true,
      frequency,
      suggestedFilter: {
        semester: Number(semester),
        subject: subject.trim(),
        category: category || null,
        unit: unit ? Number(unit) : null
      }
    });

  } catch (error) {
    console.error('❌ [PRESET SUGGESTION] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to check preset suggestion"
    });
  }
};



/**
 * 🔹 4. Admin Overview Analytics
 */
export const getFilterAnalyticsOverview = async (req, res) => {

  const mostUsedSubjects = await FilterAnalytics.aggregate([
    {
      $group: {
        _id: "$subject",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const zeroResultFilters = await FilterAnalytics.countDocuments({
    hasResults: false
  });

  const conversions = await FilterAnalytics.countDocuments({
    downloadedAfterFilter: true
  });

  return res.json({
    success: true,
    data: {
      topSubjects: mostUsedSubjects,
      zeroResultCount: zeroResultFilters,
      totalConversions: conversions
    }
  });
};


export const getTrendingFiltersBySemester = async (req, res) => {
  const userSemester = req.user?.semester;

  if (!userSemester) {
    return res.status(400).json({
      success: false,
      message: "User semester not found"
    });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trending = await FilterAnalytics.aggregate([
    {
      $match: {
        semester: userSemester,
        createdAt: { $gte: sevenDaysAgo },
        hasResults: true
      }
    },
    {
      $group: {
        _id: {
          subject: "$subject",
          unit: "$unit",
          category: "$category"
        },
        count: { $sum: 1 },
        conversions: {
          $sum: {
            $cond: ["$downloadedAfterFilter", 1, 0]
          }
        }
      }
    },
    {
      $addFields: {
        conversionRate: {
          $cond: [
            { $eq: ["$count", 0] },
            0,
            { $divide: ["$conversions", "$count"] }
          ]
        }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 6 }
  ]);

  return res.json({
    success: true,
    semester: userSemester,
    trending
  });
};


export const getHybridFilters = async (req, res) => {
  try {
    // ✅ FIX: Get semester from query params (selected semester), fallback to user's semester
    const semester = req.query.semester 
      ? Number(req.query.semester) 
      : req.user?.semester || req.user?.academicProfile?.semester;
    
    const userId = req.user?.id || req.user?._id;

    console.log('🎯 [HYBRID] Request:', {
      userId,
      querySemester: req.query.semester,
      userSemester: req.user?.semester,
      selectedSemester: semester
    });

    if (!semester) {
      return res.status(400).json({
        success: false,
        message: "Semester not found"
      });
    }

    // ✅ Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    /**
     * 🔹 1. PERSONAL TOP FILTERS (3+ usage) for SELECTED semester
     */
    const personalTop = await FilterAnalytics.aggregate([
      {
        $match: {
          userId: userObjectId,  // ✅ Use ObjectId
          semester: Number(semester),  // ✅ Use selected semester
          hasResults: true,
          subject: { $exists: true, $ne: null }  // ✅ Must have subject
        }
      },
      {
        $group: {
          _id: {
            subject: "$subject",
            unit: "$unit",
            category: "$category"
          },
          count: { $sum: 1 },
          lastUsed: { $max: "$createdAt" }
        }
      },
      { $match: { count: { $gte: 3 } } },  // Used 3+ times
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: 3 }
    ]);

    console.log('👤 [HYBRID] Personal top filters:', personalTop.length);

    /**
     * 🔹 2. GLOBAL TRENDING (Last 7 days) for SELECTED semester
     */
    const globalTrending = await FilterAnalytics.aggregate([
      {
        $match: {
          semester: Number(semester),  // ✅ Use selected semester
          createdAt: { $gte: sevenDaysAgo },
          hasResults: true,
          subject: { $exists: true, $ne: null }  // ✅ Must have subject
        }
      },
      {
        $group: {
          _id: {
            subject: "$subject",
            unit: "$unit",
            category: "$category"
          },
          count: { $sum: 1 },
          conversions: {
            $sum: { $cond: ["$downloadedAfterFilter", 1, 0] }
          }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $eq: ["$count", 0] },
              0,
              { $multiply: [{ $divide: ["$conversions", "$count"] }, 100] }
            ]
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    console.log('🌍 [HYBRID] Global trending (7 days):', globalTrending.length);

    /**
     * 🔹 3. REMOVE DUPLICATES (exclude personal filters from trending)
     */
    const personalKeys = new Set(
      personalTop.map(item => {
        const subject = item._id.subject || '';
        const unit = item._id.unit || 'null';
        const category = item._id.category || 'null';
        return `${subject}-${unit}-${category}`;
      })
    );

    let filteredTrending = globalTrending.filter(item => {
      const subject = item._id.subject || '';
      const unit = item._id.unit || 'null';
      const category = item._id.category || 'null';
      const key = `${subject}-${unit}-${category}`;
      return !personalKeys.has(key);
    });

    let trendingTimeframe = 'week'; // Track if weekly or all-time

    /**
     * ✨ 4. FALLBACK: If no trending this week, get all-time trending
     */
    if (filteredTrending.length === 0) {
      console.log('⚠️ [HYBRID] No trending filters this week, fetching all-time...');
      
      const allTimeTrending = await FilterAnalytics.aggregate([
        {
          $match: {
            semester: Number(semester),
            hasResults: true,
            subject: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: {
              subject: "$subject",
              unit: "$unit",
              category: "$category"
            },
            count: { $sum: 1 },
            conversions: {
              $sum: { $cond: ["$downloadedAfterFilter", 1, 0] }
            }
          }
        },
        {
          $addFields: {
            conversionRate: {
              $cond: [
                { $eq: ["$count", 0] },
                0,
                { $multiply: [{ $divide: ["$conversions", "$count"] }, 100] }
              ]
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]);

      console.log('📊 [HYBRID] All-time trending found:', allTimeTrending.length);

      // Remove duplicates from all-time trending too
      filteredTrending = allTimeTrending.filter(item => {
        const subject = item._id.subject || '';
        const unit = item._id.unit || 'null';
        const category = item._id.category || 'null';
        const key = `${subject}-${unit}-${category}`;
        return !personalKeys.has(key);
      });

      trendingTimeframe = 'all-time';
    }

    console.log('✅ [HYBRID] Final results:', {
      semester,
      recommended: personalTop.length,
      trending: filteredTrending.length,
      trendingTimeframe
    });

    return res.json({
      success: true,
      semester,
      recommended: personalTop,
      trending: filteredTrending,
      trendingTimeframe  // ✨ NEW: 'week' or 'all-time'
    });

  } catch (error) {
    console.error('❌ [HYBRID] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hybrid filters"
    });
  }
};



/**
 * 📊 Get Top Downloaded Notes by Filter
 */
export const getTopDownloadedNotes = async (req, res) => {
  try {
    const { semester, subject, days = 30 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const topNotes = await FilterAnalytics.aggregate([
      {
        $match: {
          downloadedAfterFilter: true,
          downloadedAt: { $gte: dateLimit },
          ...(semester && { semester: Number(semester) }),
          ...(subject && { subject: subject.toLowerCase() })
        }
      },
      {
        $group: {
          _id: "$downloadedNoteId",
          downloads: { $sum: 1 },
          avgTimeToDownload: { $avg: "$timeToDownload" }
        }
      },
      { $sort: { downloads: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "notes",
          localField: "_id",
          foreignField: "_id",
          as: "note"
        }
      },
      { $unwind: "$note" }
    ]);

    return res.json({
      success: true,
      data: topNotes
    });
  } catch (error) {
    console.error('Error fetching top notes:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top notes"
    });
  }
};

/**
 * 📊 Get Conversion Funnel Metrics
 */
export const getConversionFunnel = async (req, res) => {
  try {
    const { semester, days = 7 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const funnel = await FilterAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: dateLimit },
          ...(semester && { semester: Number(semester) })
        }
      },
      {
        $group: {
          _id: null,
          totalFilters: { $sum: 1 },
          filtersWithResults: {
            $sum: { $cond: ["$hasResults", 1, 0] }
          },
          filtersWithDownloads: {
            $sum: { $cond: ["$downloadedAfterFilter", 1, 0] }
          },
          avgTimeToDownload: {
            $avg: { $cond: ["$timeToDownload", "$timeToDownload", null] }
          }
        }
      }
    ]);

    const data = funnel[0] || {};
    
    return res.json({
      success: true,
      funnel: {
        totalFilters: data.totalFilters || 0,
        withResults: data.filtersWithResults || 0,
        withDownloads: data.filtersWithDownloads || 0,
        conversionRate: data.totalFilters 
          ? ((data.filtersWithDownloads / data.totalFilters) * 100).toFixed(2)
          : 0,
        avgTimeToDownload: data.avgTimeToDownload 
          ? `${(data.avgTimeToDownload / 1000).toFixed(1)}s`
          : 'N/A'
      }
    });
  } catch (error) {
    console.error('Error fetching conversion funnel:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch funnel metrics"
    });
  }
};


/**
 * ✨ Update Engagement Metrics
 */
export const updateEngagementMetrics = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"];
    const { scrollDepth, timeOnResults } = req.body;

    console.log('📊 [ENGAGEMENT] Update request:', {
      sessionId,
      scrollDepth,
      timeOnResults
    });

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID required"
      });
    }

    // ✅ Update most recent filter entry
    const updated = await FilterAnalytics.findOneAndUpdate(
      { 
        sessionId, 
        downloadedAfterFilter: false 
      },
      { 
        $max: {  // ✅ Only increase, never decrease
          'engagement.scrollDepth': scrollDepth || 0,
          'engagement.timeOnResults': timeOnResults || 0
        }
      },
      { 
        sort: { createdAt: -1 },
        new: true 
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "No active filter session"
      });
    }

    console.log('✅ [ENGAGEMENT] Updated:', {
      scrollDepth: updated.engagement.scrollDepth,
      timeOnResults: updated.engagement.timeOnResults
    });

    return res.json({
      success: true,
      message: "Engagement updated"
    });

  } catch (error) {
    console.error('❌ [ENGAGEMENT] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update engagement"
    });
  }
};

/**
 * ✨ Mark Filter as Saved Preset
 */
export const markFilterSavedAsPreset = async (req, res) => {
  try {
    const sessionId = req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID required"
      });
    }

    const updated = await FilterAnalytics.findOneAndUpdate(
      { sessionId, downloadedAfterFilter: false },
      { savedAsPreset: true },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "No active filter session"
      });
    }

    console.log('💾 [PRESET] Marked as saved:', sessionId);

    return res.json({
      success: true,
      message: "Filter marked as saved preset"
    });

  } catch (error) {
    console.error('❌ [PRESET] Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark preset"
    });
  }
};


/**
 * 📊 Get Most Viewed Notes (without downloads)
 * Shows which notes users click but don't download (quality issues?)
 */
export const getMostViewedNotes = async (req, res) => {
  try {
    const { semester, subject, days = 30, limit = 20 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const pipeline = [
      {
        $match: {
          'viewedNotes.0': { $exists: true },  // Has at least one view
          createdAt: { $gte: dateLimit },
          ...(semester && { semester: Number(semester) }),
          ...(subject && { subject: subject.toLowerCase() })
        }
      },
      { $unwind: '$viewedNotes' },
      {
        $group: {
          _id: '$viewedNotes.noteId',
          views: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
          lastViewedAt: { $max: '$viewedNotes.viewedAt' }
        }
      },
      {
        $addFields: {
          uniqueViewers: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'notes',
          localField: '_id',
          foreignField: '_id',
          as: 'noteDetails'
        }
      },
      { $unwind: '$noteDetails' },
      {
        $project: {
          noteId: '$_id',
          views: 1,
          uniqueViewers: 1,
          lastViewedAt: 1,
          title: '$noteDetails.title',
          subject: '$noteDetails.subject',
          category: '$noteDetails.category',
          semester: '$noteDetails.semester'
        }
      }
    ];

    const mostViewed = await FilterAnalytics.aggregate(pipeline);

    return res.json({
      success: true,
      period: `${days} days`,
      totalNotes: mostViewed.length,
      data: mostViewed
    });

  } catch (error) {
    console.error('❌ Error fetching most viewed notes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch most viewed notes'
    });
  }
};

/**
 * 🚨 Get Content Gaps - What users search for but can't find
 * PRIORITY: Shows where to add more content
 */
export const getContentGaps = async (req, res) => {
  try {
    const { days = 30, minSearches = 3 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const gaps = await FilterAnalytics.aggregate([
      {
        $match: {
          hasResults: false,  // ✅ No results found
          createdAt: { $gte: dateLimit },
          subject: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            semester: '$semester',
            subject: '$subject',
            category: '$category',
            unit: '$unit'
          },
          searchCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          lastSearched: { $max: '$createdAt' }
        }
      },
      {
        $match: {
          searchCount: { $gte: Number(minSearches) }  // Multiple users want this
        }
      },
      {
        $addFields: {
          uniqueUsersCount: { $size: '$uniqueUsers' },
          priority: {  // Calculate priority score
            $add: [
              { $multiply: ['$searchCount', 2] },  // Weight by frequency
              { $multiply: ['$_id.unit', 0.5] }    // Later units = higher priority
            ]
          }
        }
      },
      { $sort: { priority: -1, searchCount: -1 } },
      { $limit: 50 },
      {
        $project: {
          semester: '$_id.semester',
          subject: '$_id.subject',
          category: '$_id.category',
          unit: '$_id.unit',
          searchCount: 1,
          uniqueUsersCount: 1,
          lastSearched: 1,
          priority: 1
        }
      }
    ]);

    return res.json({
      success: true,
      message: 'Content gaps identified - prioritize creating these materials',
      period: `${days} days`,
      totalGaps: gaps.length,
      data: gaps
    });

  } catch (error) {
    console.error('❌ Error fetching content gaps:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch content gaps'
    });
  }
};

/**
 * 📈 Get Subject Performance Analytics
 * Shows which subjects have best engagement, conversion, etc.
 */
export const getSubjectPerformance = async (req, res) => {
  try {
    const { semester, days = 30 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const performance = await FilterAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: dateLimit },
          subject: { $exists: true, $ne: null },
          ...(semester && { semester: Number(semester) })
        }
      },
      {
        $group: {
          _id: {
            semester: '$semester',
            subject: '$subject'
          },
          totalSearches: { $sum: 1 },
          withResults: {
            $sum: { $cond: ['$hasResults', 1, 0] }
          },
          downloads: {
            $sum: { $cond: ['$downloadedAfterFilter', 1, 0] }
          },
          avgTimeToDownload: {
            $avg: { $cond: ['$timeToDownload', '$timeToDownload', null] }
          },
          avgScrollDepth: { $avg: '$engagement.scrollDepth' },
          avgTimeOnPage: { $avg: '$engagement.timeOnResults' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $multiply: [
              { $divide: ['$downloads', '$totalSearches'] },
              100
            ]
          },
          successRate: {
            $multiply: [
              { $divide: ['$withResults', '$totalSearches'] },
              100
            ]
          },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          engagementScore: {  // Custom engagement metric
            $add: [
              { $multiply: ['$avgScrollDepth', 0.4] },
              { $multiply: ['$avgTimeOnPage', 0.3] },
              { $multiply: [{ $divide: ['$downloads', '$totalSearches'] }, 30] }
            ]
          }
        }
      },
      { $sort: { totalSearches: -1 } },
      {
        $project: {
          semester: '$_id.semester',
          subject: '$_id.subject',
          totalSearches: 1,
          withResults: 1,
          downloads: 1,
          conversionRate: { $round: ['$conversionRate', 2] },
          successRate: { $round: ['$successRate', 2] },
          avgTimeToDownload: {
            $round: [{ $divide: ['$avgTimeToDownload', 1000] }, 1]  // Convert to seconds
          },
          avgScrollDepth: { $round: ['$avgScrollDepth', 1] },
          avgTimeOnPage: { $round: ['$avgTimeOnPage', 1] },
          uniqueUsersCount: 1,
          engagementScore: { $round: ['$engagementScore', 2] }
        }
      }
    ]);

    return res.json({
      success: true,
      period: `${days} days`,
      totalSubjects: performance.length,
      data: performance
    });

  } catch (error) {
    console.error('❌ Error fetching subject performance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subject performance'
    });
  }
};

/**
 * 📱 Get Device/Platform Analytics
 * Understand mobile vs desktop usage patterns
 */
export const getDeviceAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const deviceStats = await FilterAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: dateLimit },
          'deviceInfo.platform': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            platform: '$deviceInfo.platform',
            browser: '$deviceInfo.browser'
          },
          totalSessions: { $sum: 1 },
          downloads: {
            $sum: { $cond: ['$downloadedAfterFilter', 1, 0] }
          },
          avgScrollDepth: { $avg: '$engagement.scrollDepth' },
          avgTimeOnPage: { $avg: '$engagement.timeOnResults' },
          avgTimeToDownload: {
            $avg: { $cond: ['$timeToDownload', '$timeToDownload', null] }
          }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $multiply: [
              { $divide: ['$downloads', '$totalSessions'] },
              100
            ]
          }
        }
      },
      { $sort: { totalSessions: -1 } },
      {
        $project: {
          platform: '$_id.platform',
          browser: '$_id.browser',
          totalSessions: 1,
          downloads: 1,
          conversionRate: { $round: ['$conversionRate', 2] },
          avgScrollDepth: { $round: ['$avgScrollDepth', 1] },
          avgTimeOnPage: { $round: ['$avgTimeOnPage', 1] },
          avgTimeToDownload: {
            $round: [{ $divide: ['$avgTimeToDownload', 1000] }, 1]
          }
        }
      }
    ]);

    // ✅ Calculate platform breakdown
    const platformSummary = deviceStats.reduce((acc, stat) => {
      const platform = stat.platform;
      if (!acc[platform]) {
        acc[platform] = {
          platform,
          totalSessions: 0,
          downloads: 0,
          browsers: []
        };
      }
      acc[platform].totalSessions += stat.totalSessions;
      acc[platform].downloads += stat.downloads;
      acc[platform].browsers.push({
        browser: stat.browser,
        sessions: stat.totalSessions
      });
      return acc;
    }, {});

    return res.json({
      success: true,
      period: `${days} days`,
      detailed: deviceStats,
      summary: Object.values(platformSummary)
    });

  } catch (error) {
    console.error('❌ Error fetching device analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch device analytics'
    });
  }
};

/**
 * ⏰ Get Peak Usage Times
 * Understand when users are most active (for scheduled uploads, maintenance)
 */
export const getPeakUsageTimes = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.setDate(dateLimit.getDate() - days));

    const usageByHour = await FilterAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: dateLimit }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
            dayOfWeek: { $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Kolkata' } }
          },
          sessions: { $sum: 1 },
          downloads: {
            $sum: { $cond: ['$downloadedAfterFilter', 1, 0] }
          },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          uniqueUsersCount: { $size: '$uniqueUsers' },
          dayName: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id.dayOfWeek', 1] }, then: 'Sunday' },
                { case: { $eq: ['$_id.dayOfWeek', 2] }, then: 'Monday' },
                { case: { $eq: ['$_id.dayOfWeek', 3] }, then: 'Tuesday' },
                { case: { $eq: ['$_id.dayOfWeek', 4] }, then: 'Wednesday' },
                { case: { $eq: ['$_id.dayOfWeek', 5] }, then: 'Thursday' },
                { case: { $eq: ['$_id.dayOfWeek', 6] }, then: 'Friday' },
                { case: { $eq: ['$_id.dayOfWeek', 7] }, then: 'Saturday' }
              ],
              default: 'Unknown'
            }
          }
        }
      },
      { $sort: { sessions: -1 } },
      {
        $project: {
          hour: '$_id.hour',
          dayOfWeek: '$dayName',
          sessions: 1,
          downloads: 1,
          uniqueUsersCount: 1
        }
      }
    ]);

    // Find peak hour overall
    const peakHour = usageByHour.reduce((max, curr) => 
      curr.sessions > (max?.sessions || 0) ? curr : max
    , null);

    return res.json({
      success: true,
      period: `${days} days`,
      peakHour: peakHour ? `${peakHour.hour}:00-${peakHour.hour + 1}:00` : 'N/A',
      peakDay: peakHour?.dayOfWeek || 'N/A',
      hourlyBreakdown: usageByHour
    });

  } catch (error) {
    console.error('❌ Error fetching peak usage times:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch peak usage times'
    });
  }
};

/**
 * 🎯 Get Popular Filter Combinations
 * Shows which filters users commonly use together
 */
export const getPopularFilterCombinations = async (req, res) => {
  try {
    const { semester, days = 30, minOccurrences = 5 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const combinations = await FilterAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: dateLimit },
          hasResults: true,
          ...(semester && { semester: Number(semester) })
        }
      },
      {
        $group: {
          _id: {
            semester: '$semester',
            subject: '$subject',
            category: '$category',
            unit: '$unit'
          },
          occurrences: { $sum: 1 },
          downloads: {
            $sum: { $cond: ['$downloadedAfterFilter', 1, 0] }
          },
          uniqueUsers: { $addToSet: '$userId' },
          avgTimeToDownload: {
            $avg: { $cond: ['$timeToDownload', '$timeToDownload', null] }
          }
        }
      },
      {
        $match: {
          occurrences: { $gte: Number(minOccurrences) }
        }
      },
      {
        $addFields: {
          uniqueUsersCount: { $size: '$uniqueUsers' },
          conversionRate: {
            $multiply: [
              { $divide: ['$downloads', '$occurrences'] },
              100
            ]
          }
        }
      },
      { $sort: { occurrences: -1 } },
      { $limit: 30 },
      {
        $project: {
          semester: '$_id.semester',
          subject: '$_id.subject',
          category: '$_id.category',
          unit: '$_id.unit',
          occurrences: 1,
          downloads: 1,
          uniqueUsersCount: 1,
          conversionRate: { $round: ['$conversionRate', 2] },
          avgTimeToDownload: {
            $round: [{ $divide: ['$avgTimeToDownload', 1000] }, 1]
          }
        }
      }
    ]);

    return res.json({
      success: true,
      period: `${days} days`,
      totalCombinations: combinations.length,
      data: combinations
    });

  } catch (error) {
    console.error('❌ Error fetching filter combinations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filter combinations'
    });
  }
};
/**
 * 📋 Get Admin Dashboard Summary
 * Single endpoint for overview metrics
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    // Run all queries in parallel
    const [
      totalFilters,
      totalDownloads,
      zeroResults,
      avgEngagement,
      deviceBreakdown,
      topSubjects
    ] = await Promise.all([
      // Total filter searches
      FilterAnalytics.countDocuments({
        createdAt: { $gte: dateLimit }
      }),

      // Total downloads
      FilterAnalytics.countDocuments({
        createdAt: { $gte: dateLimit },
        downloadedAfterFilter: true
      }),

      // Zero result searches (content gaps)
      FilterAnalytics.countDocuments({
        createdAt: { $gte: dateLimit },
        hasResults: false
      }),

      // Average engagement metrics
      FilterAnalytics.aggregate([
        {
          $match: {
            createdAt: { $gte: dateLimit }
          }
        },
        {
          $group: {
            _id: null,
            avgScrollDepth: { $avg: '$engagement.scrollDepth' },
            avgTimeOnPage: { $avg: '$engagement.timeOnResults' },
            avgTimeToDownload: {
              $avg: { $cond: ['$timeToDownload', '$timeToDownload', null] }
            }
          }
        }
      ]),

      // Device breakdown
      FilterAnalytics.aggregate([
        {
          $match: {
            createdAt: { $gte: dateLimit },
            'deviceInfo.platform': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$deviceInfo.platform',
            count: { $sum: 1 }
          }
        }
      ]),

      // Top 5 subjects
      FilterAnalytics.aggregate([
        {
          $match: {
            createdAt: { $gte: dateLimit },
            subject: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$subject',
            searches: { $sum: 1 },
            downloads: {
              $sum: { $cond: ['$downloadedAfterFilter', 1, 0] }
            }
          }
        },
        { $sort: { searches: -1 } },
        { $limit: 5 }
      ])
    ]);

    const engagement = avgEngagement[0] || {};
    const conversionRate = totalFilters > 0 
      ? ((totalDownloads / totalFilters) * 100).toFixed(2)
      : 0;

    return res.json({
      success: true,
      period: `${days} days`,
      overview: {
        totalSearches: totalFilters,
        totalDownloads,
        conversionRate: `${conversionRate}%`,
        zeroResults,
        zeroResultRate: totalFilters > 0 
          ? `${((zeroResults / totalFilters) * 100).toFixed(2)}%`
          : '0%'
      },
      engagement: {
        avgScrollDepth: engagement.avgScrollDepth?.toFixed(1) || '0',
        avgTimeOnPage: engagement.avgTimeOnPage?.toFixed(1) || '0',
        avgTimeToDownload: engagement.avgTimeToDownload 
          ? `${(engagement.avgTimeToDownload / 1000).toFixed(1)}s`
          : 'N/A'
      },
      devices: deviceBreakdown,
      topSubjects
    });

  } catch (error) {
    console.error('❌ Error fetching admin dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard'
    });
  }
};
