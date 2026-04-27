// CONTROLLERS/pyq.controller.js
import asyncHandler from "express-async-handler";
import SubjectMeta      from "../MODELS/SubjectMeta.model.js";
import SubjectAnalytics from "../MODELS/SubjectAnalytics.model.js";
import PYQInsightsFeed  from "../MODELS/PYQInsightsFeed.model.js";
import PYQQuestion from "../MODELS/PYQQuestion.model.js";
import AdminUploadLog   from "../MODELS/AdminUploadLog.model.js";
import { sanitizeSubjectName } from "../UTIL/sanitizeSubjectName.js";
// ✅ ADD THIS LINE
import { recalculateAnalytics as recomputeAnalytics } from "../services/analytics.service.js";
import {
  getUnitQuestions    as fetchUnitQuestions,
  getTopicQuestions   as fetchTopicQuestions,
  getYearComparisonMatrix as fetchYearMatrix,
} from "../services/analytics.service.js";

const FREE_CARDS_LIMIT = 3;

const isPaidUser = (user) => {
  return user?.plan === "PRO" || user?.plan === "PREMIUM";
};
// CONTROLLERS/pyq.controller.js

// ── helper: generate a one-line hook sentence from units + topics ──────────
function buildQuickInsight(units, analyticsDoc) {
  // ── 1. Heaviest unit by avgMarksPerPaper
  const heaviest = [...units].sort(
    (a, b) => (b.avgMarksPerPaper ?? 0) - (a.avgMarksPerPaper ?? 0)
  )[0];

  // ── 2. Most repeated topic (across ALL units) — needs topics from analytics
  let hotTopicName = null;
  if (analyticsDoc?.units?.length) {
    let topTopic = null;
    for (const u of analyticsDoc.units) {
      for (const t of u.topics ?? []) {
        if (
          !topTopic ||
          (t.totalAppearances ?? 0) > (topTopic.totalAppearances ?? 0)
        ) {
          topTopic = t;
        }
      }
    }
    if (topTopic?.totalAppearances >= 3) {
      // Only mention if genuinely recurring (3+ papers)
      hotTopicName = topTopic.canonicalName;
    }
  }

  // ── 3. Build sentence
  const parts = [];

  if (hotTopicName) {
    parts.push(`${hotTopicName} asked every year`);
  }

  if (heaviest) {
    parts.push(`Unit ${heaviest.unitNumber} carries the most marks`);
  }

  return parts.length ? parts.join(" · ") : null;
}
// GET /api/v1/pyq/subjects
export const getAllSubjects = asyncHandler(async (req, res) => {
  const subjects = await SubjectMeta.find(
    {},
    {
      _id:                 1,
      name:                1,
      code:                1,
      semester:            1,
      branch:              1,
      analyticsReady:      1,
      totalPapersAnalysed: 1,
      totalUnits:          1,
    }
  )
    .sort({ semester: 1, name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count:   subjects.length,
    data:    subjects,
  });
});

// GET /api/v1/pyq/:subjectCode/analytics
// CONTROLLERS/pyq.controller.js
// GET /api/v1/pyq/:subjectCode/analytics
export const getSubjectAnalytics = asyncHandler(async (req, res) => {
  const { subjectCode } = req.params;

  const [analytics, subjectMeta] = await Promise.all([
    SubjectAnalytics.findOne({ subjectCode }).lean(),
    SubjectMeta.findById(subjectCode, { semester: 1, name: 1, code: 1 }).lean(),
  ]);

  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: `Analytics not ready for subject: ${subjectCode}`,
    });
  }

  const units = analytics.units.map((u) => ({
    unitId:           u.unitId,
    unitNumber:       u.unitNumber,
    title:            u.title,
    frequencyScore:   u.frequencyScore,
    avgMarksPerPaper: u.avgMarksPerPaper,
    priorityRank:     u.priorityRank,
    predictionTag:    u.predictionTag,
    topTopics:        u.topics
      .sort((a, b) => b.totalAppearances - a.totalAppearances)
      .slice(0, 3)
      .map((t) => ({
        topicId:          t.topicId,
        canonicalName:    t.canonicalName,
        totalAppearances: t.totalAppearances,
        lastAskedYear:    t.lastAskedYear,
        predictionTag:    t.predictionTag,
        predictionScore:  t.predictionScore,
      })),
    neverAsked:        u.neverAsked,
    repeatedEveryYear: u.repeatedEveryYear,
    dueForComeback:    u.dueForComeback,
  }));

  res.status(200).json({
    success: true,
    data: {
      subjectCode:            analytics.subjectCode,
      subjectName:            subjectMeta?.name     ?? subjectCode,  // ← NEW
      semester:               subjectMeta?.semester ?? [],            // ← NEW
      totalPapersAnalysed:    analytics.totalPapersAnalysed,
      totalQuestionsAnalysed: analytics.totalQuestionsAnalysed,
      yearsCovered:           analytics.yearsCovered,
      academicYearsCovered:   analytics.academicYearsCovered,
      lastRecalculated:       analytics.lastRecalculated,
      units,
      overallInsights:        analytics.overallInsights,
      trustMeta:              analytics.trustMeta,
    },
  });
});
// GET /api/v1/pyq/:subjectCode/units/:unitId
export const getUnitAnalytics = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.params;

  const analytics = await SubjectAnalytics.findOne(
    { subjectCode },
    { units: 1, trustMeta: 1, totalPapersAnalysed: 1 }
  ).lean();

  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: `Analytics not found for: ${subjectCode}`,
    });
  }

  const unit = analytics.units.find((u) => u.unitId === unitId);
  if (!unit) {
    return res.status(404).json({
      success: false,
      message: `Unit not found: ${unitId}`,
    });
  }

  const sortedTopics = [...unit.topics].sort(
    (a, b) => (b.predictionScore || 0) - (a.predictionScore || 0)
  );

  res.status(200).json({
    success: true,
    data: {
      ...unit,
      topics:    sortedTopics,
      trustMeta: analytics.trustMeta,
    },
  });
});

// GET /api/v1/pyq/:subjectCode/units/:unitId/questions
export const getUnitQuestions = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.params;
  const { markType, year, topicId, isRepeat, hasDiagram } = req.query;

  const filters = {};
  if (markType)              filters.markType   = markType;
  if (year)                  filters.year       = year;
  if (topicId)               filters.topicId    = topicId;
  if (isRepeat   === "true") filters.isRepeat   = true;
  if (hasDiagram === "true") filters.hasDiagram = true;

  // ✅ calls the ALIASED service function — no conflict
  const result = await fetchUnitQuestions(subjectCode, unitId, filters);

  res.status(200).json({
    success: true,
    data:    result,
  });
});

// GET /api/v1/pyq/:subjectCode/topics/:topicId/questions
export const getTopicQuestions = asyncHandler(async (req, res) => {
  const { subjectCode, topicId } = req.params;

  // ✅ calls the ALIASED service function — no conflict
  const result = await fetchTopicQuestions(subjectCode, topicId);

  res.status(200).json({
    success: true,
    data:    result,
  });
});

// GET /api/v1/pyq/:subjectCode/units/:unitId/matrix
export const getYearMatrix = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.params;

  // ✅ calls the ALIASED service function — no conflict
  const result = await fetchYearMatrix(subjectCode, unitId);

  res.status(200).json({
    success: true,
    data:    result,
  });
});

// GET /api/v1/pyq/:subjectCode/insights?unitId=CN-U3
export const getInsightCards = asyncHandler(async (req, res) => {
  const { subjectCode } = req.params;
  const { unitId }      = req.query;
  const user            = req.user;
  const paid            = isPaidUser(user);

  const query = { subjectCode };
  if (unitId) query.unitId = unitId;

  const feeds = await PYQInsightsFeed.find(query).lean();

  if (!feeds.length) {
    return res.status(404).json({
      success: false,
      message: "Insight cards not generated yet for this subject",
    });
  }

  const result = feeds.map((feed) => {
    const cards = feed.cards
      .filter((c) => c.isVisible)
      .sort((a, b) => a.priority - b.priority)
      .map((card, index) => {
        const isLocked = !paid && (card.isLocked || index >= FREE_CARDS_LIMIT);
        return {
          cardId:         card.cardId,
          type:           card.type,
          priority:       card.priority,
          tag:            card.tag,
          headline:       card.headline,
          subtext:        isLocked ? null : card.subtext,
          confidence:     isLocked ? null : card.confidence,
          relatedTopicId: isLocked ? null : card.relatedTopicId,
          isLocked,
        };
      });

    return {
      unitId:      feed.unitId,
      generatedAt: feed.generatedAt,
      isStale:     feed.isStale,
      totalCards:  cards.length,
      freeCards:   FREE_CARDS_LIMIT,
      cards,
    };
  });

  res.status(200).json({
    success:   true,
    isPaid:    paid,
    freeLimit: FREE_CARDS_LIMIT,
    data:      result,
  });
});



export const deletePaper = asyncHandler(async (req, res) => {
  const { subjectCode, year, examType } = req.params;

  // ── Resolve canonical subjectCode from paperCode if needed
  const subject = await SubjectMeta.findOne({
    $or: [
      { _id: subjectCode },
      { paperCodes: subjectCode },
    ],
  }).lean();

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: `No subject found for code: ${subjectCode}`,
    });
  }

  const canonicalCode = subject._id; // "TAFL"

  // ── Delete all questions for this paper
  const deletedQuestions = await PYQQuestion.deleteMany({
    subjectCode: canonicalCode,
    year:        Number(year),
    examType,
  });

  // ── Delete the upload log for this paper
  const deletedLog = await AdminUploadLog.deleteOne({
    subjectCode: canonicalCode,
    year:        Number(year),
    examType,
  });

  // ── Recalculate analytics if questions still exist
  const remaining = await PYQQuestion.countDocuments({
    subjectCode: canonicalCode,
    mappingStatus: { $in: ['MAPPED', 'MANUAL'] },
  });

  if (remaining > 0) {
    await recomputeAnalytics(canonicalCode);
  } else {
    // No papers left — reset SubjectMeta
    await SubjectMeta.findByIdAndUpdate(canonicalCode, {
      analyticsReady:      false,
      totalPapersAnalysed: 0,
      updatedAt:           new Date(),
    });
    // Clear analytics doc
    await SubjectAnalytics.deleteOne({ subjectCode: canonicalCode });
    // Mark all insight feeds stale
    await PYQInsightsFeed.updateMany(
      { subjectCode: canonicalCode },
      { isStale: true }
    );
  }

  res.status(200).json({
    success: true,
    message: `Deleted ${deletedQuestions.deletedCount} questions for ${canonicalCode} ${year} ${examType}`,
    data: {
      questionsDeleted: deletedQuestions.deletedCount,
      logDeleted:       deletedLog.deletedCount,
      analyticsUpdated: remaining > 0,
    },
  });
});

// CONTROLLERS/pyq.controller.js — ADD THIS
// GET /api/v1/pyq/subject-brief?name=operating+system&semester=4
// CONTROLLERS/pyq.controller.js
// GET /api/v1/pyq/subject-brief?name=operating+system&semester=4
// GET /api/v1/pyq/subject-brief?name=operating+system&semester=4
// GET /api/v1/pyq/subject-brief?name=operating+system&semester=4
// GET /api/v1/pyq/subject-brief?name=operating+system&semester=4&unitNumber=3  ← unit mode
export const getSubjectBrief = asyncHandler(async (req, res) => {
  const { name, semester, unitNumber } = req.query;

  if (!name || !semester) {
    return res.status(400).json({ success: false, message: "name and semester required" });
  }

  // ── Normalize name ────────────────────────────────────────────────────────
  const asciiWords = name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, (ch) => {
      const map = {
        "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K",
        "\u041C": "M", "\u041D": "H", "\u041E": "O", "\u0420": "P",
        "\u0421": "C", "\u0422": "T", "\u0425": "X",
        "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p",
        "\u0441": "c", "\u0445": "x",
      };
      return map[ch] ?? "";
    })
    .replace(/\s+/g, " ")
    .trim();

  const sem = Number(semester);

  // ── STEP 1: Exact match (fastest, most reliable) ──────────────────────────
  // Handles: "big data and analytics" → BDA exactly
  let subject = await SubjectMeta.findOne(
    {
      name: { $regex: new RegExp(`^${asciiWords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      $or: [{ semester: sem }, { semester: { $elemMatch: { $eq: sem } } }],
    },
    { _id: 1, name: 1, code: 1 }
  ).lean();

  // ── STEP 2: All significant words with \b word boundaries ─────────────────
  // \b prevents "analytics" matching mid-word or as part of a longer phrase
  // ALL words must appear as whole words → much stricter than Step 1's regex
  if (!subject) {
    const words = asciiWords.split(" ").filter(w => w.length > 3);
    const wordRegexParts = words.map(w => `(?=.*\\b${w}\\b)`).join("");
    const wordBoundaryRegex = new RegExp(wordRegexParts, "i");

    const candidates = await SubjectMeta.find(
      {
        name: { $regex: wordBoundaryRegex },
        $or: [{ semester: sem }, { semester: { $elemMatch: { $eq: sem } } }],
      },
      { _id: 1, name: 1, code: 1 }
    ).lean();

    if (candidates.length === 1) {
      // Only one match — safe to use
      subject = candidates[0];
    } else if (candidates.length > 1) {
      // Multiple matches — pick the one whose word count is closest to input
      // This prevents a shorter-named subject from winning over the right one
      const inputWordCount = asciiWords.split(" ").length;
      subject = candidates.sort((a, b) => {
        const aDiff = Math.abs(a.name.split(" ").length - inputWordCount);
        const bDiff = Math.abs(b.name.split(" ").length - inputWordCount);
        return aDiff - bDiff;
      })[0];
    }
  }

  if (!subject) {
    return res.status(404).json({ success: false, message: "Subject not found" });
  }

  const targetUnit = unitNumber ? Number(unitNumber) : null;

  // ── MODE: Unit selected → full unit deep-dive ─────────────────────────────
  if (targetUnit) {
    const analytics = await SubjectAnalytics.findOne(
      { subjectCode: subject._id },
      { units: 1, trustMeta: 1, totalPapersAnalysed: 1, yearsCovered: 1 }
    ).lean();

    if (!analytics) {
      return res.status(404).json({ success: false, message: "Analytics not ready" });
    }

    const unit = analytics.units.find(u => u.unitNumber === targetUnit);
    if (!unit) {
      return res.status(404).json({ success: false, message: `Unit ${targetUnit} not found` });
    }

    // ── Reuse fetchYearMatrix for real topic × year heatmap ──────────────
    const matrixData = await fetchYearMatrix(subject._id, unit.unitId);

    // ── Same logic as getUnitBrief ─────────────────────────────────────────
    const allYears   = (analytics.yearsCovered ?? []).sort((a, b) => a - b);
    const totalYears = allYears.length;

    const unitYears = [
      ...new Set(
        (unit.topics ?? []).flatMap(t => t.appearedInYears ?? [])
      ),
    ].sort();

    const markTotals = {
      "2M":  (unit.topics ?? []).reduce((s, t) => s + (t.twoMarkCount  ?? 0), 0),
      "7M":  (unit.topics ?? []).reduce((s, t) => s + (t.sevenMarkCount ?? 0), 0),
      "10M": (unit.topics ?? []).reduce((s, t) => s + (t.tenMarkCount   ?? 0), 0),
    };
    const topMarkType = Object.entries(markTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const hotTopics = (unit.topics ?? [])
      .filter(t => (t.totalAppearances ?? 0) >= 2)
      .sort((a, b) => (b.totalAppearances ?? 0) - (a.totalAppearances ?? 0))
      .slice(0, 3)
      .map(t => ({
        topicId:           t.topicId,
        canonicalName:     t.canonicalName,
        totalAppearances:  t.totalAppearances,
        lastAskedYear:     t.lastAskedYear,
        predictionTag:     t.predictionTag,
        appearedEveryYear: (t.appearedInYears?.length ?? 0) >= totalYears,
      }));

    const unitInsight = (() => {
      const parts = [];
      if (hotTopics[0]) {
        parts.push(
          hotTopics[0].appearedEveryYear
            ? `${hotTopics[0].canonicalName} asked every year`
            : `${hotTopics[0].canonicalName} most repeated`
        );
      }
      if (topMarkType) parts.push(`${topMarkType} questions dominate`);
      return parts.join(" · ") || null;
    })();

    // ── Full topics sorted by predictionScore (same as getUnitAnalytics) ──
    const sortedTopics = [...(unit.topics ?? [])].sort(
      (a, b) => (b.predictionScore ?? 0) - (a.predictionScore ?? 0)
    );

    return res.status(200).json({
      success: true,
      mode:    "unit",
      data: {
        subjectCode:      subject._id,
        subjectName:      subject.name,
        unitId:           unit.unitId,
        unitNumber:       unit.unitNumber,
        unitTitle:        unit.title,
        frequencyScore:   unit.frequencyScore,
        avgMarksPerPaper: unit.avgMarksPerPaper,
        predictionTag:    unit.predictionTag,
        priorityRank:     unit.priorityRank,
        appearedInYears:  unitYears.length,
        totalYearsAvailable: totalYears,
        years:            unitYears,
        topMarkType,
        isFrequent:       unitYears.length >= 3,
        unitInsight,
        hotTopics,
        // ── Full topic list with subtopics (same as getUnitAnalytics) ──────
        topics:           sortedTopics,
        neverAsked:       unit.neverAsked       ?? [],
        dueForComeback:   unit.dueForComeback   ?? [],
        repeatedEveryYear: unit.repeatedEveryYear ?? [],
        // ── Topic × Year heatmap (real data from fetchYearMatrix) ───────────
        heatmap:          matrixData,
        trustMeta:        analytics.trustMeta,
      },
    });
  }

  // ── MODE: Subject only → subject overview + unit × year heatmap ──────────
  const analytics = await SubjectAnalytics.findOne(
    { subjectCode: subject._id },
    {
      "units.unitId":                         1,
      "units.unitNumber":                     1,
      "units.title":                          1,
      "units.avgMarksPerPaper":               1,
      "units.priorityRank":                   1,
      "units.predictionTag":                  1,
      "units.topics.canonicalName":           1,
      "units.topics.totalAppearances":        1,
      "units.topics.appearedInYears":         1,
      "overallInsights.yearWiseUnitWeightage": 1,
      "overallInsights.unitWeightage":        1,
      "trustMeta":                            1,
      "totalPapersAnalysed":                  1,
      "yearsCovered":                         1,
    }
  ).lean();

  if (!analytics) {
    return res.status(404).json({ success: false, message: "Analytics not ready" });
  }

  const allYears          = (analytics.yearsCovered ?? []).sort((a, b) => a - b);
  const yearWiseWeightage = analytics.overallInsights?.yearWiseUnitWeightage ?? {};

  const units = analytics.units
    .sort((a, b) => a.unitNumber - b.unitNumber)
    .map(u => ({
      unitId:           u.unitId,
      unitNumber:       u.unitNumber,
      title:            u.title,
      avgMarksPerPaper: u.avgMarksPerPaper,
      priorityRank:     u.priorityRank,
      predictionTag:    u.predictionTag,
    }));

  const heatmapRows = analytics.units
    .sort((a, b) => a.unitNumber - b.unitNumber)
    .map(u => {
      const unitNum   = String(u.unitNumber);
      const yearMarks = {};
      for (const year of allYears) {
        const marksThisYear = yearWiseWeightage[year]?.[unitNum] ?? null;
        yearMarks[year] = {
          asked: marksThisYear !== null && marksThisYear > 0,
          marks: marksThisYear ?? 0,
        };
      }
      return {
        unitId:          u.unitId,
        unitNumber:      u.unitNumber,
        title:           u.title,
        avgMarksPerPaper: u.avgMarksPerPaper,
        years:           yearMarks,
      };
    });

  const quickInsight = buildQuickInsight(units, analytics);

  return res.status(200).json({
    success: true,
    mode:    "subject",
    data: {
      subjectCode:         subject._id,
      subjectName:         subject.name,
      totalPapersAnalysed: analytics.totalPapersAnalysed,
      yearsCovered:        allYears,
      trustMeta:           analytics.trustMeta,
      quickInsight,
      units,
      heatmap: {
        years: allYears,
        rows:  heatmapRows,
      },
    },
  });
});

// CONTROLLERS/pyq.controller.js — add this
// GET /api/v1/pyq/syllabus?name=operating+system&semester=4&unitNumber=1
// CONTROLLERS/pyq.controller.js
export const getSubjectSyllabus = asyncHandler(async (req, res) => {
  const { name, semester, unitNumber } = req.query;

  if (!name || !semester) {
    return res.status(400).json({ success: false, message: "name and semester required" });
  }

  const normalized = sanitizeSubjectName(name).trim();
  const sem = Number(semester);

  // Exact match first
  let subject = await SubjectMeta.findOne({
    name: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    $or: [{ semester: sem }, { semester: { $elemMatch: { $eq: sem } } }],
  }, {
    _id: 1, name: 1, totalUnits: 1,
    "units.unitId": 1, "units.unitNumber": 1,
    "units.title": 1, "units.syllabusTopics": 1,
  }).lean();

  // Fallback: partial (original behaviour) only if exact fails
  if (!subject) {
    subject = await SubjectMeta.findOne({
      name:     { $regex: new RegExp(normalized, "i") },
      $or: [{ semester: sem }, { semester: { $elemMatch: { $eq: sem } } }],
    }, {
      _id: 1, name: 1, totalUnits: 1,
      "units.unitId": 1, "units.unitNumber": 1,
      "units.title": 1, "units.syllabusTopics": 1,
    }).lean();
  }

  if (!subject) {
    return res.status(404).json({ success: false, message: "Subject not found" });
  }

  // ── Map units → clean syllabus shape ─────────────────────────────────────
  let syllabus = (subject.units ?? [])
    .sort((a, b) => a.unitNumber - b.unitNumber)
    .map(u => ({
      unitNumber: u.unitNumber,
      title:      u.title,
      // Flatten syllabusTopics → plain string array for frontend
      topics: (u.syllabusTopics ?? []).map(t => {
        // If subTopics exist, include them as indented entries
        const subs = (t.subTopics ?? []).map(s => s.canonicalName);
        return subs.length
          ? [t.canonicalName, ...subs]
          : [t.canonicalName];
      }).flat(),
    }));

  // ── Filter to single unit if unitNumber param provided ───────────────────
  if (unitNumber) {
    syllabus = syllabus.filter(u => u.unitNumber === Number(unitNumber));
  }

  res.status(200).json({
    success: true,
    data: {
      subjectCode: subject._id,
      subjectName: subject.name,
      syllabus,
    },
  });
});

// CONTROLLERS/pyq.controller.js
export const getUnitBrief = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.query;

  if (!subjectCode || !unitId) {
    return res.status(400).json({ success: false, message: "subjectCode and unitId required" });
  }

  const analytics = await SubjectAnalytics.findOne(
    { subjectCode },
    { units: 1, totalPapersAnalysed: 1, yearsCovered: 1 }
  ).lean();

  if (!analytics) {
    return res.status(404).json({ success: false, message: "Analytics not found for subject" });
  }

  const unit = analytics.units.find((u) => u.unitId === unitId);

  if (!unit) {
    return res.status(404).json({ success: false, message: `Unit ${unitId} not found` });
  }

  // ── Most common mark type
  let topMarkType = null;
  if (unit.topics?.length) {
    const markTotals = {
      "2M":  unit.topics.reduce((s, t) => s + (t.twoMarkCount   || 0), 0),
      "7M":  unit.topics.reduce((s, t) => s + (t.sevenMarkCount  || 0), 0),
      "10M": unit.topics.reduce((s, t) => s + (t.tenMarkCount    || 0), 0),
    };
    topMarkType = Object.entries(markTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  // ── Years this unit appeared
  const unitYears = [
    ...new Set(
      unit.topics?.flatMap((t) => t.appearedInYears ?? []) ?? []
    ),
  ].sort();

  const totalYears = analytics.yearsCovered?.length ?? 0;

  // ── 🆕 Hot topics — top 3 by totalAppearances, must appear 2+ times
  const hotTopics = (unit.topics ?? [])
    .filter((t) => (t.totalAppearances ?? 0) >= 2)
    .sort((a, b) => (b.totalAppearances ?? 0) - (a.totalAppearances ?? 0))
    .slice(0, 3)
    .map((t) => ({
      topicId:          t.topicId,
      canonicalName:    t.canonicalName,
      totalAppearances: t.totalAppearances,
      lastAskedYear:    t.lastAskedYear,
      predictionTag:    t.predictionTag,
      // ── Is it asked every year?
      appearedEveryYear: unitYears.length > 0 &&
        (t.appearedInYears?.length ?? 0) >= totalYears,
    }));

  // ── 🆕 Quick insight line for this unit specifically
  const unitInsight = (() => {
    const parts = [];
    if (hotTopics[0]) {
      parts.push(
        hotTopics[0].appearedEveryYear
          ? `${hotTopics[0].canonicalName} asked every year`
          : `${hotTopics[0].canonicalName} most repeated`
      );
    }
    if (topMarkType) parts.push(`${topMarkType} questions dominate`);
    return parts.join(" · ") || null;
  })();

  return res.status(200).json({
    success: true,
    data: {
      unitId,
      unitNumber:           unit.unitNumber,
      title:                unit.title,
      subjectCode,
      appearedInYears:      unitYears.length,
      totalYearsAvailable:  totalYears,
      years:                unitYears,
      topMarkType,
      avgMarksPerPaper:     unit.avgMarksPerPaper,
      predictionTag:        unit.predictionTag,
      frequencyScore:       unit.frequencyScore,
      isFrequent:           unitYears.length >= 3,
      hotTopics,       // ← 🆕
      unitInsight,     // ← 🆕 "Finite Automata asked every year · 7M questions dominate"
    },
  });
});

function scoreQuestion(q, maxYear) {
  let score = 0;

  // ── Repeat signal (strongest) ─────────────────────────────────────────────
  if (q.isRepeat) score += 50;
  score += (q.repeatYears?.length ?? 0) * 5;

  // ── Mark weight by TYPE, not raw marks ───────────────────────────────────
  // TEN  = old 100-mark paper long answer (pre-2022 AKTU)
  // SEVEN = new 70-mark paper long answer (post-2022 AKTU)
  // Both are "long answer" → same weight
  // TWO  = short answer → low weight
  switch (q.markType) {
    case "TEN":   score += 30; break;   // old pattern long answer
    case "SEVEN": score += 30; break;   // new pattern long answer — same importance
    case "TWO":   score += 5;  break;   // short answer
    default:      score += 10; break;   // OTHER — unknown, treat as mid
  }

  // ── Recency bonus 0-10 ────────────────────────────────────────────────────
  if (maxYear > 2018) {
    score += Math.round(((q.year - 2018) / (maxYear - 2018)) * 10);
  }

  return score;
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/pyq/important-questions
// Query: subjectCode* | unitId? | limit? (default 10, max 20)
// ─────────────────────────────────────────────────────────────────────────────
export const getImportantQuestions = asyncHandler(async (req, res) => {
  const { subjectCode, unitId, markType } = req.query;  // ← ADD markType
  const limit = Math.min(Number(req.query.limit ?? 10), 20);

  if (!subjectCode) {
    return res.status(400).json({ success: false, message: "subjectCode is required" });
  }

  const filter = {
    subjectCode,
    mappingStatus: { $in: ["MAPPED", "MANUAL"] },
  };
  if (unitId) filter.unitId = unitId;

  // ── markType filter pushed into DB query ──────────────────────────────────
  if (markType) {
    if (markType === "short" || markType === "TWO") {
      filter.markType = "TWO";
    } else if (markType === "long") {
      filter.markType = { $in: ["TEN", "SEVEN"] };
    }
    // unknown value → ignored, returns all
  }

  // ── Fetch questions + subject meta in parallel ────────────────────────────
  const [questions, subjectMeta] = await Promise.all([
    PYQQuestion.find(filter, {
      rawText: 1, marks: 1, markType: 1,
      unitId: 1, topicId: 1,
      canonicalTopicName: 1, canonicalSubTopicName: 1,
      year: 1, isRepeat: 1, repeatYears: 1,
      questionType: 1, qNo: 1, section: 1,
    }).lean(),
    SubjectMeta.findOne({ _id: subjectCode }, { totalPapersAnalysed: 1 }).lean(),
  ]);

  if (!questions.length) {
    return res.status(200).json({
      success: true, subjectCode,
      unitId: unitId ?? null,
      total: 0,
      totalPapersAnalysed: subjectMeta?.totalPapersAnalysed ?? null,  // ← NEW
      questions: [],
    });
  }

  const maxYear = Math.max(...questions.map((q) => q.year ?? 0));

  const scored = questions
    .map((q) => ({ ...q, _score: scoreQuestion(q, maxYear) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if (b.marks  !== a.marks)  return b.marks  - a.marks;
      return (b.year ?? 0) - (a.year ?? 0);
    });

  const seen   = new Set();
  const unique = [];
  for (const q of scored) {
    const key = q.rawText.trim().toLowerCase().slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(q);
    }
    if (unique.length >= limit) break;
  }

  const result = unique.map(({ _score, ...rest }) => ({
    ...rest,
    repeatYears: rest.repeatYears ?? [],
    importanceLabel:
      rest.isRepeat                         ? "Repeat"       :
      (rest.repeatYears?.length ?? 0) >= 2  ? "Frequent"     :
      (rest.markType === "TEN" ||
       rest.markType === "SEVEN")           ? "Long Answer"  :
      rest.markType === "TWO"               ? "Short Answer" : "Good to Know",
  }));

  return res.status(200).json({
    success: true, subjectCode,
    unitId: unitId ?? null,
    total: result.length,
    totalPapersAnalysed: subjectMeta?.totalPapersAnalysed ?? null,  // ← NEW
    questions: result,
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/pyq/important-topics
// Query: subjectCode* | unitId? | limit? (default 8, max 15)
// ─────────────────────────────────────────────────────────────────────────────
export const getImportantTopics = asyncHandler(async (req, res) => {
  const { subjectCode, unitId } = req.query;
  const limit = Math.min(Number(req.query.limit ?? 8), 15);

  if (!subjectCode) {
    return res.status(400).json({ success: false, message: "subjectCode is required" });
  }

  // ── 1. Analytics (pre-computed topic stats) ───────────────────────────────
  const analytics = await SubjectAnalytics.findOne(
    { subjectCode },
    {
      "units.unitId":                  1,
      "units.unitNumber":              1,
      "units.title":                   1,
      "units.topics.topicId":          1,
      "units.topics.canonicalName":    1,
      "units.topics.totalAppearances": 1,
      "units.topics.lastAskedYear":    1,
      "units.topics.predictionTag":    1,
      "units.topics.predictionScore":  1,
      "units.topics.appearedInYears":  1,
      "units.topics.subTopics":        1,
    }
  ).lean();

  if (!analytics) {
    return res.status(404).json({
      success: false,
      message: `Analytics not ready for subject: ${subjectCode}`,
    });
  }

  const targetUnits = unitId
    ? analytics.units.filter((u) => u.unitId === unitId)
    : analytics.units;

  if (!targetUnits.length) {
    return res.status(200).json({
      success: true, subjectCode,
      unitId: unitId ?? null, total: 0, topics: [],
    });
  }

  // ── 2. Aggregate totalMarks per topicId from PYQQuestion ─────────────────
  // Single aggregation — covers all target units in one query
  const matchFilter = {
    subjectCode,
    mappingStatus: { $in: ["MAPPED", "MANUAL"] },
  };
  if (unitId) matchFilter.unitId = unitId;

  const marksAgg = await PYQQuestion.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id:        "$topicId",
        totalMarks: { $sum: "$marks" },
        // Break down by markType for the bar chart segments
        twoMarkTotal:   { $sum: { $cond: [{ $eq: ["$markType", "TWO"]   }, "$marks", 0] } },
        sevenMarkTotal: { $sum: { $cond: [{ $eq: ["$markType", "SEVEN"] }, "$marks", 0] } },
        tenMarkTotal:   { $sum: { $cond: [{ $eq: ["$markType", "TEN"]   }, "$marks", 0] } },
      },
    },
  ]);

  // Build a lookup map: topicId → marks breakdown
  const marksMap = {};
  for (const row of marksAgg) {
    marksMap[row._id] = {
      totalMarks:     row.totalMarks,
      twoMarkTotal:   row.twoMarkTotal,
      sevenMarkTotal: row.sevenMarkTotal,
      tenMarkTotal:   row.tenMarkTotal,
      // Normalize: treat TEN + SEVEN as "long answer" total
      longAnswerTotal: row.sevenMarkTotal + row.tenMarkTotal,
    };
  }

  // ── 3. Build + sort topics ────────────────────────────────────────────────
  const allTopics = targetUnits.flatMap((u) =>
    (u.topics ?? []).map((t) => {
      const marks = marksMap[t.topicId] ?? {
        totalMarks: 0, twoMarkTotal: 0,
        sevenMarkTotal: 0, tenMarkTotal: 0, longAnswerTotal: 0,
      };
      return {
        topicId:          t.topicId,
        canonicalName:    t.canonicalName,
        unitId:           u.unitId,
        unitNumber:       u.unitNumber,
        unitTitle:        u.title,
        totalAppearances: t.totalAppearances ?? 0,
        lastAskedYear:    t.lastAskedYear    ?? null,
        predictionTag:    t.predictionTag    ?? null,
        predictionScore:  t.predictionScore  ?? 0,
        appearedInYears:  t.appearedInYears  ?? [],
        // ── NEW: marks breakdown ──────────────────────────────────────────
        totalMarks:       marks.totalMarks,
        marksBreakdown: {
          shortAnswer:  marks.twoMarkTotal,
          longAnswer:   marks.longAnswerTotal,   // TEN + SEVEN combined
        },
        subTopics: (t.subTopics ?? [])
          .sort((a, b) => (b.totalAppearances ?? 0) - (a.totalAppearances ?? 0))
          .slice(0, 3)
          .map((s) => ({
            subTopicId:       s.subTopicId,
            canonicalName:    s.canonicalName,
            totalAppearances: s.totalAppearances ?? 0,
          })),
      };
    })
  );

  const result = allTopics
    .sort((a, b) => {
      if (b.predictionScore  !== a.predictionScore)  return b.predictionScore  - a.predictionScore;
      if (b.totalAppearances !== a.totalAppearances) return b.totalAppearances - a.totalAppearances;
      return (b.lastAskedYear ?? 0) - (a.lastAskedYear ?? 0);
    })
    .slice(0, limit);

  return res.status(200).json({
    success: true, subjectCode,
    unitId: unitId ?? null, total: result.length, topics: result,
  });
});


// CONTROLLERS/pyq.controller.js
// CONTROLLERS/pyq.controller.js

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RNG — mulberry32
// ─────────────────────────────────────────────────────────────────────────────
function createRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  let s = h >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTED SAMPLER
// ─────────────────────────────────────────────────────────────────────────────
function weightedPick(items, weights, rng) {
  if (!items.length) return null;
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE WEIGHTS — sqrt only when top topic is genuinely dominant
// Condition: enough data (≥6 papers) AND top score > 2× second score
// Why: predictionScore is already blended (0-100), not raw count.
//      sqrt on a balanced distribution over-flattens it.
//      sqrt on a skewed distribution fixes over-dominance. ✅
// ─────────────────────────────────────────────────────────────────────────────
function adaptiveWeights(candidates, totalPapersAnalysed) {
  const scores = candidates.map((t) => Math.max(t.predictionScore ?? 1, 1));
  const sorted  = [...scores].sort((a, b) => b - a);
  const isDominant =
    totalPapersAnalysed >= 6 &&
    sorted.length >= 2 &&
    sorted[0] > sorted[1] * 2;
  return isDominant ? scores.map(Math.sqrt) : scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT SCORE — mark-type agnostic (10M == 7M = 1 appearance)
// ─────────────────────────────────────────────────────────────────────────────
function computeUnitScore(unit) {
  const topicScore = (unit.topics ?? []).reduce(
    (sum, t) => sum + (t.totalAppearances ?? 0) * (t.predictionScore ?? 1),
    0
  );
  return topicScore * 0.7 + (unit.frequencyScore ?? 0) * 0.3;
}

// ─────────────────────────────────────────────────────────────────────────────
// REASON BUILDER
// ✅ FIX: +1 to repeatYears.length (original appearance year excluded otherwise)
//    appeared 2022 (original) + [2023, 2025] (repeatYears) = ×3 total, not ×2
// ─────────────────────────────────────────────────────────────────────────────
function buildReason(q, topic) {
  const tagLabel = {
    VERY_LIKELY:  "Very likely",
    LIKELY:       "Likely",
    DUE_COMEBACK: "Due for comeback",
    WATCH_OUT:    "Watch out",
    LOW_PRIORITY: "Low priority",
  };

  if (!q || q.isSynthetic) {
    const tag = tagLabel[topic?.predictionTag] ?? "Predicted topic";
    return `${tag} · No past PYQ — AI generated`;
  }

  const parts = [];

  if (q.isRepeat && (q.repeatYears?.length ?? 0) > 0) {
    // +1 = original year (q.year) is NOT in repeatYears array
    parts.push(`Repeat ×${q.repeatYears.length + 1}`);

    // ✅ FIX: Last asked = most recent year from repeatYears (not q.year which is original)
    const lastYear = Math.max(...q.repeatYears);
    parts.push(`Last asked ${lastYear}`);

  } else if (q.year) {
    // Non-repeat question — q.year is both first and last asked
    parts.push(`Last asked ${q.year}`);
  }

  const tag = tagLabel[topic?.predictionTag];
  if (tag) parts.push(tag);
  else if (q.isRepeat) parts.push("High frequency");

  return parts.join(" · ") || "From past PYQ";
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACH META — enriches question with reason field
// ─────────────────────────────────────────────────────────────────────────────
function attachMeta(questionObj, topicAnalytics) {
  return {
    ...questionObj,
    reason: buildReason(questionObj, topicAnalytics),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INFER VERB — synthetic questions (TopicAnalyticsSchema has no questionType)
// ─────────────────────────────────────────────────────────────────────────────
function inferVerb(canonicalName, markType) {
  const name = (canonicalName ?? "").toLowerCase();

  if (markType === "TWO") {
    if (name.includes("difference") || name.includes("compare") || name.includes(" vs "))
      return "Differentiate between";
    if (name.includes("definition") || name.includes("what is") || name.includes("define"))
      return "Define";
    if (name.includes("types") || name.includes("classification") || name.includes("list"))
      return "List and briefly explain";
    return "Write a short note on";
  }

  if (name.includes("algorithm") || name.includes("procedure") || name.includes("steps"))
    return "Explain the algorithm for";
  if (name.includes("architecture") || name.includes("design") || name.includes("structure"))
    return "Explain the architecture of";
  if (name.includes("difference") || name.includes("compare") || name.includes(" vs "))
    return "Compare and contrast";
  if (name.includes("types") || name.includes("classification"))
    return "Classify and explain the types of";
  if (name.includes("working") || name.includes("operation") || name.includes("process"))
    return "Explain the working of";
  if (name.includes("derive") || name.includes("proof") || name.includes("theorem"))
    return "Derive the expression for";
  return "Explain";
}

// ─────────────────────────────────────────────────────────────────────────────
// PICK BEST QUESTION — deterministic stable sort
// ─────────────────────────────────────────────────────────────────────────────
function pickBestQuestion(questions) {
  if (!questions?.length) return null;
  return [...questions].sort((a, b) => {
    if (b.isRepeat !== a.isRepeat) return b.isRepeat ? 1 : -1;
    const bR = b.repeatYears?.length ?? 0;
    const aR = a.repeatYears?.length ?? 0;
    if (bR !== aR) return bR - aR;
    if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return String(a._id) > String(b._id) ? 1 : -1;
  })[0];
}
// ─────────────────────────────────────────────────────────────────────────────
// SANITIZE REPEAT YEARS — strip precomputed future data from repeatYears
// repeatYears is baked at analytics time with ALL historical data.
// When predicting for targetYear, we must not leak that year's data.
// Rule: keep only repeatYears < targetYear (conservative, examType-safe)
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeRepeatYears(q, targetYear) {
  if (!q.repeatYears?.length) return q;
  const filtered = q.repeatYears.filter((y) => y < targetYear);
  return {
    ...q,
    repeatYears: filtered,
    // If all repeatYears were future, this question is no longer a repeat
    isRepeat: filtered.length > 0,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// BUILD SYNTHETIC QUESTION
// ─────────────────────────────────────────────────────────────────────────────
function buildSyntheticQuestion(topic, markType, section, qNo) {
  const name = topic.canonicalName ?? topic.canonicalTopicName ?? "this topic";
  return {
    rawText:            `${inferVerb(name, markType)} ${name}.`,
    marks:              markType === "TWO" ? 2 : 7,
    markType,
    section,
    qNo,
    unitId:             topic.unitId    ?? null,
    unitTitle:          topic.unitTitle ?? null,
    topicId:            topic.topicId,
    canonicalTopicName: name,
    isSynthetic:        true,
    predictionScore:    topic.predictionScore ?? 0,
    predictionTag:      topic.predictionTag   ?? null,
    _source:            "synthetic",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OR-PAIR DIVERSITY CHECKS
// ─────────────────────────────────────────────────────────────────────────────
function tooSimilar(nameA, nameB) {
  const words = (s) =>
    (s ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const a = new Set(words(nameA));
  const b = new Set(words(nameB));
  if (a.size === 0 || b.size === 0) return false;
  const intersection = [...a].filter((w) => b.has(w)).length;
  return intersection / Math.min(a.size, b.size) > 0.5;
}

// Level 1: full diversity (subTopic + name + questionType)
function isDiversePair(topicA, qA, topicB, qB) {
  const diffSubTopic =
    !topicA.subTopicId || !topicB.subTopicId ||
    topicA.subTopicId !== topicB.subTopicId;
  const diffName  = !tooSimilar(topicA.canonicalName, topicB.canonicalName);
  const qtA = qA?.questionType;
  const qtB = qB?.questionType;
  const diffQType = !qtA || !qtB || qtA !== qtB;
  return diffSubTopic && diffName && diffQType;
}

// Level 2: relax questionType (different subTopic + name only)
function isDecentPair(topicA, topicB) {
  const diffSubTopic =
    !topicA.subTopicId || !topicB.subTopicId ||
    topicA.subTopicId !== topicB.subTopicId;
  return diffSubTopic && !tooSimilar(topicA.canonicalName, topicB.canonicalName);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORE
// ─────────────────────────────────────────────────────────────────────────────
function computeConfidence(allPickedQuestions, maxYear, minYear) {
  const real  = allPickedQuestions.filter((q) => q?._source === "real");
  const total = allPickedQuestions.filter(Boolean).length;
  if (total === 0) return 0;

  const realRatio      = real.length / total;
  const repeatCoverage = real.filter((q) => q.isRepeat).length / (real.length || 1);
  const yearRange      = maxYear - minYear || 1;
  const recencyScore   = real.length
    ? real.reduce(
        (sum, q) => sum + ((q.year ?? minYear) - minYear) / yearRange, 0
      ) / real.length
    : 0;

  return Math.round(
    (realRatio * 0.6 + repeatCoverage * 0.25 + recencyScore * 0.15) * 100
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────
function buildInsights(analytics) {
  const insights = [];
  const totalMarks =
    analytics.units.reduce((s, u) => s + (u.avgMarksPerPaper ?? 0), 0) || 1;

  const topUnit = [...analytics.units].sort(
    (a, b) => (b.avgMarksPerPaper ?? 0) - (a.avgMarksPerPaper ?? 0)
  )[0];
  if (topUnit) {
    const pct = Math.round(((topUnit.avgMarksPerPaper ?? 0) / totalMarks) * 100);
    insights.push(`Unit ${topUnit.unitNumber} (${topUnit.title}) dominates — ${pct}% avg weightage`);
  }

  const everyYear = analytics.units.flatMap((u) => u.repeatedEveryYear ?? []).slice(0, 2);
  if (everyYear.length) insights.push(`Asked every year: ${everyYear.join(", ")}`);

  const due = analytics.units.flatMap((u) => u.dueForComeback ?? []).slice(0, 2);
  if (due.length) insights.push(`Due for comeback: ${due.join(", ")}`);

  const never = (analytics.overallInsights?.neverAskedTopics ?? []).slice(0, 2);
  if (never.length) insights.push(`Low priority (never asked): ${never.join(", ")}`);

  const mostRepeated = (analytics.overallInsights?.mostRepeatedTopics ?? []).slice(0, 1);
  if (mostRepeated.length) insights.push(`Most repeated topic: ${mostRepeated[0]}`);

  return insights;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/pyq/:subjectCode/predicted-paper
// ─────────────────────────────────────────────────────────────────────────────
export const getPredictedPaper = asyncHandler(async (req, res) => {
  const { subjectCode } = req.params;
  const paperType       = req.query.paperType ?? "NEW";
  const targetYear      = Number(req.query.year ?? new Date().getFullYear());
  const targetExamType  = req.query.examType  ?? "EVEN_SEM";

  const rng = createRng(`${subjectCode}-${targetYear}-${targetExamType}`);

  // ── 1. Parallel DB fetch ─────────────────────────────────────────────────
  const yearFilter = {
    $or: [
      { year: { $lt: targetYear } },
      { year: targetYear, examType: { $ne: targetExamType } },
    ],
  };

  const [analytics, allQuestions, subjectMeta] = await Promise.all([
    SubjectAnalytics.findOne({ subjectCode }).lean(),
    PYQQuestion.find(
      { subjectCode, mappingStatus: { $in: ["MAPPED", "MANUAL"] }, ...yearFilter },
      {
        rawText: 1, marks: 1, markType: 1,
        unitId: 1, topicId: 1, subTopicId: 1,
        canonicalTopicName: 1, canonicalSubTopicName: 1,
        section: 1, qNo: 1,
        isRepeat: 1, repeatYears: 1,
        questionType: 1, hasDiagram: 1,
        difficulty: 1, year: 1, examType: 1,
      }
    ).lean(),
    SubjectMeta.findById(subjectCode).lean(),
  ]);

  if (!analytics)
    return res.status(404).json({ success: false, message: `Analytics not ready for: ${subjectCode}` });
  if (!subjectMeta)
    return res.status(404).json({ success: false, message: `Subject not found: ${subjectCode}` });

 // ── 2. Question lookup maps ───────────────────────────────────────────────
const byTopicShort = {};
const byTopicLong  = {};

for (const q of allQuestions) {
  if (!q.topicId) continue;
  
  // ✅ Strip future years from precomputed repeatYears field
  const sanitized = sanitizeRepeatYears(q, targetYear);
  
  if (sanitized.markType === "TWO") {
    (byTopicShort[sanitized.topicId] ??= []).push(sanitized);
  } else if (sanitized.markType === "SEVEN" || sanitized.markType === "TEN") {
    (byTopicLong[sanitized.topicId] ??= []).push(sanitized);
  }
}
  // ── 3. Topic + unit structures ───────────────────────────────────────────
  const units = analytics.units.slice().sort((a, b) => a.unitNumber - b.unitNumber);

  const topicsByUnit   = {};
  const topicLookupMap = {};

  for (const u of units) {
    topicsByUnit[u.unitId] = (u.topics ?? [])
      .map((t) => ({
        ...t,
        unitId:     u.unitId,
        unitTitle:  u.title,
        unitNumber: u.unitNumber,
      }))
      .sort((a, b) => {
        const d = (b.predictionScore ?? 0) - (a.predictionScore ?? 0);
        return d !== 0 ? d : (a.topicId > b.topicId ? 1 : -1);
      });

    for (const t of topicsByUnit[u.unitId]) {
      topicLookupMap[t.topicId] = t;
    }
  }

  const unitScores = {};
  for (const u of units) unitScores[u.unitId] = computeUnitScore(u);

  const unitsByWeight = [...units].sort(
    (a, b) => (b.avgMarksPerPaper ?? 0) - (a.avgMarksPerPaper ?? 0)
  );

  const totalPapersAnalysed = analytics.totalPapersAnalysed ?? 0;

  // ── 4. SECTION A — 7 × 2-mark (coverage-first) ──────────────────────────
  const sectionA      = [];
  const usedTopicsInA = new Set();

  for (const unit of units) {
    if (sectionA.length >= 7) break;
    for (const topic of topicsByUnit[unit.unitId] ?? []) {
      if (usedTopicsInA.has(topic.topicId)) continue;
      const best = pickBestQuestion(byTopicShort[topic.topicId] ?? []);
      const qNo  = `1${String.fromCharCode(97 + sectionA.length)}`;
      const q    = best
        ? { ...best, section: "A", qNo, _source: "real" }
        : buildSyntheticQuestion(topic, "TWO", "A", qNo);
      sectionA.push(attachMeta(q, topicLookupMap[topic.topicId]));
      usedTopicsInA.add(topic.topicId);
      break;
    }
  }

  for (const unit of unitsByWeight) {
    if (sectionA.length >= 7) break;
    for (const topic of topicsByUnit[unit.unitId] ?? []) {
      if (usedTopicsInA.has(topic.topicId)) continue;
      const best = pickBestQuestion(byTopicShort[topic.topicId] ?? []);
      const qNo  = `1${String.fromCharCode(97 + sectionA.length)}`;
      const q    = best
        ? { ...best, section: "A", qNo, _source: "real" }
        : buildSyntheticQuestion(topic, "TWO", "A", qNo);
      sectionA.push(attachMeta(q, topicLookupMap[topic.topicId]));
      usedTopicsInA.add(topic.topicId);
      break;
    }
  }

  // ── 5. SECTION B — probabilistic weighted ────────────────────────────────
  const sectionB      = [];
  const usedTopicsInB = new Set();
  const unitPickCount = {};
  const exhaustedUnits = new Set();
  const unitIds = units.map((u) => u.unitId);

  let attempts = 0;
  while (sectionB.length < 5 && attempts < 25) {
    attempts++;

    const eligibleIds = unitIds.filter(
      (id) => (unitPickCount[id] ?? 0) < 2 && !exhaustedUnits.has(id)
    );
    if (eligibleIds.length === 0) break;

    const eligibleWeights = eligibleIds.map((id) => unitScores[id] ?? 0);
    const pickedUnitId    = weightedPick(eligibleIds, eligibleWeights, rng);

    let added = false;
    for (const topic of topicsByUnit[pickedUnitId] ?? []) {
      if (usedTopicsInB.has(topic.topicId)) continue;
      const best = pickBestQuestion(byTopicLong[topic.topicId] ?? []);
      const qNo  = `2${String.fromCharCode(97 + sectionB.length)}`;
      const q    = best
        ? { ...best, section: "B", qNo, _source: "real" }
        : buildSyntheticQuestion(topic, "SEVEN", "B", qNo);
      sectionB.push(attachMeta(q, topicLookupMap[topic.topicId]));
      usedTopicsInB.add(topic.topicId);
      unitPickCount[pickedUnitId] = (unitPickCount[pickedUnitId] ?? 0) + 1;
      added = true;
      break;
    }

    if (!added) exhaustedUnits.add(pickedUnitId);
  }

  // Fallback: min 3 units — ONLY uncovered units (no double-bias)
  const coveredUnits = new Set(Object.keys(unitPickCount));
  if (coveredUnits.size < 3 && sectionB.length < 5) {
    const uncoveredSorted = unitsByWeight.filter(
      (u) => !coveredUnits.has(u.unitId) && !exhaustedUnits.has(u.unitId)
    );
    for (const unit of uncoveredSorted) {
      if (sectionB.length >= 5 || coveredUnits.size >= 3) break;
      for (const topic of topicsByUnit[unit.unitId] ?? []) {
        if (usedTopicsInB.has(topic.topicId)) continue;
        const best = pickBestQuestion(byTopicLong[topic.topicId] ?? []);
        const qNo  = `2${String.fromCharCode(97 + sectionB.length)}`;
        const q    = best
          ? { ...best, section: "B", qNo, _source: "real" }
          : buildSyntheticQuestion(topic, "SEVEN", "B", qNo);
        sectionB.push(attachMeta(q, topicLookupMap[topic.topicId]));
        usedTopicsInB.add(topic.topicId);
        coveredUnits.add(unit.unitId);
        break;
      }
    }
  }

// ── 6. SECTION C — 5 OR-pairs (ALWAYS complete — optionB guaranteed) ────────
const sectionC      = [];
const usedTopicsInC = new Set([...usedTopicsInB]);

function getEligibleUnits() {
  return units.filter(
    (u) => (topicsByUnit[u.unitId] ?? []).some((t) => !usedTopicsInC.has(t.topicId))
  );
}

// ─────────────────────────────────────────────────────────────────────
// FIND TOPIC B — 4-level guaranteed fallback
// Level 1: full diversity (diff subTopic + diff name + diff questionType)
// Level 2: relax questionType (diff subTopic + diff name)
// Level 3: any topic from unitB (last resort within chosen unit)
// Level 4: ANY topic from ANY eligible unit globally (nuclear option)
//          → guarantees optionB is NEVER null
// ─────────────────────────────────────────────────────────────────────
function findTopicB(topicA, bestA, unitBTopics, usedTopicsInC, topicAId) {
  // Level 1: full diversity (diff subTopic + diff name + diff questionType)
  for (const candidate of unitBTopics) {
    const candidateBest = pickBestQuestion(byTopicLong[candidate.topicId] ?? []);
    if (isDiversePair(topicA, bestA, candidate, candidateBest)) return candidate;
  }

  // Level 2: relax questionType (diff subTopic + diff name only)
  for (const candidate of unitBTopics) {
    if (isDecentPair(topicA, candidate)) return candidate;
  }

  // Level 3: any topic in unitB pool
  if (unitBTopics.length > 0) return unitBTopics[0];

  // Level 4: global sweep — any UNUSED topic, any unit, excluding topicA
  for (const unit of units) {
    for (const candidate of topicsByUnit[unit.unitId] ?? []) {
      if (usedTopicsInC.has(candidate.topicId)) continue;
      if (candidate.topicId === topicAId) continue;
      return candidate;
    }
  }

  // Level 5: reuse an already-used topic (better than duplicating topicA)
  // Priority: highest predictionScore among all topics except topicA
  for (const unit of units) {
    for (const candidate of topicsByUnit[unit.unitId] ?? []) {
      if (candidate.topicId === topicAId) continue;
      return candidate; // already sorted by predictionScore DESC in Step 3
    }
  }

  // Absolute last resort: subject has literally 1 topic — use topicA itself
  // This is a data quality issue, not a code issue
  return null;
}

for (let pairIdx = 0; pairIdx < 5; pairIdx++) {
  const qNumber = 3 + pairIdx;
  const qNoA    = `${qNumber}a`;
  const qNoB    = `${qNumber}b`;

  const eligibleUnits = getEligibleUnits();
  if (eligibleUnits.length === 0) break;

  const unitAWeights = eligibleUnits.map((u) => unitScores[u.unitId] ?? 0);
  const unitA        = weightedPick(eligibleUnits, unitAWeights, rng);
  const unitATopics  = (topicsByUnit[unitA.unitId] ?? []).filter(
    (t) => !usedTopicsInC.has(t.topicId)
  );
  if (unitATopics.length === 0) { pairIdx--; continue; }

  // Adaptive weighted pick for topicA
  const topicACandidates = unitATopics.slice(0, 3);
  const topicAWeights    = adaptiveWeights(topicACandidates, totalPapersAnalysed);
  const topicA           = weightedPick(topicACandidates, topicAWeights, rng);

  const bestA = pickBestQuestion(byTopicLong[topicA.topicId] ?? [])
                ?? buildSyntheticQuestion(topicA, "SEVEN", "C", qNoA);

  // 70% same-unit / 30% cross-unit for topicB unit selection
  const isSameUnit = rng() < 0.7;
  let unitBId = unitA.unitId;

  if (!isSameUnit) {
    const crossEligible = eligibleUnits.filter((u) => u.unitId !== unitA.unitId);
    if (crossEligible.length > 0) {
      const crossWeights = crossEligible.map((u) => unitScores[u.unitId] ?? 0);
      unitBId = weightedPick(crossEligible, crossWeights, rng).unitId;
    }
  }

  // Build unitB topic pool
  const unitBTopics = (topicsByUnit[unitBId] ?? []).filter(
    (t) => !usedTopicsInC.has(t.topicId) && t.topicId !== topicA.topicId
  );

  // ✅ 4-level guaranteed topicB — can never be null unless 1-topic subject
  const topicB = findTopicB(topicA, bestA, unitBTopics, usedTopicsInC, topicA.topicId);

  // ✅ topicB is always either real or synthetic — never skipped
// ✅ topicB is always either real or synthetic — never a duplicate of topicA
let fallbackTopic = topicB;
let bestBRaw;

if (topicB) {
  bestBRaw = pickBestQuestion(byTopicLong[topicB.topicId] ?? [])
             ?? buildSyntheticQuestion(topicB, "SEVEN", "C", qNoB);
} else {
  // Level 5 returned null → only 1 topic in entire subject
  // Safe to reuse topicA here because there is literally no other choice
  // Log it so data team can fix the subject's topic coverage
  console.warn(`[PYQ] Nuclear fallback hit for ${subjectCode} pair ${qNumber} — subject may have too few topics`);
  fallbackTopic = topicA;
  bestBRaw = buildSyntheticQuestion(topicA, "SEVEN", "C", qNoB);
}

const actualUnitBId = fallbackTopic?.unitId ?? unitA.unitId;
const pairType      = actualUnitBId !== unitA.unitId ? "cross-unit" : "same-unit";

sectionC.push({
  qNumber,
  unitId:    unitA.unitId,
  unitTitle: unitA.title,
  pairType,
  optionA: attachMeta(
    { ...bestA, section: "C", qNo: qNoA, _source: bestA._id ? "real" : "synthetic" },
    topicLookupMap[topicA.topicId]
  ),
  optionB: attachMeta(
    { ...bestBRaw, section: "C", qNo: qNoB, _source: bestBRaw._id ? "real" : "synthetic" },
    topicLookupMap[fallbackTopic.topicId]  // ✅ always correct topic's analytics
  ),
});

usedTopicsInC.add(topicA.topicId);
if (topicB && topicB.topicId !== topicA.topicId) usedTopicsInC.add(topicB.topicId);
}
  // ── 7. Confidence + Response ─────────────────────────────────────────────
  const allPicked = [
    ...sectionA,
    ...sectionB,
    ...sectionC.flatMap((p) => [p.optionA, p.optionB]),
  ];

  const yearsCoveredSorted = [...(analytics.yearsCovered ?? [])].sort((a, b) => a - b);

// ✅ FIX: Strip target year from display meta — prediction uses data < targetYear only
// analytics.yearsCovered is precomputed with ALL years including targetYear.
// Meta must reflect what was actually used for this prediction, not what analytics knows.
const yearsCoveredForDisplay = yearsCoveredSorted.filter((y) => y < targetYear);

const minYear = yearsCoveredForDisplay[0]                                ?? 2018;
const maxYear = yearsCoveredForDisplay[yearsCoveredForDisplay.length - 1] ?? targetYear - 1;
  const paperConfidence = computeConfidence(allPicked, maxYear, minYear);

  const disclaimer =
    `AI-predicted paper for ${subjectMeta.name} based on ` +
    `${analytics.totalPapersAnalysed} past papers ` +
    `(${yearsCoveredForDisplay.join(", ")}). ` +
    `NOT an official AKTU paper. Use as a revision tool only.`;

  return res.status(200).json({
    success: true,
    data: {
      subjectCode,
      subjectName:      subjectMeta.name,
      paperCode:        subjectMeta.paperCodes?.[0] ?? null,
      university:       "AKTU",
      course:           "B.Tech",
      semester:         subjectMeta.semester,
      predictedForYear: targetYear,
      targetExamType,
      paperType,
      totalMarks:       70,

      structure: {
        sectionA: { totalQuestions: 7, toAttempt: 7, marksEach: 2,  totalMarks: 14, instruction: "Attempt all questions." },
        sectionB: { totalQuestions: 5, toAttempt: 3, marksEach: 7,  totalMarks: 21, instruction: "Attempt any THREE questions out of five." },
        sectionC: { totalPairs: 5,    toAttempt: 5, marksEach: 7,  totalMarks: 35, instruction: "Attempt ONE question from each pair (a or b)." },
      },

      sectionA,
      sectionB,
      sectionC,

      insights: buildInsights(analytics),

      meta: {
        basedOnPapers:    analytics.totalPapersAnalysed,
        yearsCovered:     yearsCoveredForDisplay,     // ✅ [2023, 2024] not [2023, 2024, 2025]
        sourcedUpToYear:  maxYear,                    // ✅ 2024 not 2025
        paperConfidence,
        confidenceBreakdown: {
          realQuestionRatio: `${allPicked.filter((q) => q?._source === "real").length}/${allPicked.filter(Boolean).length} questions from real PYQs`,
          repeatCoverage:    `${allPicked.filter((q) => q?.isRepeat).length} repeat questions included`,
        },
        lastRecalculated: analytics.lastRecalculated,
        disclaimer,
      },
    },
  });
});