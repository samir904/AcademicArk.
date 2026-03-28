import mongoose from "mongoose";

const relatedNoteClickSchema = new mongoose.Schema(
  {
    // ── The note the user was reading ──────────────────────────────────
    sourceNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Note",
      required: true,
      index: true,
    },

    // ── The related note they clicked ──────────────────────────────────
    targetNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Note",
      required: true,
      index: true,
    },

    // ── Which sidebar section the card appeared in ─────────────────────
    // sameUnitNotes | importantQuestions | pyqs | nextUnitNotes
    // moreLikeThis  | recommendedNotes   | handwrittenNotes
    sectionKey: {
      type: String,
      required: true,
      enum: [
        "sameUnitNotes",
        "importantQuestions",
        "pyqs",
        "nextUnitNotes",
        "moreLikeThis",
        "recommendedNotes",
        "handwrittenNotes",
      ],
    },

    // ── Which strategy was active ──────────────────────────────────────
    strategy: {
      type: String,
      required: true,
      enum: ["STUDY_CONTENT", "ASSESSMENT_CONTENT"],
    },
// ── Position of the clicked card within its section (1-based) ──────
    // 1 = first card in the list, 2 = second, etc.
    // Tells you: are users clicking the top card or scrolling further down?
    position: {
      type:    Number,
      required: true,
      min:     1,
    },
    // ── Optional: user who clicked (null = guest) ──────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      default: null,
      index: true,
    },

    // ── Device hint ────────────────────────────────────────────────────
    device: {
      type: String,
      enum: ["mobile", "desktop"],
      default: "desktop",
    },
  },
  {
    timestamps: true,  // createdAt gives you click time
    versionKey: false,
  }
);

// ── Compound index for analytics queries ────────────────────────────────
// "which sections drive the most clicks for a given source note?"
relatedNoteClickSchema.index({ sourceNote: 1, sectionKey: 1 });

// "which target notes are getting clicked most from related panels?"
relatedNoteClickSchema.index({ targetNote: 1, createdAt: -1 });
// ── NEW: position analytics index ────────────────────────────────────────
// "what is the avg click position per section?"
relatedNoteClickSchema.index({ sectionKey: 1, position: 1 });
const RelatedNoteClick = mongoose.model("RelatedNoteClick", relatedNoteClickSchema);

export default RelatedNoteClick;