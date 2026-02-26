// CONTROLLERS/cloudinaryHealth.controller.js
import cloudinary from 'cloudinary';
import AppError   from '../UTIL/error.util.js';
import redisClient from '../CONFIG/redisClient.js'; // your existing redis
// CONTROLLERS/cloudinaryHealth.controller.js — ADD these 3 functions at the bottom
import CloudinarySnapshot from '../MODELS/CloudinarySnapshot.model.js';

const CACHE_KEY = 'cloudinary:health';
const CACHE_TTL = 300; // 5 minutes — Cloudinary Admin API rate limit: 500 req/hr

// ─────────────────────────────────────────────
// 🌥️ GET /api/v1/admin/cloudinary/health
// ─────────────────────────────────────────────
export const getCloudinaryHealth = async (req, res, next) => {
  try {

    // ── 1. Try Redis cache first
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) {
      return res.status(200).json({
        success:  true,
        cached:   true,
        cachedAt: JSON.parse(cached)._cachedAt,
        data:     JSON.parse(cached),
      });
    }

    // ── 2. Ping check (is Cloudinary reachable?)
    let pingStatus = 'ok';
    try {
      await cloudinary.v2.api.ping();
    } catch {
      pingStatus = 'unreachable';
    }

    // ── 3. Fetch usage stats
    const usage = await cloudinary.v2.api.usage();

    // ── 4. Shape the response
    const bytesToMB = (b) => parseFloat((b / 1024 / 1024).toFixed(2));
    const bytesToGB = (b) => parseFloat((b / 1024 / 1024 / 1024).toFixed(3));

    // ── Free plan known limits (API returns 0 for free tier)
const FREE_PLAN_LIMITS = {
  storageGB:         25,   // 25 GB storage
  bandwidthGB:       25,   // 25 GB/month bandwidth
  transformations:   25000,   // ✅ was 25 → 25,000 credits/month   // 25 transformation credits/month
};

const health = {
  _cachedAt: new Date().toISOString(),
  status:    pingStatus,
  plan:      usage.plan || 'Unknown',

  storage: {
    usedBytes:  usage.storage?.usage ?? 0,
    limitBytes: usage.storage?.limit ?? 0,
    usedMB:     bytesToMB(usage.storage?.usage ?? 0),
    limitGB:    bytesToGB(usage.storage?.limit ?? 0) ||
                FREE_PLAN_LIMITS.storageGB,  // ✅ fallback for free plan
    usedPct: usage.storage?.limit > 0
      ? parseFloat((usage.storage?.used_percent ?? 0).toFixed(2))
      // ✅ manually calculate when limit is 0 (free plan)
      : parseFloat(
          ((bytesToMB(usage.storage?.usage ?? 0) / (FREE_PLAN_LIMITS.storageGB * 1024)) * 100)
          .toFixed(2)
        ),
  },

  bandwidth: {
    usedBytes:  usage.bandwidth?.usage ?? 0,
    limitBytes: usage.bandwidth?.limit ?? 0,
    usedMB:     bytesToMB(usage.bandwidth?.usage ?? 0),
    limitGB:    bytesToGB(usage.bandwidth?.limit ?? 0) ||
                FREE_PLAN_LIMITS.bandwidthGB,  // ✅ fallback
    usedPct: usage.bandwidth?.limit > 0
      ? parseFloat((usage.bandwidth?.used_percent ?? 0).toFixed(2))
      : parseFloat(
          ((bytesToMB(usage.bandwidth?.usage ?? 0) / (FREE_PLAN_LIMITS.bandwidthGB * 1024)) * 100)
          .toFixed(2)
        ),
  },

  transformations: {
    used:    usage.transformations?.usage ?? 0,
    limit:   usage.transformations?.limit || FREE_PLAN_LIMITS.transformations, // ✅
    usedPct: usage.transformations?.limit > 0
      ? parseFloat((usage.transformations?.used_percent ?? 0).toFixed(2))
      : parseFloat(
          (((usage.transformations?.usage ?? 0) / FREE_PLAN_LIMITS.transformations) * 100)
          .toFixed(2)
        ),
  },

  resources: {
    total:   usage.resources         ?? 0,
    derived: usage.derived_resources ?? 0,
    objects: usage.objects?.usage    ?? 0,
  },

  limits: {
    imageMaxSizeMB: bytesToMB(usage.media_limits?.image_max_size_bytes ?? 0),
    videoMaxSizeMB: bytesToMB(usage.media_limits?.video_max_size_bytes ?? 0),
    rawMaxSizeMB:   bytesToMB(usage.media_limits?.raw_max_size_bytes   ?? 0),
  },

  lastUpdated: usage.last_updated ?? null,
};


    // ── 5. Cache in Redis for 5 minutes
    await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(health));

    res.status(200).json({
      success: true,
      cached:  false,
      data:    health,
    });

  } catch (err) {
    console.error('[CLOUDINARY_HEALTH]', err.message);
    return next(new AppError('Failed to fetch Cloudinary health', 500));
  }
};

// ─────────────────────────────────────────────
// 🌥️ GET /api/v1/admin/cloudinary/resources
// Returns breakdown by resource_type (image/video/raw)
// ─────────────────────────────────────────────
export const getCloudinaryResources = async (req, res, next) => {
  try {
    const RKEY   = 'cloudinary:resources';
    const cached = await redisClient.get(RKEY);
    if (cached) return res.status(200).json({ success: true, cached: true, data: JSON.parse(cached) });

    // ✅ cloudinary.v2.api.resources() does NOT return total_count
    // ✅ Search API is the ONLY reliable way to get total_count
    const [images, videos, raws] = await Promise.all([
      cloudinary.v2.search
        .expression('folder:AcademicArk AND resource_type:image')
        .max_results(1)   // we only need total_count, not actual files
        .execute(),
      cloudinary.v2.search
        .expression('folder:AcademicArk AND resource_type:video')
        .max_results(1)
        .execute(),
      cloudinary.v2.search
        .expression('folder:AcademicArk AND resource_type:raw')
        .max_results(1)
        .execute(),
    ]);

    const data = {
      images: images.total_count ?? 0,  // ← 483 PDFs will show here
      videos: videos.total_count ?? 0,
      raw:    raws.total_count   ?? 0,
      total: (images.total_count ?? 0) + (videos.total_count ?? 0) + (raws.total_count ?? 0),
      folder: 'AcademicArk',
    };

    await redisClient.setEx(RKEY, CACHE_TTL, JSON.stringify(data));
    res.status(200).json({ success: true, cached: false, data });

  } catch (err) {
    console.error('[CLOUDINARY_RESOURCES]', err.message);
    return next(new AppError('Failed to fetch Cloudinary resources', 500));
  }
};


// ─────────────────────────────────────────────
// 📊 GET /api/v1/admin/cloudinary/snapshots
// Query: ?days=7 | ?days=30 (default 30)
// ─────────────────────────────────────────────
export const getCloudinarySnapshots = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await CloudinarySnapshot.find(
      { timestamp: { $gte: since } },
      { _id: 0, __v: 0 }           // exclude noise
    )
      .sort({ timestamp: 1 })      // oldest → newest (good for charts)
      .lean();

    res.status(200).json({
      success: true,
      count:   snapshots.length,
      days,
      data:    snapshots,
    });

  } catch (err) {
    console.error('[CLOUDINARY_SNAPSHOTS]', err.message);
    return next(new AppError('Failed to fetch Cloudinary snapshots', 500));
  }
};

// ─────────────────────────────────────────────
// 📊 GET /api/v1/admin/cloudinary/snapshots/latest
// ─────────────────────────────────────────────
export const getLatestSnapshot = async (req, res, next) => {
  try {
    const snapshot = await CloudinarySnapshot.findOne(
      {},
      { _id: 0, __v: 0 }
    )
      .sort({ timestamp: -1 })
      .lean();

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: 'No snapshots yet. Cron runs daily at midnight OR use /trigger to save one now.',
      });
    }

    res.status(200).json({ success: true, data: snapshot });

  } catch (err) {
    console.error('[CLOUDINARY_LATEST_SNAPSHOT]', err.message);
    return next(new AppError('Failed to fetch latest snapshot', 500));
  }
};

// ─────────────────────────────────────────────
// 🔧 POST /api/v1/admin/cloudinary/snapshots/trigger
// Manually save a snapshot right now (admin only)
// ─────────────────────────────────────────────
export const triggerSnapshot = async (req, res, next) => {
  try {
    const usage    = await cloudinary.v2.api.usage();
    const toMB     = (b) => parseFloat((b / 1024 / 1024).toFixed(2));
    const toGB     = (b) => parseFloat((b / 1024 / 1024 / 1024).toFixed(3));

    const FREE_PLAN_LIMITS = {
      storageGB:       25,
      bandwidthGB:     25,
      transformations: 25000,
    };

    // ── Resource counts via Search API
    const [images, videos, raws] = await Promise.all([
      cloudinary.v2.search.expression('folder:AcademicArk AND resource_type:image').max_results(1).execute(),
      cloudinary.v2.search.expression('folder:AcademicArk AND resource_type:video').max_results(1).execute(),
      cloudinary.v2.search.expression('folder:AcademicArk AND resource_type:raw').max_results(1).execute(),
    ]);

    const snapshot = await CloudinarySnapshot.create({
      timestamp: new Date(),

      storage: {
        usedMB:  toMB(usage.storage?.usage ?? 0),
        limitGB: toGB(usage.storage?.limit ?? 0) || FREE_PLAN_LIMITS.storageGB,
        usedPct: usage.storage?.limit > 0
          ? parseFloat((usage.storage?.used_percent ?? 0).toFixed(2))
          : parseFloat(((toMB(usage.storage?.usage ?? 0) / (FREE_PLAN_LIMITS.storageGB * 1024)) * 100).toFixed(2)),
      },

      bandwidth: {
        usedMB:  toMB(usage.bandwidth?.usage ?? 0),
        limitGB: toGB(usage.bandwidth?.limit ?? 0) || FREE_PLAN_LIMITS.bandwidthGB,
        usedPct: usage.bandwidth?.limit > 0
          ? parseFloat((usage.bandwidth?.used_percent ?? 0).toFixed(2))
          : parseFloat(((toMB(usage.bandwidth?.usage ?? 0) / (FREE_PLAN_LIMITS.bandwidthGB * 1024)) * 100).toFixed(2)),
      },

      transformations: {
        used:    usage.transformations?.usage ?? 0,
        limit:   usage.transformations?.limit || FREE_PLAN_LIMITS.transformations,
        usedPct: usage.transformations?.limit > 0
          ? parseFloat((usage.transformations?.used_percent ?? 0).toFixed(2))
          : parseFloat((((usage.transformations?.usage ?? 0) / FREE_PLAN_LIMITS.transformations) * 100).toFixed(2)),
      },

      resources: {
        total:  (images.total_count ?? 0) + (videos.total_count ?? 0) + (raws.total_count ?? 0),
        images:  images.total_count ?? 0,
        videos:  videos.total_count ?? 0,
        raw:     raws.total_count   ?? 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Snapshot saved successfully',
      data:    snapshot,
    });

  } catch (err) {
    console.error('[CLOUDINARY_TRIGGER]', err.message);
    return next(new AppError('Failed to trigger snapshot', 500));
  }
};

