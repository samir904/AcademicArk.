// models/AdminUploadLog.js
import mongoose from 'mongoose';

const UnmappedQuestionSchema = new mongoose.Schema({
  qId:               { type: String },
  rawText:           { type: String, required: true },
  marks:             { type: Number },
  suggestedUnit:     { type: String },
  status: {
    type:    String,
    enum:    ['PENDING', 'RESOLVED', 'IGNORED'],
    default: 'PENDING',
  },
  resolvedTopicId:    { type: String },
  resolvedSubTopicId: { type: String },
  resolvedAt:         { type: Date },
}, { _id: false });

const AdminUploadLogSchema = new mongoose.Schema({
  subjectCode:  { type: String, required: true, index: true },
  // In AdminUploadLog schema — add
originalPaperCode: { type: String },

  academicYear: { type: String, required: true }, // "2024-25"
  year:         { type: Number, required: true }, // 2025
  examType: {
    type:    String,
    enum:    ['ODD_SEM', 'EVEN_SEM', 'CARRY_OVER'],
    default: 'ODD_SEM',
  },
  status: {
    type:    String,
    enum:    ['PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW'],
    default: 'PROCESSING',
    index:   true,
  },
  totalQuestions:        { type: Number, default: 0 },
  mappedCount:           { type: Number, default: 0 },
  unmappedCount:         { type: Number, default: 0 },
  analyticsRecalculated: { type: Boolean, default: false },
  insightsFeedStale:     { type: Boolean, default: true },
  uploadedBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claudeCallId:          { type: String },
  unmappedQueue:         [UnmappedQuestionSchema],
  notes:                 { type: String },
  processedAt:           { type: Date, default: Date.now },
}, { timestamps: true });

// ADD THIS
AdminUploadLogSchema.index(
  { originalPaperCode: 1, year: 1 },
  { unique: true }   // KEE401+2022 and KOE049+2022 are now different ✅
);

// Keep this for fast query lookups (non-unique)
AdminUploadLogSchema.index({ subjectCode: 1, year: -1, examType: 1 });

export default mongoose.model('AdminUploadLog', AdminUploadLogSchema);