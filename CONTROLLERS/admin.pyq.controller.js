// CONTROLLERS/admin.pyq.controller.js
import asyncHandler from "express-async-handler";
import SubjectMeta      from "../MODELS/SubjectMeta.model.js";
import SubjectAnalytics from "../MODELS/SubjectAnalytics.model.js";
import PYQInsightsFeed  from "../MODELS/PYQInsightsFeed.model.js";
import AdminUploadLog   from "../MODELS/AdminUploadLog.model.js";
import {
  bulkInsertQuestions     as insertQuestions,
  recalculateAnalytics    as recomputeAnalytics,
  getUnmappedQueue        as fetchUnmappedQueue,
  resolveUnmappedQuestion as resolveQuestion,
} from "../services/analytics.service.js";

// ─────────────────────────────────────────────────────────────────
// SUBJECT META
// ─────────────────────────────────────────────────────────────────

export const getAllSubjectsMeta = asyncHandler(async (req, res) => {
  const subjects = await SubjectMeta.find({}).sort({ semester: 1 }).lean();
  res.status(200).json({ success: true, count: subjects.length, data: subjects });
});

export const getSubjectMeta = asyncHandler(async (req, res) => {
  const subject = await SubjectMeta.findById(req.params.subjectCode).lean();
  if (!subject) {
    return res.status(404).json({
      success: false,
      message: `Subject not found: ${req.params.subjectCode}`,
    });
  }
  res.status(200).json({ success: true, data: subject });
});

export const createSubjectMeta = asyncHandler(async (req, res) => {
  const existing = await SubjectMeta.findById(req.body._id);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Subject already exists: ${req.body._id}`,
    });
  }
  const subject = await SubjectMeta.create(req.body);
  res.status(201).json({ success: true, message: "Subject meta created", data: subject });
});

export const updateSubjectMeta = asyncHandler(async (req, res) => {
  const subject = await SubjectMeta.findByIdAndUpdate(
    req.params.subjectCode,
    { ...req.body, updatedAt: new Date() },
    { new: true, runValidators: true }
  );
  if (!subject) {
    return res.status(404).json({
      success: false,
      message: `Subject not found: ${req.params.subjectCode}`,
    });
  }
  res.status(200).json({ success: true, message: "Subject meta updated", data: subject });
});

// ─────────────────────────────────────────────────────────────────
// PAPER UPLOAD
// ─────────────────────────────────────────────────────────────────

export const uploadPaper = asyncHandler(async (req, res) => {
  const { subjectCode, academicYear, year, examType, questions, claudeCallId } = req.body;

  if (!subjectCode || !year || !examType || !questions?.length) {
    return res.status(400).json({
      success: false,
      message: "subjectCode, year, examType, and questions[] are required",
    });
  }

  // ── Resolve paper code → canonical subject
  // subjectCode from body could be "KCS401", "RCS401", or "BCS401"
  // we look up which SubjectMeta document owns this paper code
  const subject = await SubjectMeta.findOne({ paperCodes: subjectCode }).lean();

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: `No subject found for paper code "${subjectCode}". Add it to SubjectMeta.paperCodes first.`,
    });
  }

  const canonicalSubjectCode = subject._id;  // "OS"
  const originalPaperCode    = subjectCode;  // "KCS401"

  const result = await insertQuestions({
    subjectCode:      canonicalSubjectCode,   // ← "OS" goes into DB
    originalPaperCode: originalPaperCode,     // ← "KCS401" preserved for audit
    academicYear:     academicYear || `${year - 1}-${String(year).slice(2)}`,
    year:             Number(year),
    examType,
    questions,
    claudeCallId:     claudeCallId || null,
    uploadedBy:       req.user._id,
  });

  res.status(201).json({
    success: true,
    message: result.needsReview
      ? `Paper uploaded. ${result.unmappedCount} questions need mapping before analytics update.`
      : "Paper uploaded and analytics recalculated successfully.",
    data: result,
  });
});


export const getAllUploadLogs = asyncHandler(async (req, res) => {
  const { status, subjectCode } = req.query;
  const query = {};
  if (status)      query.status      = status;
  if (subjectCode) query.subjectCode = subjectCode;

  const logs = await AdminUploadLog.find(query).sort({ processedAt: -1 }).lean();
  res.status(200).json({ success: true, count: logs.length, data: logs });
});

export const getPaperUploadStatus = asyncHandler(async (req, res) => {
  const subjectCode = req.params.subjectCode.trim(); // ← add .trim()
  const logs = await AdminUploadLog
    .find({ subjectCode })
    .sort({ year: -1 })
    .lean();
  res.status(200).json({ success: true, count: logs.length, data: logs });
});


// ─────────────────────────────────────────────────────────────────
// UNMAPPED QUEUE
// ─────────────────────────────────────────────────────────────────

export const getUnmappedQueue = asyncHandler(async (req, res) => {
  // ✅ aliased service call
  const result = await fetchUnmappedQueue(req.params.subjectCode.trim());
  res.status(200).json({ success: true, data: result });
});

export const resolveUnmappedQuestion = asyncHandler(async (req, res) => {
  // ✅ aliased service call
  const result = await resolveQuestion(req.body);
  res.status(200).json({
    success: true,
    message: result.remainingUnmapped === 0
      ? "All questions mapped. Analytics recalculated."
      : `Question mapped. ${result.remainingUnmapped} still pending.`,
    data: result,
  });
});

export const ignoreUnmappedQuestion = asyncHandler(async (req, res) => {
  const { logId, qId } = req.body;

  await AdminUploadLog.updateOne(
    { _id: logId, "unmappedQueue.qId": qId },
    {
      $set: {
        "unmappedQueue.$.status":     "IGNORED",
        "unmappedQueue.$.resolvedAt": new Date(),
      },
      $inc: { unmappedCount: -1 },
    }
  );

  res.status(200).json({ success: true, message: "Question ignored and removed from queue" });
});

// ─────────────────────────────────────────────────────────────────
// ANALYTICS CONTROL
// ─────────────────────────────────────────────────────────────────

export const triggerRecalculation = asyncHandler(async (req, res) => {
  const { subjectCode } = req.params;

  // ✅ aliased service call
  const analytics = await recomputeAnalytics(subjectCode);

  res.status(200).json({
    success: true,
    message: `Analytics recalculated for ${subjectCode}`,
    data: {
      subjectCode,
      totalPapersAnalysed:    analytics.totalPapersAnalysed,
      totalQuestionsAnalysed: analytics.totalQuestionsAnalysed,
      yearsCovered:           analytics.academicYearsCovered,
      lastRecalculated:       analytics.lastRecalculated,
    },
  });
});

export const getAnalyticsStatus = asyncHandler(async (req, res) => {
  const [subjects, analytics, staleFeedsCount] = await Promise.all([
    SubjectMeta.find({}, { _id: 1, name: 1, analyticsReady: 1, totalPapersAnalysed: 1 }).lean(),
    SubjectAnalytics.find({}, { subjectCode: 1, lastRecalculated: 1, totalQuestionsAnalysed: 1 }).lean(),
    PYQInsightsFeed.countDocuments({ isStale: true }),
  ]);

  const analyticsMap = {};
  analytics.forEach((a) => { analyticsMap[a.subjectCode] = a; });

  const status = subjects.map((s) => ({
    subjectCode:            s._id,
    name:                   s.name,
    analyticsReady:         s.analyticsReady,
    totalPapersAnalysed:    s.totalPapersAnalysed,
    lastRecalculated:       analyticsMap[s._id]?.lastRecalculated || null,
    totalQuestionsAnalysed: analyticsMap[s._id]?.totalQuestionsAnalysed || 0,
  }));

  res.status(200).json({
    success: true,
    staleInsightFeeds: staleFeedsCount,
    data: status,
  });
});

// ─────────────────────────────────────────────────────────────────
// INSIGHT CARDS
// ─────────────────────────────────────────────────────────────────

export const getInsightsFeed = asyncHandler(async (req, res) => {
  const feeds = await PYQInsightsFeed
    .find({ subjectCode: req.params.subjectCode })
    .sort({ unitId: 1 })
    .lean();
  res.status(200).json({ success: true, count: feeds.length, data: feeds });
});

export const regenerateInsightCards = asyncHandler(async (req, res) => {
  const { subjectCode }   = req.params;
  const { unitId, cards } = req.body;

  if (!unitId || !cards?.length) {
    return res.status(400).json({ success: false, message: "unitId and cards[] are required" });
  }

  const feed = await PYQInsightsFeed.findOneAndUpdate(
    { subjectCode, unitId },
    { subjectCode, unitId, cards, generatedAt: new Date(), editedByAdmin: false, isStale: false },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    message: `Insight cards updated for ${subjectCode} / ${unitId}`,
    data:    feed,
  });
});

export const updateInsightCard = asyncHandler(async (req, res) => {
  const { subjectCode, cardId }          = req.params;
  const { headline, subtext, confidence, tag } = req.body;

  const update = { editedByAdmin: true };
  if (headline)   update["cards.$.headline"]  = headline;
  if (subtext)    update["cards.$.subtext"]    = subtext;
  if (confidence) update["cards.$.confidence"] = confidence;
  if (tag)        update["cards.$.tag"]        = tag;

  const feed = await PYQInsightsFeed.findOneAndUpdate(
    { subjectCode, "cards.cardId": cardId },
    { $set: update },
    { new: true }
  );

  if (!feed) {
    return res.status(404).json({ success: false, message: `Card not found: ${cardId}` });
  }

  res.status(200).json({
    success: true,
    message: "Card updated",
    data:    feed.cards.find((c) => c.cardId === cardId),
  });
});

export const toggleCardLock = asyncHandler(async (req, res) => {
  const { subjectCode, cardId } = req.params;
  const { isLocked }            = req.body;

  const feed = await PYQInsightsFeed.findOneAndUpdate(
    { subjectCode, "cards.cardId": cardId },
    { $set: { "cards.$.isLocked": isLocked, editedByAdmin: true } },
    { new: true }
  );

  if (!feed) {
    return res.status(404).json({ success: false, message: `Card not found: ${cardId}` });
  }

  res.status(200).json({
    success: true,
    message: `Card ${isLocked ? "locked" : "unlocked"}`,
    data:    feed.cards.find((c) => c.cardId === cardId),
  });
});

export const toggleCardVisibility = asyncHandler(async (req, res) => {
  const { subjectCode, cardId } = req.params;
  const { isVisible }           = req.body;

  const feed = await PYQInsightsFeed.findOneAndUpdate(
    { subjectCode, "cards.cardId": cardId },
    { $set: { "cards.$.isVisible": isVisible, editedByAdmin: true } },
    { new: true }
  );

  if (!feed) {
    return res.status(404).json({ success: false, message: `Card not found: ${cardId}` });
  }

  res.status(200).json({
    success: true,
    message: `Card ${isVisible ? "visible" : "hidden"}`,
    data:    feed.cards.find((c) => c.cardId === cardId),
  });
});

export const deleteInsightFeed = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.params;

  const deleted = await PYQInsightsFeed.findOneAndDelete({ subjectCode, unitId });

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: `No insight feed found for ${subjectCode} / ${unitId}`,
    });
  }

  res.status(200).json({
    success: true,
    message: `Insight feed deleted for ${subjectCode} / ${unitId}`,
    data: {
      subjectCode: deleted.subjectCode,
      unitId:      deleted.unitId,
      cardsDeleted: deleted.cards.length,
    },
  });
});