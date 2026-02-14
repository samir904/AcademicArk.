import mongoose from "mongoose";

const { Schema } = mongoose;

const questionFrequencySchema = new Schema(
  {
    university: {
      type: String,
      default: "AKTU",
      index: true,
      trim: true
    },

    course: {
      type: String,
      default: "BTECH",
      index: true,
      trim: true
    },

    subject: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    unit: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      index: true
    },

    topic: {
      type: String,
      required: true,
      trim: true
    },

    normalizedTopic: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true
    },

    appearanceCount: {
      type: Number,
      default: 0,
      min: 0
    },

    years: {
      type: [Number],
      default: []
    },

    lastAppeared: {
      type: Number,
      default: null
    },

    importanceScore: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

/**
 * 🔑 Composite index
 * Ensures ONE document per topic per unit per subject
 * Also makes upsert extremely fast
 */
questionFrequencySchema.index({
  subject: 1,
  unit: 1,
  normalizedTopic: 1
});

/**
 * 🧠 Optional helper: normalize topic before save
 * (Safety net, not mandatory)
 */
questionFrequencySchema.pre("validate", function (next) {
  if (this.topic && !this.normalizedTopic) {
    this.normalizedTopic = this.topic.toLowerCase().trim();
  }
  next();
});

const QuestionFrequency = mongoose.model(
  "QuestionFrequency",
  questionFrequencySchema
);

export default QuestionFrequency;
