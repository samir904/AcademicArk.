// BACKEND/CONTROLLERS/clientError.controller.js
import ClientError from "../MODELS/clientError.model.js";
import AppError    from "../UTIL/error.util.js";
import crypto      from "crypto";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Fingerprint = hash(type + message + source + lineno)
// Same error hitting 1000 users → 1 unique fingerprint
const buildFingerprint = (type, message, source, lineno) => {
  const raw = `${type}::${message}::${source ?? ""}::${lineno ?? ""}`;
  return crypto.createHash("md5").update(raw).digest("hex");
};

// Simple in-memory rate limiter per IP
// Prevents a broken frontend from flooding the DB
const ipHitMap   = new Map();
const RATE_LIMIT = 20;    // max errors per IP per window
const RATE_WIN   = 60_000; // 1 minute window

const isRateLimited = (ip) => {
  const now  = Date.now();
  const entry = ipHitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WIN) {
    ipHitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
};

// Parse pagination params consistently
const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// ─────────────────────────────────────────────
// PUBLIC CONTROLLER
// POST /api/v1/client-errors/track
// Called by frontend ErrorBoundary / window.onerror
// No auth required — crash may happen before auth loads
// ─────────────────────────────────────────────
export const trackClientError = async (req, res) => {
  try {
    // ── Rate limit by IP ──────────────────────
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      // 200 not 429 — we don't want the frontend to retry-loop
      return res.status(200).json({ success: true, message: "rate limited" });
    }

    const {
      type       = "UNKNOWN",
      message,
      stack,
      source,
      lineno,
      colno,
      userId,
      sessionId,
      isGuest    = false,
      route      = {},
      device     = {},
      build      = {},
      component  = null,   // RENDER_CRASH only
      api        = null,   // API_ERROR only
    } = req.body;

    // ── Validate minimum payload ──────────────
    if (!message || typeof message !== "string") {
      return res.status(200).json({ success: false, message: "invalid payload" });
    }

    const fingerprint = buildFingerprint(type, message, source, lineno);

    // ── Upsert by fingerprint ─────────────────
    // Same error from different users → bump count, don't create duplicate docs
    const existing = await ClientError.findOne({ fingerprint });

    if (existing) {
      await ClientError.findByIdAndUpdate(existing._id, {
        $inc: { occurrenceCount: 1 },
        $set: { lastSeenAt: new Date() },
        // Keep status as-is — admin may have already seen it
      });
      return res.status(200).json({ success: true, deduplicated: true });
    }

    // ── New unique error — create document ────
    await ClientError.create({
      type:      type.toUpperCase(),
      message:   message.slice(0, 2000),      // enforce maxlength
      stack:     stack?.slice(0, 10000),
      source,
      lineno,
      colno,
      userId:    userId   || null,
      sessionId: sessionId || null,
      isGuest,
      route:   {
        pathname: route.pathname || null,
        search:   route.search   || null,
        hash:     route.hash     || null,
        referrer: route.referrer || null,
        title:    route.title    || null,
      },
      device: {
        userAgent:  device.userAgent  || req.get("user-agent") || null,
        platform:   device.platform   || null,
        language:   device.language   || null,
        screenRes:  device.screenRes  || null,
        viewport:   device.viewport   || null,
        connection: device.connection || null,
        isMobile:   device.isMobile   ?? false,
        isPWA:      device.isPWA      ?? false,
      },
      build: {
        buildId: build.buildId || null,
        version: build.version || null,
        env:     build.env     || process.env.NODE_ENV || "production",
      },
      component: component ?? null,
      api:       api       ?? null,
      fingerprint,
      firstSeenAt: new Date(),
      lastSeenAt:  new Date(),
      occurrenceCount: 1,
      status: "NEW",
    });

    return res.status(201).json({ success: true });

  } catch (err) {
    console.error("❌ trackClientError:", err.message);
    // Always 200 — frontend should never crash harder because of this
    return res.status(200).json({ success: false, message: "internal error" });
  }
};

// ─────────────────────────────────────────────
// ADMIN — GET /api/v1/client-errors
// Paginated list with filters
// ─────────────────────────────────────────────
export const getAllClientErrors = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    // ── Build filter ──────────────────────────
    const filter = {};

    if (req.query.type)   filter.type   = req.query.type.toUpperCase();
    if (req.query.status) filter.status = req.query.status.toUpperCase();
    if (req.query.userId) filter.userId = req.query.userId;

    // Route path search
    if (req.query.route) {
      filter["route.pathname"] = { $regex: req.query.route, $options: "i" };
    }

    // Date range
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    // Message keyword search
    if (req.query.q) {
      filter.message = { $regex: req.query.q, $options: "i" };
    }

    const [errors, total] = await Promise.all([
      ClientError.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "fullName email avatar.secure_url")
        .lean(),
      ClientError.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        errors,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
        },
      },
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — GET /api/v1/client-errors/:id
// Single error full detail
// ─────────────────────────────────────────────
export const getClientErrorById = async (req, res, next) => {
  try {
    const error = await ClientError.findById(req.params.id)
      .populate("userId",     "fullName email avatar.secure_url")
      .populate("resolvedBy", "fullName email")
      .lean();

    if (!error) return next(new AppError("Error not found", 404));

    // Auto-mark NEW → SEEN when admin opens it
    if (error.status === "NEW") {
      await ClientError.findByIdAndUpdate(req.params.id, { status: "SEEN" });
      error.status = "SEEN";
    }

    res.status(200).json({ success: true, data: error });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — GET /api/v1/client-errors/stats
// Summary counts for the dashboard panel
// ─────────────────────────────────────────────
export const getClientErrorStats = async (req, res, next) => {
  try {
    // Optional date range — default last 30 days
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const dateFilter = { createdAt: { $gte: from } };

    const [
      byType,
      byStatus,
      totalNew,
      totalToday,
      topRoutes,
      trend,
    ] = await Promise.all([

      // Count by error type
      ClientError.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$type", count: { $sum: 1 },
            occurrences: { $sum: "$occurrenceCount" } } },
        { $sort: { count: -1 } },
      ]),

      // Count by status
      ClientError.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Unread NEW count
      ClientError.countDocuments({ status: "NEW" }),

      // Errors created today
      ClientError.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),

      // Top 5 crashing routes
      ClientError.aggregate([
        { $match: { ...dateFilter, "route.pathname": { $ne: null } } },
        { $group: { _id: "$route.pathname", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
        { $limit: 5 },
      ]),

      // Daily trend — last 14 days
      ClientError.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Flatten byStatus into a plain object for easy frontend use
    const statusMap = byStatus.reduce((acc, s) => {
      acc[s._id.toLowerCase()] = s.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        totalNew,
        totalToday,
        byType,
        byStatus: statusMap,
        topRoutes,
        trend,
      },
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — GET /api/v1/client-errors/top
// Top N most frequent errors by fingerprint
// ─────────────────────────────────────────────
export const getTopErrors = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const top = await ClientError.aggregate([
      { $match:  { fingerprint: { $ne: null } } },
      {
        $group: {
          _id:            "$fingerprint",
          message:        { $first: "$message"        },
          type:           { $first: "$type"           },
          source:         { $first: "$source"         },
          route:          { $first: "$route.pathname" },
          status:         { $first: "$status"         },
          occurrenceCount:{ $sum:   "$occurrenceCount"},
          lastSeenAt:     { $max:   "$lastSeenAt"     },
          firstSeenAt:    { $min:   "$firstSeenAt"    },
          docId:          { $first: "$_id"            }, // link to detail
        },
      },
      { $sort:  { occurrenceCount: -1 } },
      { $limit: limit },
    ]);

    res.status(200).json({ success: true, data: top });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — PATCH /api/v1/client-errors/:id/status
// Triage — NEW → SEEN → RESOLVED → IGNORED
// ─────────────────────────────────────────────
export const updateErrorStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const allowed = ["NEW", "SEEN", "RESOLVED", "IGNORED"];

    if (!allowed.includes(status?.toUpperCase())) {
      return next(new AppError(`Status must be one of: ${allowed.join(", ")}`, 400));
    }

    const update = {
      status:    status.toUpperCase(),
      adminNote: adminNote ?? undefined,
    };

    // Track who resolved it + when
    if (status.toUpperCase() === "RESOLVED") {
      update.resolvedBy = req.user.id;
      update.resolvedAt = new Date();
    }

    const error = await ClientError.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!error) return next(new AppError("Error not found", 404));

    res.status(200).json({ success: true, data: error });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — PATCH /api/v1/client-errors/bulk
// Bulk update status on multiple errors
// Body: { ids: [...], status: "RESOLVED" }
// ─────────────────────────────────────────────
export const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return next(new AppError("ids must be a non-empty array", 400));
    }

    const allowed = ["SEEN", "RESOLVED", "IGNORED", "NEW"];
    if (!allowed.includes(status?.toUpperCase())) {
      return next(new AppError(`Status must be one of: ${allowed.join(", ")}`, 400));
    }

    const update = { status: status.toUpperCase() };
    if (status.toUpperCase() === "RESOLVED") {
      update.resolvedBy = req.user.id;
      update.resolvedAt = new Date();
    }

    const result = await ClientError.updateMany(
      { _id: { $in: ids } },
      { $set: update }
    );

    res.status(200).json({
      success: true,
      data: { matched: result.matchedCount, modified: result.modifiedCount },
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — DELETE /api/v1/client-errors/:id
// Delete a single error document
// ─────────────────────────────────────────────
export const deleteClientError = async (req, res, next) => {
  try {
    const error = await ClientError.findByIdAndDelete(req.params.id);
    if (!error) return next(new AppError("Error not found", 404));

    res.status(200).json({ success: true, message: "Error deleted" });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────
// ADMIN — DELETE /api/v1/client-errors/resolved
// Cleanup — bulk delete all RESOLVED errors
// Optional: ?olderThan=7  (only delete resolved older than N days)
// ─────────────────────────────────────────────
export const deleteResolved = async (req, res, next) => {
  try {
    const filter = { status: "RESOLVED" };

    if (req.query.olderThan) {
      const days = parseInt(req.query.olderThan) || 7;
      filter.resolvedAt = {
        $lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      };
    }

    const result = await ClientError.deleteMany(filter);

    res.status(200).json({
      success: true,
      data: { deleted: result.deletedCount },
    });
  } catch (err) {
    next(new AppError(err.message, 500));
  }
};
