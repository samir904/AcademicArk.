// models/SubjectAnalytics.js
import mongoose from 'mongoose';

const SubTopicAnalyticsSchema = new mongoose.Schema({
  subTopicId:            { type: String, required: true },
  canonicalName:         { type: String, required: true },
  totalAppearances:      { type: Number, default: 0 },
  appearedInYears:       [{ type: Number }],   // end years
  twoMarkCount:          { type: Number, default: 0 },
  sevenMarkCount:        { type: Number, default: 0 },
  tenMarkCount:          { type: Number, default: 0 },
  totalMarksAcrossYears: { type: Number, default: 0 },
  lastAskedYear:         { type: Number },     // end year
  predictionTag: {
    type: String,
    enum: ['VERY_LIKELY', 'LIKELY', 'DUE_COMEBACK', 'WATCH_OUT', 'LOW_PRIORITY'],
  },
  predictionScore: { type: Number, min: 0, max: 100 },
}, { _id: false });

const TopicAnalyticsSchema = new mongoose.Schema({
  topicId:               { type: String, required: true },
  canonicalName:         { type: String, required: true },
  totalAppearances:      { type: Number, default: 0 },
  appearedInYears:       [{ type: Number }],
  twoMarkCount:          { type: Number, default: 0 },
  sevenMarkCount:        { type: Number, default: 0 },
  tenMarkCount:          { type: Number, default: 0 },
  totalMarksAcrossYears: { type: Number, default: 0 },
  lastAskedYear:         { type: Number },
  predictionTag: {
    type: String,
    enum: ['VERY_LIKELY', 'LIKELY', 'DUE_COMEBACK', 'WATCH_OUT', 'LOW_PRIORITY'],
  },
  predictionScore: { type: Number, min: 0, max: 100 },
  subTopics:       [SubTopicAnalyticsSchema],
}, { _id: false });

const UnitAnalyticsSchema = new mongoose.Schema({
  unitId:           { type: String, required: true },
  unitNumber:       { type: Number, required: true },
  title:            { type: String },
  frequencyScore:   { type: Number, default: 0 },
  avgMarksPerPaper: { type: Number, default: 0 },
  priorityRank:     { type: Number },
  predictionTag: {
    type: String,
    enum: ['HIGH_PRIORITY', 'MEDIUM_PRIORITY', 'LOW_PRIORITY'],
  },
  topics:           [TopicAnalyticsSchema],
  neverAsked:       [{ type: String }],
  dueForComeback:   [{ type: String }],
  repeatedEveryYear:[{ type: String }],
}, { _id: false });

const SubjectAnalyticsSchema = new mongoose.Schema({
  subjectCode:            { type: String, required: true, unique: true },
  totalPapersAnalysed:    { type: Number, default: 0 },
  totalQuestionsAnalysed: { type: Number, default: 0 },

  yearsCovered:           [{ type: Number }],  // [2021,2022,2023,2024,2025]
  academicYearsCovered:   [{ type: String }],  // ["2020-21","2021-22"]

  lastRecalculated: { type: Date, default: Date.now },
  units:            [UnitAnalyticsSchema],

  overallInsights: {
    safestUnits:           [{ type: Number }],
    riskiestUnits:         [{ type: Number }],
    mostRepeatedTopics:    [{ type: String }],
    neverAskedTopics:      [{ type: String }],
    unitWeightage:         { type: Map, of: Number },
    yearWiseUnitWeightage: { type: Map, of: Object },
  },

  trustMeta: {
  basedOnPapers:          { type: Number },
  uniqueExamSlots:        { type: Number },
  papersPerYear:          { type: Map, of: Number },  // ← ADD
  yearsCovered:           { type: String },
  totalQuestionsAnalysed: { type: Number },
  confidenceNote:         { type: String },
},
}, { timestamps: true });

export default mongoose.model('SubjectAnalytics', SubjectAnalyticsSchema);