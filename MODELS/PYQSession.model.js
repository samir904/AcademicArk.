// MODELS/PYQSession.model.js
import mongoose from "mongoose";
const { Schema, model, Types: { ObjectId } } = mongoose;

const PYQSessionSchema = new Schema({

  // ── Who ──────────────────────────────────────────────────────────
  userId:      { type: ObjectId, ref: "User", default: null },
  device:      { type: String, enum: ["mobile", "desktop"], required: true },

  // ── Feature Type — what did they open ────────────────────────────
  // ── Feature Type — what did they open ────────────────────────────
featureType: {
  type: String,
  required: true,
  enum: [
    "pyq_sheet",       // UnitPYQSheet bottom sheet/drawer from NoteCard or ReadNote
    "imp_sheet",       // ← ADD: ImportantTopicsSheet (Hot Topics + Must-Do Qs)
    "syllabus_sheet",  // SyllabusSheet bottom sheet/drawer from NoteCard
    "pyq_page",        // Full /pyq/* page visit
    "imp_page",
    "predicted_page",    // ← ADD: /pyq/:subjectCode/predicted-paper
  ],
},

  // ── Session surface — how it was rendered ────────────────────────
  surfaceType: {
    type: String,
    enum: [
      "bottom_sheet",   // mobile sheet
      "sidebar_drawer", // desktop drawer/sidebar
      "full_page",      // /pyq/* route
    ],
    required: true,
  },

  // ── Page depth (only for featureType: 'pyq_page') ────────────────
  pageLevel: {
    type: String,
    enum: ["subject_picker", "subject_dashboard", "unit_deepdive", null],
    default: null,
  },

  // ── Subject / Unit context ───────────────────────────────────────
  subjectCode:  { type: String, default: null },  // "CS-401"
  unitId:       { type: String, default: null },  // "OS-U2"
  unitNumber:   { type: Number, default: null },  // 1, 2, 3 ...
  subjectName:  { type: String, default: null },  // "Operating System"

  // ── Source note (if opened from a NoteCard or ReadNote) ──────────
  noteId:       { type: ObjectId, ref: "Note", default: null },
  noteCategory: {
    type: String,
    enum: ["Notes", "PYQ", "Important Question", "Handwritten Notes", null],
    default: null,
  }, // which card type triggered it

  // ── Entry Source — WHERE exactly did the user click ──────────────
  entrySource: {
    type: String,
    required: true,
    enum: [
      // ── From NoteCard (Notes category card)
      "note_card_pill",          // PYQ U1 pill in metadata row of NoteCard
 "note_card_imp_pill",      // ← ADD: Important Topics pill in NoteCard / ImportantQCard
"handwritten_card_imp_pill",

"Imp_Topics_EntryCard",
      // ── From PyqCard (PYQ category card)
      "pyq_card_radar",          // PYQ Radar button in PyqCard metadata row
      "imp_card_radar",

      // ── From HandwrittenCard (if you add PYQ pill there)
      "handwritten_card_pill",   // PYQ pill in HandwrittenCard

      // ── From ImportantQCard (if you add PYQ pill there)
      "importantq_card_pill",    // PYQ pill in ImportantQ card

      // ── From ReadNote page
      "readnote_mobile_header",     // PYQ button in mobile sticky header
      "readnote_desktop_header",    // PYQ button in desktop sticky header
      "readnote_mobile_fab",        // speed dial FAB button
      "readnote_study_tools_sidebar", // desktop study tools panel
      "readnote_study_tools_sheet",   // mobile study tools bottom sheet
      "readnote_insight_banner",      // NoteInsightBanner CTA

      // ── From PYQ pages (page → page navigation)
      "pyq_subject_picker",      // clicked subject card → subject dashboard
      "pyq_subject_dashboard",   // clicked unit card → unit deepdive
      "pyq_unit_deepdive",       // navigated deeper from unit page

      // ── From other surfaces
      "planner_page",            // Planner page CTA
      "note_insight_card",       // insight card CTA (NoteInsightBanner deep link)
      "direct",                  // direct URL / unknown

      "homepage_heatmap",
      "homepage_heatmap_all",
      "homepage_subject_card",   // ✅ ADD — SubjectCard on homepage fires this
      "homepage_predicted_card",    // ← ADD: PredictedPaperCard on homepage
    ],
    default: "direct",
  },

  // ── Page that was active when user clicked (referrer context) ────
  originPage: {
    type: String,
    enum: [
      "notes_library",    // /notes page (Note.jsx)
      "search_page",      // /search page
      "read_note",        // /notes/:id/read
      "pyq_subject_picker",
      "pyq_subject_dashboard",
      "pyq_unit_deepdive",
      "planner",
      "homepage",     // ✅ ADD — your SubjectCard dispatch uses "homepage" not "home"
      "predicted_paper_page",    // ← ADD
      "unknown",
    ],
    default: "unknown",
  },

  // ── What the user did inside the session ─────────────────────────
  interactions: [{
    action: {
      type: String,
      required: true,
      enum: [
        // PYQ sheet / page actions
        "filter_year",            // changed year filter
        "filter_mark_type",       // changed mark type (7-mark, 14-mark etc)
        "filter_repeat_toggle",   // toggled "repeat questions" filter
        "open_topic",             // expanded a topic accordion
        "close_topic",            // collapsed a topic accordion
        "open_question",          // expanded a question
        "close_question",         // collapsed a question
        "open_year_matrix",       // opened year comparison heatmap
        "open_insight_card",      // clicked an insight card
        "paywall_hit",            // hit locked paywall inside insights
        "tab_switch",             // switched tabs inside unit deepdive
        "navigate_to_pyq_page",   // clicked "View Full PYQ" → navigated away to /pyq/* page
        "copy_question",          // copied question text (if feature exists)
        "share_question",         // shared a question

        // Syllabus sheet actions
        "open_syllabus_unit",     // expanded a syllabus unit accordion
        "close_syllabus_unit",    // collapsed
        "open_syllabus_topic",    // expanded topic inside syllabus
        "scroll_syllabus",        // scrolled inside syllabus sheet

        // Both
        "scroll",                 // generic scroll inside sheet/page
        "search_within",          // searched within the sheet/page
        // Inside interactions[].action enum, add after "tab_switch":
"view_predicted_paper",        // page load / first render
"regenerate_paper",            // clicked Refresh button
"change_year",                 // changed year dropdown
"change_exam_type",            // changed odd/even sem dropdown
"print_attempt",               // clicked Print (paid user)
"print_blocked",               // clicked Print (free user → redirected to /support)
"open_section",                // expanded section A/B/C
      ],
    },
    meta: { type: Schema.Types.Mixed, default: {} },
    // meta examples:
    // { year: 2023 }
    // { markType: "SEVEN" }
    // { topicId: "CN-U3-TCP", topicName: "TCP/IP Model" }
    // { unitNumber: 2, unitId: "OS-U2" }
    // { navigatedTo: "/pyq/CS-401/OS-U2" }
    // { paywallReason: "LOCKED_INSIGHT" }
    timestamp: { type: Date, default: Date.now },
  }],

  // ── Outcome ──────────────────────────────────────────────────────
  exitType: {
    type: String,
    enum: [
      "close_button",       // user clicked X / close explicitly
      "backdrop_click",     // tapped backdrop on mobile sheet
      "navigate_away",      // went to a PYQ full page from sheet
      "back_button",        // browser back
      "tab_close",          // beforeunload (best effort on mobile)
      "session_timeout",    // idle > 30 min
      "unknown",
    ],
    default: "unknown",
  },

  // Did the sheet session convert to a full page visit?
  convertedToPage: { type: Boolean, default: false },
  convertedToPageUrl: { type: String, default: null }, // which /pyq/* URL

  // ── Timing ───────────────────────────────────────────────────────
  startedAt:  { type: Date, default: Date.now },
  endedAt:    { type: Date, default: null },
  duration:   { type: Number, default: null },  // seconds

  // ── Engagement depth ─────────────────────────────────────────────
  totalInteractions: { type: Number, default: 0 },  // denormalized count
  maxScrollPercent:  { type: Number, default: 0 },  // 0-100

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────
PYQSessionSchema.index({ userId: 1, startedAt: -1 });
PYQSessionSchema.index({ noteId: 1, featureType: 1, startedAt: -1 });
PYQSessionSchema.index({ subjectCode: 1, unitId: 1, startedAt: -1 });
PYQSessionSchema.index({ entrySource: 1, featureType: 1 });
PYQSessionSchema.index({ originPage: 1, entrySource: 1 });
PYQSessionSchema.index({ featureType: 1, surfaceType: 1, convertedToPage: 1 });
PYQSessionSchema.index({ createdAt: -1 });  // for admin time-range queries

export default model("PYQSession", PYQSessionSchema);