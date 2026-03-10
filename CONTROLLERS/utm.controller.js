import UTMCampaign from "../MODELS/UTMCampaign.model.js";
import UTMEvent   from "../MODELS/UTMEvent.model.js";
import AppError   from "../UTIL/error.util.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_EVENTS = new Set([
  'page_visit',
  'session_start',
  'shot_viewed',
  'shot_bookmarked',
  'registration',
  'thumbnail_impression',
  'cta_click',
  'email_open',
]);

// 1px transparent PNG — returned by pixel route
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const detectDevice = (ua = '') => {
  if (/mobile/i.test(ua))  return 'mobile';
  if (/tablet/i.test(ua))  return 'tablet';
  return 'desktop';
};

// Maps eventType → which stats.field to $inc
const STATS_MAP = {
  page_visit:           'stats.totalClicks',
  registration:         'stats.registrations',
  shot_viewed:          'stats.shotsViewed',
  shot_bookmarked:      'stats.shotsBookmarked',
  thumbnail_impression: 'stats.thumbnailImpressions',
  email_open:           'emailMeta.totalOpens',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  TRACK EVENT
//     POST /api/v1/utm/track
//     Body: { campaignId, eventType, fingerprint, meta }
//     Auth: optional (req.user may be null)
// ─────────────────────────────────────────────────────────────────────────────
export const trackEvent = async (req, res, next) => {
  try {
    const {
      campaignId,
      eventType,
      fingerprint = null,
      meta        = {},
    } = req.body;

    // ── Validation ────────────────────────────────
    if (!campaignId || !eventType) {
      return next(new AppError('campaignId and eventType are required', 400));
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
      return next(new AppError(`Invalid eventType: ${eventType}`, 400));
    }

    // ── Campaign lookup ───────────────────────────
    const campaign = await UTMCampaign.findById(campaignId)
      .select('_id status utm_source utm_medium utm_campaign utm_term utm_content stats emailMeta')
      .lean();

    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    if (campaign.status !== 'active') {
      // Silently ignore events for paused/archived campaigns
      return res.status(200).json({ success: true, message: 'Ignored — campaign inactive' });
    }

    const userId  = req.user?.id || null;
    const ip      = req.ip;
    const ua      = req.headers['user-agent'] || '';
    const device  = detectDevice(ua);

    // ── Determine isFirstVisit ────────────────────
    // First visit = no prior page_visit event from this user/fingerprint
    let isFirstVisit = false;
    if (eventType === 'page_visit') {
      const identifier = userId
        ? { user: userId, campaign: campaignId }
        : { fingerprint,  campaign: campaignId };

      const prior = await UTMEvent.findOne({
        ...identifier,
        eventType: 'page_visit',
      }).select('_id').lean();

      isFirstVisit = !prior;
    }

    // ── Create event ──────────────────────────────
    await UTMEvent.create({
      campaign:     campaignId,
      utm_source:   campaign.utm_source,
      utm_medium:   campaign.utm_medium,
      utm_campaign: campaign.utm_campaign,
      utm_term:     campaign.utm_term   || null,
      utm_content:  campaign.utm_content || null,
      user:         userId,
      fingerprint,
      ip,
      userAgent:    ua,
      isFirstVisit,
      eventType,
      meta: {
          shotId:           meta.shotId           || null,
          sessionId:        meta.sessionId        || null,
          shotsViewedCount: meta.shotsViewedCount || null,
          viewMode:         meta.viewMode         || null,
          referrer:         meta.referrer         || req.headers.referer || null,
          landingUrl:       meta.landingUrl       || null,   // ✅ ADD THIS LINE
          deviceType:       device,
          thumbnailUrl:     meta.thumbnailUrl     || null,
          thumbnailVariant: meta.thumbnailVariant || null,
          campaignVariant:  meta.campaignVariant  || null,
        },
    });

    // ── Update denormalized stats on campaign ─────
    const incField = STATS_MAP[eventType];
    const incOps   = incField ? { [incField]: 1 } : {};

    // Unique visitors — only count first visits
    if (isFirstVisit) {
      incOps['stats.uniqueVisitors'] = 1;
    }

    // Returning users — logged-in user who visited before
    if (eventType === 'page_visit' && !isFirstVisit && userId) {
      incOps['stats.returningUsers'] = 1;
    }

    if (Object.keys(incOps).length > 0) {
      await UTMCampaign.findByIdAndUpdate(campaignId, { $inc: incOps });
    }

    return res.status(200).json({ success: true, message: 'Event tracked' });

  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  TRACK PIXEL (email open)
//     GET /api/v1/utm/pixel/:campaignId?uid=<userId>
//     No auth — email clients load this with zero headers
//     MUST always return a valid PNG — even on errors
// ─────────────────────────────────────────────────────────────────────────────
export const trackPixel = async (req, res) => {
  // Always send pixel FIRST — don't keep email client waiting
  res.setHeader('Content-Type',  'image/png');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma',        'no-cache');
  res.setHeader('Expires',       '0');
  res.send(TRACKING_PIXEL);

  // Fire-and-forget tracking AFTER response sent
  try {
    const { campaignId }  = req.params;
    const { uid = null }  = req.query;
    const ua              = req.headers['user-agent'] || '';

    const campaign = await UTMCampaign.findById(campaignId)
      .select('_id status')
      .lean();

    if (!campaign || campaign.status !== 'active') return;

    await UTMEvent.create({
      campaign:     campaignId,
      user:         uid || null,
      ip:           req.ip,
      userAgent:    ua,
      eventType:    'email_open',
      isFirstVisit: false,
      meta: {
        deviceType: detectDevice(ua),
        referrer:   'email',
      },
    });

    await UTMCampaign.findByIdAndUpdate(campaignId, {
      $inc: { 'emailMeta.totalOpens': 1 },
    });

  } catch {
    // Silently swallow — pixel already sent, nothing to do
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  GET CAMPAIGN BY SLUG
//     GET /api/v1/utm/c/:slug
//     Public — used by frontend to resolve slug → campaign data
//     Returns only safe public fields, never internal stats
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/utm/c/:identifier
export const getCampaignBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params; // ✅ was: const { slug } = req.params

   // utm.controller.js — getCampaignBySlug
const campaign = await UTMCampaign
  .findOne({
    $or: [{ slug }, { utm_campaign: slug }],
    status: 'active',
  })
  .select('name description thumbnail utm_source utm_medium utm_campaign utm_content fullUrl slug status') // ✅ ADD status
  .lean();


    if (!campaign) {
      return next(new AppError('Campaign not found or inactive', 404));
    }

    return res.status(200).json({
      success: true,
      data:    campaign,
    });

  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};
