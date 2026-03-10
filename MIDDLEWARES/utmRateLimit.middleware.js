import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// ── For /track endpoint ───────────────────────────────────
export const utmTrackLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    // Use fingerprint if present, else fall back to IPv6-safe IP
    return req.body?.fingerprint || ipKeyGenerator(req); // 👈 fixed
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many tracking events. Slow down.',
    });
  },
});

// ── For /pixel endpoint ───────────────────────────────────
export const utmPixelLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  // No custom keyGenerator needed — default uses ipKeyGenerator internally ✅
  handler: (req, res) => {
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(pixel);
  },
});
