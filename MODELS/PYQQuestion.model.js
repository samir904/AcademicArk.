// models/PYQQuestion.js
import mongoose from 'mongoose';

const PYQQuestionSchema = new mongoose.Schema({

  // ── Identity
  subjectCode:  { type: String, required: true, index: true },//so here also be os as subject code right 
  // models/PYQQuestion.js — add after subjectCode
originalPaperCode: { type: String, index: true },  // "KCS401", "RCS401", "BCS401"

  academicYear: { type: String, required: true },   // "2024-25" display label
  year:         { type: Number, required: true },   // 2025 — use for sort/query
  examType: {
    type:    String,
    enum:    ['ODD_SEM', 'EVEN_SEM', 'CARRY_OVER'],
    default: 'EVEN_SEM',                            // ✅ FIX: was 'ODD_SEM', OS is EVEN_SEM
  },
  section: { type: String, enum: ['A', 'B', 'C'] }, // ✅ FIX: added enum constraint
  qNo:     { type: String },                         // "3b", "1a"

  // ── Content
  rawText:  { type: String, required: true },
  marks:    { type: Number, required: true },
  markType: {
    type:     String,
    enum:     ['TWO', 'SEVEN', 'TEN', 'OTHER'],
    required: true,
  },

  // ── Mapping
  unitId:                { type: String, index: true },
  topicId:               { type: String, index: true },
  subTopicId:            { type: String, index: true },
  canonicalTopicName:    { type: String },
  canonicalSubTopicName: { type: String },

  // ── Classification
  questionType: {
    type:    String,
    enum:    ['EXPLAIN', 'DEFINE', 'COMPARE', 'SOLVE', 'DERIVE', 'LIST', 'OTHER'],
    default: 'OTHER',
  },
  hasDiagram: { type: Boolean, default: false },
  difficulty: {
    type:    String,
    enum:    ['EASY', 'MEDIUM', 'HARD'],
    default: 'MEDIUM',
  },

  // ── Repeat tracking
  isRepeat:    { type: Boolean, default: false, index: true },
  repeatYears: [{ type: Number }],   // end years e.g. [2023, 2024]

  // ── Mapping quality
  mappingStatus: {
    type:    String,
    enum:    ['MAPPED', 'UNMAPPED', 'MANUAL'],
    default: 'UNMAPPED',
    index:   true,
  },
  mappingConfidence: {
    type:    String,
    enum:    ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM',
  },

  processedAt: { type: Date, default: Date.now },

}, {
  timestamps: true,
  // ✅ FIX: added toJSON transform to always return [] not null for repeatYears
  toJSON: {
    transform(doc, ret) {
      if (!ret.repeatYears) ret.repeatYears = [];
      return ret;
    }
  }
});

// ── Indexes
PYQQuestionSchema.index({ subjectCode: 1, unitId: 1 });
PYQQuestionSchema.index({ subjectCode: 1, topicId: 1 });
PYQQuestionSchema.index({ subjectCode: 1, year: -1 });
PYQQuestionSchema.index({ subjectCode: 1, unitId: 1, markType: 1 });
PYQQuestionSchema.index({ subjectCode: 1, isRepeat: 1 });
PYQQuestionSchema.index({ subjectCode: 1, year: -1, examType: 1 });
PYQQuestionSchema.index({ subjectCode: 1, originalPaperCode: 1 });

// ✅ NEW: compound index to power topic frequency queries
PYQQuestionSchema.index({ subjectCode: 1, subTopicId: 1, year: -1 });

export default mongoose.model('PYQQuestion', PYQQuestionSchema);