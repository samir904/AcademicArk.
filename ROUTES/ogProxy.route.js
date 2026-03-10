// routes/ogProxy.js
import express from 'express';
import UTMCampaign from '../MODELS/UTMCampaign.model.js';

const router = express.Router();

// Intercept /arkshots before it hits the SPA
router.get('/arkshots', async (req, res) => {
  const { utm_campaign, utm_source } = req.query;

  let ogImage       = 'https://academicark-mvp8.onrender.com/default-og.png'; // fallback
  let ogTitle       = 'ArkShots — AcademicArk';
  let ogDescription = 'Discover shot notes from students across India.';

  // ── Look up campaign thumbnail from MongoDB
  if (utm_campaign) {
    try {
      const campaign = await UTMCampaign.findOne({
        utm_campaign,
        ...(utm_source ? { utm_source } : {}),
      }).select('name thumbnail description');

      if (campaign) {
        ogTitle       = campaign.name || ogTitle;
        ogDescription = campaign.description || ogDescription;

        // ✅ Use the Cloudinary URL you already upload via UTMThumbnailModal
        if (campaign.thumbnail?.secure_url) {
          ogImage = campaign.thumbnail.secure_url;
        }
      }
    } catch (err) {
      console.error('OG lookup failed:', err.message);
    }
  }

  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // ── Return HTML with OG tags + JS redirect to SPA
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${ogTitle}</title>

        <!-- Open Graph (WhatsApp, Telegram, Facebook, LinkedIn) -->
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="${fullUrl}" />
        <meta property="og:title"       content="${ogTitle}" />
        <meta property="og:description" content="${ogDescription}" />
        <meta property="og:image"       content="${ogImage}" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name"   content="AcademicArk" />

        <!-- Twitter Card -->
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="${ogTitle}" />
        <meta name="twitter:description" content="${ogDescription}" />
        <meta name="twitter:image"       content="${ogImage}" />

        <!-- WhatsApp specifically needs this -->
        <meta itemprop="name"        content="${ogTitle}" />
        <meta itemprop="description" content="${ogDescription}" />
        <meta itemprop="image"       content="${ogImage}" />

        <!-- Redirect real users to the SPA immediately -->
        <meta http-equiv="refresh" content="0;url=${fullUrl}" />
        <script>window.location.href = "${fullUrl}";</script>
      </head>
      <body>
        <p>Redirecting to AcademicArk...</p>
      </body>
    </html>
  `);
});

export default router;
