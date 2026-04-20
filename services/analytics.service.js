// services/analyticsService.js
import asyncHandler from "express-async-handler";
import SubjectMeta      from "../MODELS/SubjectMeta.model.js";
import SubjectAnalytics from "../MODELS/SubjectAnalytics.model.js";
import PYQInsightsFeed  from "../MODELS/PYQInsightsFeed.model.js";
import AdminUploadLog   from "../MODELS/AdminUploadLog.model.js";
import PYQQuestion from "../MODELS/PYQQuestion.model.js";
// ─────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────

/**
 * Convert end-year number → academic year string
 * 2025 → "2024-25"
 */
const toAcademicYear = (endYear) =>
  `${endYear - 1}-${String(endYear).slice(2)}`;

/**
 * Prediction score formula
 * weight: 60% frequency, 40% recency
 */
const calcPredictionScore = (appearances, totalPapers, lastAskedYear, latestYear) => {
  const frequencyRatio = appearances / totalPapers;
  const recencyGap     = latestYear - lastAskedYear;         // 0 = asked this year
  const recencyScore   = Math.max(0, 1 - recencyGap * 0.2); // drops 20% per year gap
  return Math.round((frequencyRatio * 0.6 + recencyScore * 0.4) * 100);
};

/**
 * Prediction tag from score + recency
 */
const getPredictionTag = (score, lastAskedYear, latestYear, totalPapers, appearances) => {
  const gap = latestYear - lastAskedYear;

  if (appearances === 0)                              return 'LOW_PRIORITY';
  if (score >= 75)                                    return 'VERY_LIKELY';
  if (score >= 50)                                    return 'LIKELY';
  if (gap >= 2 && appearances >= 2)                   return 'DUE_COMEBACK';
  if (gap >= 3)                                       return 'WATCH_OUT';
  return 'LOW_PRIORITY';
};

/**
 * Unit-level priority tag
 */
const getUnitPriorityTag = (frequencyScore) => {
  if (frequencyScore >= 70) return 'HIGH_PRIORITY';
  if (frequencyScore >= 40) return 'MEDIUM_PRIORITY';
  return 'LOW_PRIORITY';
};

// ─────────────────────────────────────────────────────────────────
// CORE: RECALCULATE SUBJECT ANALYTICS
// Called after every new paper upload
// ─────────────────────────────────────────────────────────────────

export const recalculateAnalytics = async (subjectCode) => {
  // ── 1. Pull all MAPPED questions for this subject
  const questions = await PYQQuestion.find({
    subjectCode,
    mappingStatus: { $in: ['MAPPED', 'MANUAL'] },
  }).lean();

  if (!questions.length) {
    throw new Error(`No mapped questions found for subject: ${subjectCode}`);
  }

  // ── 2. Pull subject meta for unit + topic dictionary
  const subjectMeta = await SubjectMeta.findById(subjectCode).lean();
  if (!subjectMeta) {
    throw new Error(`SubjectMeta not found for: ${subjectCode}`);
  }

  // ── 3. Derive paper-level stats from AdminUploadLog (not mapped questions)
  // ✅ FIX: count ALL uploaded papers regardless of mapping status
  // ── 3. Derive paper-level stats from AdminUploadLog
// ── 3. Derive paper-level stats from AdminUploadLog
const uploadLogs = await AdminUploadLog.find(
  { subjectCode, status: { $in: ['COMPLETED', 'NEEDS_REVIEW'] } },
  { year: 1, examType: 1, originalPaperCode: 1 }
).lean();

const paperKeys = uploadLogs.map(
  log => `${log.year}_${log.examType}_${log.originalPaperCode}`
);
const totalPapers = paperKeys.length;   // 10 raw papers (for trustMeta display)

// ✅ NEW: exam slots = unique year+examType combos (normalizes parallel papers)
const slotMap = {};
uploadLogs.forEach(log => {
  const key = `${log.year}_${log.examType}`;
  if (!slotMap[key]) slotMap[key] = [];
  slotMap[key].push(log);
});
const examSlots  = Object.entries(slotMap);  // [ ["2022_EVEN_SEM", [log1, log2]], ... ]
const totalSlots = examSlots.length;         // 8 unique exam sittings

const yearsCovered = [...new Set(uploadLogs.map(log => log.year))].sort();
const latestYear   = Math.max(...yearsCovered);

  // ── 4. Build unit analytics
  const unitsAnalytics = subjectMeta.units.map((unit) => {
    const unitQuestions = questions.filter(q => q.unitId === unit.unitId);

    // ── 4a. Topic analytics
    const topicsAnalytics = unit.syllabusTopics.map((topic) => {
      const topicQuestions = unitQuestions.filter(q => q.topicId === topic.topicId);

      const appearedInYears  = [...new Set(topicQuestions.map(q => q.year))].sort();
      const lastAskedYear    = appearedInYears.length
        ? Math.max(...appearedInYears)
        : 0;
      const totalAppearances = topicQuestions.length;

      const score = calcPredictionScore(
        totalAppearances, totalPapers, lastAskedYear, latestYear
      );
      const tag = getPredictionTag(
        score, lastAskedYear, latestYear, totalPapers, totalAppearances
      );

      // ── 4b. SubTopic analytics
      const subTopicsAnalytics = (topic.subTopics || []).map((sub) => {
        const subQs = topicQuestions.filter(q => q.subTopicId === sub.subTopicId);

        const subYears       = [...new Set(subQs.map(q => q.year))].sort();
        const subLastYear    = subYears.length ? Math.max(...subYears) : 0;
        const subAppearances = subQs.length;

        const subScore = calcPredictionScore(
          subAppearances, totalPapers, subLastYear, latestYear
        );
        const subTag = getPredictionTag(
          subScore, subLastYear, latestYear, totalPapers, subAppearances
        );

        return {
          subTopicId:            sub.subTopicId,
          canonicalName:         sub.canonicalName,
          totalAppearances:      subAppearances,
          appearedInYears:       subYears,
          twoMarkCount:          subQs.filter(q => q.markType === 'TWO').length,
          sevenMarkCount:        subQs.filter(q => q.markType === 'SEVEN').length,
          tenMarkCount:          subQs.filter(q => q.markType === 'TEN').length,
          totalMarksAcrossYears: subQs.reduce((s, q) => s + q.marks, 0),
          lastAskedYear:         subLastYear || null,
          predictionTag:         subTag,
          predictionScore:       subScore,
        };
      });

      return {
        topicId:               topic.topicId,
        canonicalName:         topic.canonicalName,
        totalAppearances,
        appearedInYears,
        twoMarkCount:          topicQuestions.filter(q => q.markType === 'TWO').length,
        sevenMarkCount:        topicQuestions.filter(q => q.markType === 'SEVEN').length,
        tenMarkCount:          topicQuestions.filter(q => q.markType === 'TEN').length,
        totalMarksAcrossYears: topicQuestions.reduce((s, q) => s + q.marks, 0),
        lastAskedYear:         lastAskedYear || null,
        predictionTag:         tag,
        predictionScore:       score,
        subTopics:             subTopicsAnalytics,
      };
    });

    // ── 4c. Unit-level aggregates
    // ── 4c. Unit-level aggregates  ← FIXED: split on first '_' only
// ── 4c. Unit-level aggregates
// ── 4c. Unit-level aggregates (slot-normalized — fixes parallel paper inflation)
const unitSlotMarks = examSlots.map(([slotKey, logs]) => {
  const [yr, ...etParts] = slotKey.split('_');
  const et = etParts.join('_');
  const slotQs = unitQuestions.filter(
    q => q.year === Number(yr) && q.examType === et
  );
  const totalMarks = slotQs.reduce((s, q) => s + q.marks, 0);
  return totalMarks / logs.length;   // ← average across parallel papers in slot
});

const avgMarksPerPaper = unitSlotMarks.length
  ? Math.round(unitSlotMarks.reduce((a, b) => a + b, 0) / unitSlotMarks.length)
  : 0;

// frequencyScore = % of exam slots where unit appeared (not raw paper count)
const papersWithUnit = examSlots.filter(([slotKey]) => {
  const [yr, ...etParts] = slotKey.split('_');
  const et = etParts.join('_');
  return unitQuestions.some(
    q => q.year === Number(yr) && q.examType === et
  );
}).length;

const frequencyScore = Math.round((papersWithUnit / totalSlots) * 100);

    // ── 4d. Special topic lists
    const allTopicIds      = unit.syllabusTopics.map(t => t.topicId);
    const askedTopicIds    = new Set(unitQuestions.map(q => q.topicId).filter(Boolean));

    const neverAsked       = allTopicIds.filter(id => !askedTopicIds.has(id));
    const repeatedEveryYear = topicsAnalytics
      .filter(t => t.appearedInYears.length === yearsCovered.length)
      .map(t => t.topicId);

    const dueForComeback   = topicsAnalytics
      .filter(t =>
        t.totalAppearances >= 2 &&
        t.lastAskedYear &&
        (latestYear - t.lastAskedYear) >= 2
      )
      .map(t => t.topicId);

    return {
      unitId:           unit.unitId,
      unitNumber:       unit.unitNumber,
      title:            unit.title,
      frequencyScore,
      avgMarksPerPaper,
      predictionTag:    getUnitPriorityTag(frequencyScore),
      topics:           topicsAnalytics,
      neverAsked,
      dueForComeback,
      repeatedEveryYear,
    };
  });

  // ── 5. Rank units by frequency
  const rankedUnits = [...unitsAnalytics]
    .sort((a, b) => b.frequencyScore - a.frequencyScore)
    .map((u, i) => ({ ...u, priorityRank: i + 1 }));

  // ── 6. Overall insights
 // ── 6. Overall insights
const allTopicStats = rankedUnits.flatMap(u => u.topics);

// yearWiseUnitWeightage: built first
// yearWiseUnitWeightage: averaged across parallel papers per year
const yearWiseUnitWeightage = {};
yearsCovered.forEach((yr) => {
  yearWiseUnitWeightage[yr] = {};
  const yearLogs = uploadLogs.filter(log => log.year === yr);

  rankedUnits.forEach((u) => {
    const marksPerLog = yearLogs.map(log =>
      questions
        .filter(q => q.unitId === u.unitId && q.year === yr && q.examType === log.examType)
        .reduce((s, q) => s + q.marks, 0)
    );
    yearWiseUnitWeightage[yr][u.unitNumber] = marksPerLog.length
      ? Math.round(marksPerLog.reduce((a, b) => a + b, 0) / marksPerLog.length)
      : 0;
  });
});

// unitWeightage: derived by averaging yearWiseUnitWeightage per unit ← FIXED
const unitWeightage = {};
for (let u = 1; u <= 5; u++) {
  const yearValues = Object.values(yearWiseUnitWeightage)
    .map(yr => yr[u] || 0);
  unitWeightage[u] = yearValues.length
    ? Math.round(yearValues.reduce((a, b) => a + b, 0) / yearValues.length)
    : 0;
}

const overallInsights = {
  safestUnits: rankedUnits
    .filter(u => u.predictionTag === 'HIGH_PRIORITY')
    .map(u => u.unitNumber),
  riskiestUnits: rankedUnits
    .filter(u => u.predictionTag === 'LOW_PRIORITY')
    .map(u => u.unitNumber),
  mostRepeatedTopics: allTopicStats
    .sort((a, b) => b.totalAppearances - a.totalAppearances)
    .slice(0, 5)
    .map(t => t.canonicalName),
  neverAskedTopics: rankedUnits.flatMap(u => u.neverAsked),
  unitWeightage,
  yearWiseUnitWeightage,
};

// In recalculateAnalytics — Step 7 trustMeta
const papersPerYear = {};
yearsCovered.forEach(yr => {
  papersPerYear[yr] = uploadLogs.filter(l => l.year === yr).length;
});

const trustMeta = {
  basedOnPapers:          totalPapers,
  uniqueExamSlots:        totalSlots,
  papersPerYear,                         // ← ADD THIS
  yearsCovered:           `${toAcademicYear(yearsCovered[0])} to ${toAcademicYear(latestYear)}`,
  totalQuestionsAnalysed: questions.length,
  confidenceNote: `Based on ${totalPapers} AKTU papers across ${totalSlots} exam sittings (${
    toAcademicYear(yearsCovered[0])} – ${toAcademicYear(latestYear)
  }), ${questions.length} questions analysed`,
};

  // ── 8. Upsert SubjectAnalytics
  const analytics = await SubjectAnalytics.findOneAndUpdate(
    { subjectCode },
    {
      subjectCode,
      totalPapersAnalysed:    totalPapers,
      totalQuestionsAnalysed: questions.length,
      yearsCovered,
      academicYearsCovered:   yearsCovered.map(toAcademicYear),
      lastRecalculated:       new Date(),
      units:                  rankedUnits,
      overallInsights,
      trustMeta,
    },
    { upsert: true, new: true }
  );

  // ── 9. Mark all insight feeds for this subject as stale
  await PYQInsightsFeed.updateMany(
    { subjectCode },
    { isStale: true }
  );

  // ── 10. Update SubjectMeta
  await SubjectMeta.findByIdAndUpdate(subjectCode, {
    analyticsReady:      true,
    totalPapersAnalysed: totalPapers,
    updatedAt:           new Date(),
  });

  return analytics;
};

// ─────────────────────────────────────────────────────────────────
// QUERY: ALL QUESTIONS FOR A UNIT ACROSS YEARS
// Powers the "Unit Deep Dive" view
// ─────────────────────────────────────────────────────────────────

export const getUnitQuestions = async (subjectCode, unitId, filters = {}) => {
  const query = {
    subjectCode,
    unitId,
    mappingStatus: { $in: ['MAPPED', 'MANUAL'] },
  };

  // Optional filters
  if (filters.markType)    query.markType    = filters.markType;
  if (filters.year)        query.year        = Number(filters.year);
  if (filters.topicId)     query.topicId     = filters.topicId;
  if (filters.isRepeat)    query.isRepeat    = true;
  if (filters.hasDiagram)  query.hasDiagram  = true;

  const questions = await PYQQuestion
    .find(query)
    .sort({ year: -1, qNo: 1 })
    .lean();

  // ── Group by topic for the Topic Importance View
  const grouped = {};
  questions.forEach((q) => {
    const key = q.topicId || 'UNMAPPED';
    if (!grouped[key]) {
      grouped[key] = {
        topicId:       q.topicId,
        canonicalName: q.canonicalTopicName || 'Unknown',
        questions:     [],
      };
    }
    grouped[key].questions.push(q);
  });

  // ── Sort groups by question count desc
  const sortedGroups = Object.values(grouped).sort(
    (a, b) => b.questions.length - a.questions.length
  );

  return {
    total:    questions.length,
    unitId,
    subjectCode,
    grouped:  sortedGroups,
    flat:     questions,
  };
};

// ─────────────────────────────────────────────────────────────────
// QUERY: TOPIC DEEP DIVE
// All questions ever asked on a specific topic
// ─────────────────────────────────────────────────────────────────

export const getTopicQuestions = async (subjectCode, topicId) => {
  const questions = await PYQQuestion
    .find({
      subjectCode,
      topicId,
      mappingStatus: { $in: ['MAPPED', 'MANUAL'] },
    })
    .sort({ year: -1 })
    .lean();

  const yearsMap = {};
  questions.forEach((q) => {
    if (!yearsMap[q.year]) yearsMap[q.year] = [];
    yearsMap[q.year].push(q);
  });

  return {
    topicId,
    subjectCode,
    totalAppearances: questions.length,
    yearBreakdown:    yearsMap,
    flat:             questions,
  };
};

// ─────────────────────────────────────────────────────────────────
// QUERY: YEAR COMPARISON MATRIX
// Powers the heatmap — which topics appeared in which years
// ─────────────────────────────────────────────────────────────────

export const getYearComparisonMatrix = async (subjectCode, unitId) => {
  const questions = await PYQQuestion
    .find({
      subjectCode,
      unitId,
      mappingStatus: { $in: ['MAPPED', 'MANUAL'] },
    })
    .lean();

  const years  = [...new Set(questions.map(q => q.year))].sort();
  const topics = [...new Set(questions.map(q => q.topicId).filter(Boolean))];

  // matrix[topicId][year] = { asked: true, marks, questionCount }
  const matrix = {};
  topics.forEach((topicId) => {
    matrix[topicId] = {};
    years.forEach((yr) => {
      const topicYearQs = questions.filter(
        q => q.topicId === topicId && q.year === yr
      );
      matrix[topicId][yr] = {
        asked:         topicYearQs.length > 0,
        questionCount: topicYearQs.length,
        totalMarks:    topicYearQs.reduce((s, q) => s + q.marks, 0),
      };
    });
  });

  return { years, topics, matrix };
};

// ─────────────────────────────────────────────────────────────────
// ADMIN: RESOLVE UNMAPPED QUESTION
// When admin manually maps a pending question
// ─────────────────────────────────────────────────────────────────

export const resolveUnmappedQuestion = async ({
  logId,
  qId,
  unitId,
  topicId,
  subTopicId,
  canonicalTopicName,
  canonicalSubTopicName,
}) => {
  // ── Update the question
  const question = await PYQQuestion.findByIdAndUpdate(
    qId,
    {
      unitId,
      topicId,
      subTopicId:            subTopicId || null,
      canonicalTopicName,
      canonicalSubTopicName: canonicalSubTopicName || null,
      mappingStatus:         'MANUAL',
      mappingConfidence:     'HIGH',
    },
    { new: true }
  );

  if (!question) throw new Error(`Question not found: ${qId}`);

  // ── Mark as resolved in the log
  await AdminUploadLog.updateOne(
    { _id: logId, 'unmappedQueue.qId': qId },
    {
      $set: {
        'unmappedQueue.$.status':              'RESOLVED',
        'unmappedQueue.$.resolvedTopicId':     topicId,
        'unmappedQueue.$.resolvedSubTopicId':  subTopicId || null,
        'unmappedQueue.$.resolvedAt':          new Date(),
      },
      $inc: {
        mappedCount:   1,
        unmappedCount: -1,
      },
    }
  );

  // ── Check if all unmapped resolved → trigger recalculation
  const log = await AdminUploadLog.findById(logId).lean();
  const stillPending = log.unmappedQueue.filter(q => q.status === 'PENDING');

  if (stillPending.length === 0) {
    await recalculateAnalytics(question.subjectCode);
    await AdminUploadLog.findByIdAndUpdate(logId, {
      status:                'COMPLETED',
      analyticsRecalculated: true,
    });
  }

  return { question, remainingUnmapped: stillPending.length };
};

// ─────────────────────────────────────────────────────────────────
// ADMIN: GET UNMAPPED QUEUE FOR A SUBJECT
// ─────────────────────────────────────────────────────────────────

export const getUnmappedQueue = async (subjectCode) => {
  const logs = await AdminUploadLog.find({
    subjectCode,
    unmappedCount: { $gt: 0 },
    status:        { $in: ['NEEDS_REVIEW', 'PROCESSING'] },
  })
  .sort({ processedAt: -1 })
  .lean();

  const queue = logs.flatMap(log =>
    log.unmappedQueue
      .filter(q => q.status === 'PENDING')
      .map(q => ({ ...q, logId: log._id, year: log.year }))
  );

  return { total: queue.length, queue };
};

// ─────────────────────────────────────────────────────────────────
// ADMIN: BULK INSERT QUESTIONS FROM CLAUDE OUTPUT
// Called after you paste Claude JSON into admin panel
// ─────────────────────────────────────────────────────────────────

export const bulkInsertQuestions = async ({
  subjectCode,
  originalPaperCode,
  academicYear,
  year,
  examType,
  questions,
  claudeCallId,
  uploadedBy,
}) => {

  // ── Duplicate check
// NEW — allows KEE401 and KOE049 for same year/examType
const existingLog = await AdminUploadLog.findOne({
  subjectCode,
  originalPaperCode,   // ← KEE401 and KOE049 are different, so no conflict
  year,
  status: { $in: ['COMPLETED', 'NEEDS_REVIEW'] },
});

if (existingLog) {
  throw new Error(
    `Paper already uploaded: ${originalPaperCode} ${year} (subject: ${subjectCode})`
  );
}

  // ── Tag each question + track which indices are unmapped
  const unmappedIndices = [];
  const docs = questions.map((q, i) => {
    const isUnmapped = !q.unitId || !q.topicId || q.mappingStatus === 'UNMAPPED';
    if (isUnmapped) unmappedIndices.push(i);

    return {
      ...q,
      subjectCode,                                        // ← "OS" always
      originalPaperCode: originalPaperCode || subjectCode,
      academicYear,
      year,
      examType,
      mappingStatus: isUnmapped ? 'UNMAPPED' : (q.mappingStatus || 'MAPPED'),
    };
  });

  // ── Bulk insert
  const inserted = await PYQQuestion.insertMany(docs, { ordered: false });

  // ── Build unmapped queue using real _ids from inserted array
  const unmappedQueue = unmappedIndices.map((originalIndex) => {
    const q   = questions[originalIndex];
    const doc = inserted[originalIndex];   // insertMany preserves order
    return {
      qId:           doc._id.toString(),   // ← real MongoDB _id, not TEMP
      rawText:       q.rawText,
      marks:         q.marks,
      suggestedUnit: q.unitId || null,
      status:        'PENDING',
    };
  });

  // ── Create upload log
  const log = await AdminUploadLog.create({
    subjectCode,
    originalPaperCode: originalPaperCode || subjectCode,
    academicYear,
    year,
    examType,
    status:                unmappedQueue.length > 0 ? 'NEEDS_REVIEW' : 'PROCESSING',
    totalQuestions:        inserted.length,
    mappedCount:           inserted.length - unmappedQueue.length,
    unmappedCount:         unmappedQueue.length,
    claudeCallId,
    uploadedBy,
    unmappedQueue,
    insightsFeedStale:     true,
  });

  // ── If fully mapped, recalculate immediately
  if (unmappedQueue.length === 0) {
    await recalculateAnalytics(subjectCode);
    await AdminUploadLog.findByIdAndUpdate(log._id, {
      status:                'COMPLETED',
      analyticsRecalculated: true,
    });
  }

  return {
    inserted:      inserted.length,
    mappedCount:   inserted.length - unmappedQueue.length,
    unmappedCount: unmappedQueue.length,
    logId:         log._id,
    needsReview:   unmappedQueue.length > 0,
  };
};
