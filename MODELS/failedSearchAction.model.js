import { Schema, model } from "mongoose";

const failedSearchActionSchema = new Schema(
  {
    searchAnalyticsId: {
      type: Schema.Types.ObjectId,
      ref: "SearchAnalytics",
      required: true
    },

    action: {
      type: String,
      enum: ["opened_library", "retry_search", "clicked_suggestion", "left"],
      required: true
    },

    value: {
      type: String, // e.g. "DS notes"
      default: null
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

/* 🔥 Index */
failedSearchActionSchema.index({ searchAnalyticsId: 1 });
failedSearchActionSchema.index({ action: 1 });

export default model("FailedSearchAction", failedSearchActionSchema);

/*🗃️ 3️⃣ FailedSearchAction (What user did NEXT)

This is pure gold 💰
It tells you what users do after search fails.

Example insights:

72% users click Library

18% try another query

10% leave*/