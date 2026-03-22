// BACKEND/MODELS/clientError.model.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

// ─────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────

// Browser / device context
const DeviceSchema = new Schema({
  userAgent:  { type: String, default: null },
  platform:   { type: String, default: null },   // "Win32", "MacIntel", "Linux"
  language:   { type: String, default: null },   // "en-US"
  screenRes:  { type: String, default: null },   // "1920x1080"
  viewport:   { type: String, default: null },   // "1280x720"
  connection: { type: String, default: null },   // "4g", "wifi", "slow-2g"
  isMobile:   { type: Boolean, default: false },
  isPWA:      { type: Boolean, default: false }, // standalone display mode
}, { _id: false });

// Page / navigation context at the time of crash
const RouteSchema = new Schema({
  pathname:   { type: String, default: null },   // "/notes/abc123"
  search:     { type: String, default: null },   // "?semester=4"
  hash:       { type: String, default: null },
  referrer:   { type: String, default: null },   // where they came from
  title:      { type: String, default: null },   // document.title
}, { _id: false });

// For RENDER_CRASH — React component tree info
const ComponentSchema = new Schema({
  componentStack: { type: String, default: null }, // full React component stack
  errorBoundary:  { type: String, default: null }, // which boundary caught it
}, { _id: false });

// For API_ERROR — HTTP request context
const ApiSchema = new Schema({
  url:        { type: String, default: null },
  method:     { type: String, default: null },  // GET POST PUT etc.
  status:     { type: Number, default: null },  // 500, 404, 401
  duration:   { type: Number, default: null },  // ms
  requestId:  { type: String, default: null },  // x-request-id header if set
}, { _id: false });

// Build / deploy metadata
const BuildSchema = new Schema({
  buildId:    { type: String, default: null },  // VITE_BUILD_ID env var
  version:    { type: String, default: null },  // VITE_APP_VERSION
  env:        { type: String, default: "production" }, // "dev"|"staging"|"production"
}, { _id: false });

// ─────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────
const ClientErrorSchema = new Schema(
  {
    // ── Classification ──────────────────────
    type: {
      type:     String,
      enum:     ["RENDER_CRASH", "JS_ERROR", "UNHANDLED_PROMISE", "API_ERROR", "UNKNOWN"],
      default:  "UNKNOWN",
      index:    true,
    },

    // ── Error core ──────────────────────────
    message: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 2000,
    },
    stack: {
      type:     String,
      default:  null,
      maxlength: 10000,  // minified stacks can be long
    },
    source: {
      type:     String,
      default:  null,    // script filename where error originated
    },
    lineno: {
      type:     Number,
      default:  null,
    },
    colno: {
      type:     Number,
      default:  null,
    },

    // ── User context ────────────────────────
    userId: {
      type:  mongoose.Schema.Types.ObjectId,
      ref:   "User",
      default: null,
      index:   true,
    },
    sessionId: {
      type:    String,
      default: null,     // anonymous session token if no auth
    },
    isGuest: {
      type:    Boolean,
      default: false,
    },

    // ── Where it happened ───────────────────
    route:   { type: RouteSchema,    default: () => ({}) },
    device:  { type: DeviceSchema,   default: () => ({}) },
    build:   { type: BuildSchema,    default: () => ({}) },

    // ── Type-specific context ───────────────
    component: { type: ComponentSchema, default: null },  // RENDER_CRASH only
    api:       { type: ApiSchema,       default: null },  // API_ERROR only

    // ── Status / triage ─────────────────────
    status: {
      type:    String,
      enum:    ["NEW", "SEEN", "RESOLVED", "IGNORED"],
      default: "NEW",
      index:   true,
    },

    // ── Deduplication ───────────────────────
    // fingerprint = hash(type + message + source + lineno)
    // lets you count occurrences of the SAME error across users
    fingerprint: {
      type:  String,
      index: true,
      default: null,
    },
    occurrenceCount: {
      type:    Number,
      default: 1,       // bumped by upsert in the controller
    },
    firstSeenAt: {
      type:    Date,
      default: Date.now,
    },
    lastSeenAt: {
      type:    Date,
      default: Date.now,
      index:   true,
    },

    // ── Admin notes ─────────────────────────
    resolvedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    resolvedAt:  { type: Date,   default: null },
    adminNote:   { type: String, default: null },
  },
  {
    timestamps: true,   // createdAt + updatedAt
    collection: "clienterrors",
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// Most common admin queries:
// 1. "show me all NEW errors today" 
ClientErrorSchema.index({ status: 1, createdAt: -1 });

// 2. "show me all errors for user X"
ClientErrorSchema.index({ userId: 1, createdAt: -1 });

// 3. "group by fingerprint to find most frequent errors"
ClientErrorSchema.index({ fingerprint: 1, lastSeenAt: -1 });

// 4. "show me all RENDER_CRASH errors this week"
ClientErrorSchema.index({ type: 1, createdAt: -1 });

// 5. "which route crashes most?"
ClientErrorSchema.index({ "route.pathname": 1, type: 1 });

// ─────────────────────────────────────────────
// STATICS — useful queries pre-built
// ─────────────────────────────────────────────
ClientErrorSchema.statics.getStats = async function () {
  return this.aggregate([
    {
      $group: {
        _id:   "$type",
        count: { $sum: 1 },
        new:   { $sum: { $cond: [{ $eq: ["$status", "NEW"] }, 1, 0] } },
      },
    },
  ]);
};

// Top N most frequent errors by fingerprint
ClientErrorSchema.statics.getTopErrors = async function (limit = 10) {
  return this.aggregate([
    { $match:   { fingerprint: { $ne: null } } },
    { $group:   { _id: "$fingerprint", count: { $sum: "$occurrenceCount" },
                  message:    { $first: "$message" },
                  type:       { $first: "$type" },
                  lastSeenAt: { $max:   "$lastSeenAt" } } },
    { $sort:    { count: -1 } },
    { $limit:   limit },
  ]);
};

const ClientError = model("ClientError", ClientErrorSchema);

export default ClientError;
