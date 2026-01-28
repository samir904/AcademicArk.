import { Schema, model } from "mongoose";

const savedFilterSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Human friendly name
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    // The actual filters snapshot
    filters: {
      semester: { type: Number },
      subject: { type: String },
      category: { type: String },
      unit: { type: Number },
      videoChapter: { type: Number },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" }
    },

    // UX helpers
    isDefault: {
      type: Boolean,
      default: false
    },

    usageCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// One user should not have same preset name twice
savedFilterSchema.index(
  { userId: 1, name: 1 },
  { unique: true }
);
const SavedFilter= model("SavedFilter", savedFilterSchema);


export default SavedFilter;