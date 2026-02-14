import mongoose from "mongoose";

const { Schema } = mongoose;

const pyqSourceMapSchema = new Schema(
  {
    noteId: {
      type: Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true
    },

    university: {
      type: String,
      default: "AKTU",
      index: true
    },

    course: {
      type: String,
      default: "BTECH",
      index: true
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

    year: {
      type: Number,
      required: true,
      index: true
    },

    extractedTopics: [
      {
        topic: {
          type: String,
          required: true,
          trim: true
        },
        normalizedTopic: {
          type: String,
          required: true,
          lowercase: true,
          trim: true
        },
        confidence: {
          type: Number,
          default: 1 // 1 = manual / exact match
        }
      }
    ]
  },
  { timestamps: true }
);

/**
 * 🔑 Prevent same PYQ from being processed twice
 */
pyqSourceMapSchema.index(
  {
    noteId: 1,
    year: 1
  },
  { unique: true }
);

const PYQSourceMap = mongoose.model("PYQSourceMap", pyqSourceMapSchema);

export default PYQSourceMap;
