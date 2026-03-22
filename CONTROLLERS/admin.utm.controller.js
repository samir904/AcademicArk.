import UTMCampaign from "../MODELS/UTMCampaign.model.js";
import UTMEvent   from "../MODELS/UTMEvent.model.js";
import User       from "../MODELS/user.model.js";
import AppError   from "../UTIL/error.util.js";
import cloudinary from 'cloudinary'
import satori     from "satori";
import { Resvg }  from "@resvg/resvg-js";
import fs         from "fs";
import path       from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "../UTIL/sendemail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { readFileSync }  from "fs";
import { createRequire } from "module";

// ─────────────────────────────────────────────────────────────────────────────
// FONT LOADER
// ─────────────────────────────────────────────────────────────────────────────
// Replace your loadFont() with this:
const require = createRequire(import.meta.url);

let FONT_BUFFER = null;

const loadFont = () => {
  if (FONT_BUFFER) return FONT_BUFFER;

  // Reads directly from node_modules — no network, always works
  const fontPath = require.resolve(
    '@fontsource/inter/files/inter-latin-700-normal.woff'
  );
  FONT_BUFFER = readFileSync(fontPath);
  return FONT_BUFFER;
};


// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL HELPERS (shared with generate route)
// ─────────────────────────────────────────────────────────────────────────────
// const VARIANT_COLORS = {
//   purple: { primary: '#7C3AED', bg: '#0D0514', accent: '#4C1D95' },
//   blue:   { primary: '#2563EB', bg: '#030D1F', accent: '#1E3A8A' },
//   green:  { primary: '#059669', bg: '#021A10', accent: '#064E3B' },
// };
// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE OF CRASH:
//   8-char hex (#RRGGBBAA) is NOT valid SVG color syntax.
//   Satori passes it through to the SVG, resvg tries to parse it,
//   gets None, calls .unwrap() → panic at geom.rs:27
//
// FIX: replace every 8-char hex with rgba() using these two helpers
// ─────────────────────────────────────────────────────────────────────────────
const a = (hex6, op) => {
  const r = parseInt(hex6.slice(1, 3), 16);
  const g = parseInt(hex6.slice(3, 5), 16);
  const b = parseInt(hex6.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${op})`;
};
const w = (op) => `rgba(255,255,255,${op})`; // white shorthand

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT TOKENS — solid 6-char hex ONLY, no alpha in values
// ─────────────────────────────────────────────────────────────────────────────
const VARIANT_COLORS = {
  purple: {
    primary: '#A78BFA',
    glow:    '#7C3AED',
    accent:  '#4C1D95',
    bg:      '#06040E',
    card:    '#0E0A1A',
    stripe:  'linear-gradient(90deg, #7C3AED, #A78BFA, #C084FC)',
  },
  blue: {
    primary: '#60A5FA',
    glow:    '#2563EB',
    accent:  '#1E3A8A',
    bg:      '#020812',
    card:    '#060F22',
    stripe:  'linear-gradient(90deg, #1D4ED8, #3B82F6, #60A5FA)',
  },
  green: {
    primary: '#34D399',
    glow:    '#059669',
    accent:  '#064E3B',
    bg:      '#020D08',
    card:    '#041409',
    stripe:  'linear-gradient(90deg, #047857, #10B981, #34D399)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// No children property = no empty SVG text node = no geometry panic
const emptyDiv = (style) => ({ type: 'div', props: { style } });

const logoBlock = (c, size = 'md') => {
  const iconPx = size === 'sm' ? '44px' : '54px';
  const iconFs = size === 'sm' ? '22px' : '28px';
  const nameFz = size === 'sm' ? '24px' : '28px';
  const tagFz  = size === 'sm' ? '12px' : '14px';
  return {
    type: 'div',
    props: {
      style: { display: 'flex', alignItems: 'center', gap: '14px' },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: iconPx, height: iconPx,
              background: 'linear-gradient(145deg, #FFFFFF 0%, #D1D5DB 100%)',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              // ✅ rgba() in boxShadow — no 8-char hex
              boxShadow: `0 0 24px ${a(c.glow, 0.27)}`,
            },
            children: {
              type: 'span',
              props: {
                style: { color: '#000000', fontWeight: 'bold', fontSize: iconFs },
                children: 'A',
              },
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '2px' },
            children: [
              {
                type: 'span',
                props: {
                  style: { color: '#FFFFFF', fontSize: nameFz, fontWeight: 'bold', letterSpacing: '-0.02em' },
                  children: 'AcademicArk',
                },
              },
              {
                type: 'span',
                props: {
                  style: { color: c.primary, fontSize: tagFz, letterSpacing: '0.14em', textTransform: 'uppercase' },
                  children: 'Excellence in Learning',
                },
              },
            ],
          },
        },
      ],
    },
  };
};

const sourcePill = (c, text) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex', alignItems: 'center', gap: '8px',
      // ✅ rgba() — no 8-char hex
      background: a(c.glow, 0.18),
      border: `1px solid ${a(c.primary, 0.35)}`,
      borderRadius: '999px', padding: '9px 20px',
    },
    children: {
      type: 'span',
      props: {
        style: { color: c.primary, fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase' },
        children: text,
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE A — "Linear Dark" (purple)
// ─────────────────────────────────────────────────────────────────────────────
const templateLinearDark = (campaign, c) => ({
  type: 'div',
  props: {
    style: {
      width: '1200px', height: '630px',
      background: c.bg, fontFamily: 'Inter',
      position: 'relative', display: 'flex',
    },
    children: [

      // Concentric rings — border colors use rgba()
      emptyDiv({ position: 'absolute', top: '-260px', right: '-240px', width: '600px', height: '600px', borderRadius: '50%', border: `1px solid ${a(c.primary, 0.05)}` }),
      emptyDiv({ position: 'absolute', top: '-190px', right: '-170px', width: '460px', height: '460px', borderRadius: '50%', border: `1px solid ${a(c.primary, 0.07)}` }),
      emptyDiv({ position: 'absolute', top: '-120px', right: '-100px', width: '320px', height: '320px', borderRadius: '50%', border: `1px solid ${a(c.primary, 0.10)}` }),
      emptyDiv({ position: 'absolute', top: '-50px',  right: '-28px',  width: '180px', height: '180px', borderRadius: '50%', border: `1px solid ${a(c.primary, 0.13)}` }),

      // Glow blobs — rgba() background
      emptyDiv({ position: 'absolute', top: '60px',  left: '-100px', width: '580px', height: '420px', borderRadius: '50%', background: a(c.glow, 0.09) }),
      emptyDiv({ position: 'absolute', top: '380px', right: '160px', width: '380px', height: '280px', borderRadius: '50%', background: a(c.accent, 0.14) }),

      // Top scan line — rgba() inside gradient
      emptyDiv({ position: 'absolute', top: '0px', left: '0px', width: '1200px', height: '1px', background: `linear-gradient(90deg, transparent 0%, ${a(c.primary, 0.25)} 50%, transparent 100%)` }),

      // Content layer — last child = rendered on top
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute', top: '0px', left: '0px',
            width: '1200px', height: '630px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '52px 72px',
          },
          children: [

            // TOP
            {
              type: 'div',
              props: {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                children: [
                  logoBlock(c),
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex', alignItems: 'center', gap: '8px',
                        // ✅ rgba() — no 8-char hex
                        background: w(0.027),
                        border: `1px solid ${w(0.063)}`,
                        borderRadius: '999px', padding: '10px 22px',
                      },
                      children: [
                        emptyDiv({ width: '7px', height: '7px', borderRadius: '50%', background: c.primary }),
                        {
                          type: 'span',
                          props: {
                            style: { color: '#9CA3AF', fontSize: '16px', letterSpacing: '0.1em', textTransform: 'uppercase' },
                            children: campaign.utm_source,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },

            // CENTER
            {
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'column' },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
                      children: [
                        emptyDiv({ width: '36px', height: '3px', background: c.primary, borderRadius: '3px' }),
                        {
                          type: 'span',
                          props: {
                            style: { color: c.primary, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em' },
                            children: campaign.utm_campaign?.replace(/_/g, ' ') || 'Campaign',
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: { color: '#FFFFFF', fontSize: '68px', fontWeight: 'bold', lineHeight: '1.04', letterSpacing: '-0.04em', maxWidth: '920px' },
                      children: campaign.name,
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: { color: '#6B7280', fontSize: '24px', lineHeight: '1.45', maxWidth: '780px', marginTop: '18px' },
                      children: campaign.description || 'Shared via AcademicArk',
                    },
                  },
                ],
              },
            },

            // BOTTOM
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: '24px',
                  // ✅ borderTop with rgba() color
                  borderTop: `1px solid ${w(0.047)}`,
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', gap: '10px' },
                      children: [
                        sourcePill(c, campaign.utm_source),
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex', alignItems: 'center',
                              // ✅ rgba()
                              background: w(0.031),
                              border: `1px solid ${w(0.063)}`,
                              borderRadius: '999px', padding: '9px 20px',
                            },
                            children: {
                              type: 'span',
                              props: {
                                style: { color: '#4B5563', fontSize: '16px' },
                                children: campaign.utm_medium,
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: { color: '#374151', fontSize: '17px', letterSpacing: '0.04em' },
                      children: 'academicark-mvp8.onrender.com',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE B — "Glass Card" (blue)
// ─────────────────────────────────────────────────────────────────────────────
const templateResendGlass = (campaign, c) => ({
  type: 'div',
  props: {
    style: {
      width: '1200px', height: '630px',
      background: c.bg, fontFamily: 'Inter',
      position: 'relative', display: 'flex',
    },
    children: [

      // Mesh blobs — rgba()
      emptyDiv({ position: 'absolute', top: '-100px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: a(c.glow, 0.12) }),
      emptyDiv({ position: 'absolute', top: '350px',  right: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: a(c.glow, 0.10) }),
      emptyDiv({ position: 'absolute', top: '30px', right: '160px',   width: '320px', height: '320px', borderRadius: '50%', background: a(c.accent, 0.13) }),

      // Content — last = on top
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute', top: '0px', left: '0px',
            width: '1200px', height: '630px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
          children: {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'space-between',
                width: '960px', height: '480px',
                // ✅ card background as rgba(), no 8-char hex
                background: a(c.card.replace('#','') && c.card, 0.93),
                border: `1px solid ${a(c.primary, 0.13)}`,
                borderRadius: '28px',
                padding: '52px 64px',
                boxShadow: `0 0 80px ${a(c.glow, 0.15)}`,
              },
              children: [

                // TOP
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
                    children: [
                      logoBlock(c, 'sm'),
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: a(c.glow, 0.18),
                            border: `1px solid ${a(c.primary, 0.33)}`,
                            borderRadius: '999px', padding: '8px 18px',
                          },
                          children: {
                            type: 'span',
                            props: {
                              style: { color: c.primary, fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase' },
                              children: campaign.utm_medium,
                            },
                          },
                        },
                      },
                    ],
                  },
                },

                // CENTER
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' },
                    children: [
                      {
                        type: 'span',
                        props: {
                          style: { color: c.primary, fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em' },
                          children: campaign.utm_campaign?.replace(/_/g, ' ') || 'Campaign',
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: { color: '#FFFFFF', fontSize: '58px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.05', letterSpacing: '-0.04em', maxWidth: '820px' },
                          children: campaign.name,
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: { color: '#6B7280', fontSize: '21px', textAlign: 'center', maxWidth: '680px', lineHeight: '1.45' },
                          children: campaign.description || 'Shared via AcademicArk',
                        },
                      },
                    ],
                  },
                },

                // BOTTOM
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '14px', width: '100%',
                      paddingTop: '20px',
                      // ✅ rgba()
                      borderTop: `1px solid ${a(c.primary, 0.10)}`,
                    },
                    children: [
                      emptyDiv({ width: '5px', height: '5px', borderRadius: '50%', background: c.primary }),
                      {
                        type: 'span',
                        props: {
                          style: { color: '#4B5563', fontSize: '17px', letterSpacing: '0.06em' },
                          children: `via ${campaign.utm_source}`,
                        },
                      },
                      emptyDiv({ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }),
                      {
                        type: 'span',
                        props: {
                          style: { color: '#374151', fontSize: '17px', letterSpacing: '0.06em' },
                          children: 'academicark.com',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE C — "Vercel Bold" (green)
// ─────────────────────────────────────────────────────────────────────────────
const templateVercelBold = (campaign, c) => ({
  type: 'div',
  props: {
    style: {
      width: '1200px', height: '630px',
      background: c.bg, fontFamily: 'Inter',
      position: 'relative', display: 'flex', flexDirection: 'column',
    },
    children: [

      // Top stripe — normal flow, always paints first
      emptyDiv({ width: '1200px', height: '4px', background: c.stripe }),

      // Glow blobs — rgba()
      emptyDiv({ position: 'absolute', top: '-200px', right: '-200px', width: '700px', height: '700px', borderRadius: '50%', background: a(c.glow, 0.08) }),
      emptyDiv({ position: 'absolute', top: '330px',  left: '-80px',   width: '500px', height: '500px', borderRadius: '50%', background: a(c.accent, 0.10) }),

      // Content — last child = on top
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute', top: '4px', left: '0px',
            width: '1200px', height: '626px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '44px 72px 52px',
          },
          children: [

            // TOP
            {
              type: 'div',
              props: {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
                children: [
                  logoBlock(c),
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
                      children: [
                        {
                          type: 'span',
                          props: {
                            style: { color: '#374151', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.12em' },
                            children: `via ${campaign.utm_source}`,
                          },
                        },
                        {
                          type: 'span',
                          props: {
                            style: { color: c.primary, fontSize: '20px', fontWeight: 'bold', textTransform: 'capitalize' },
                            children: campaign.utm_medium,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },

            // CENTER — borderLeft with solid 6-char hex: fine
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex', flexDirection: 'column', gap: '16px',
                  paddingLeft: '28px',
                  borderLeft: `5px solid ${c.primary}`,
                },
                children: [
                  {
                    type: 'span',
                    props: {
                      style: { color: '#FFFFFF', fontSize: '70px', fontWeight: 'bold', lineHeight: '1.02', letterSpacing: '-0.045em', maxWidth: '1000px' },
                      children: campaign.name,
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: { color: '#6B7280', fontSize: '24px', lineHeight: '1.4', maxWidth: '800px' },
                      children: campaign.description || 'Shared via AcademicArk',
                    },
                  },
                ],
              },
            },

            // BOTTOM
            {
              type: 'div',
              props: {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', gap: '10px' },
                      children: [
                        sourcePill(c, campaign.utm_source),
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex', alignItems: 'center',
                              // ✅ rgba()
                              background: w(0.027),
                              border: `1px solid ${w(0.051)}`,
                              borderRadius: '999px', padding: '9px 20px',
                            },
                            children: {
                              type: 'span',
                              props: {
                                style: { color: '#4B5563', fontSize: '16px' },
                                children: campaign.utm_campaign?.replace(/_/g, ' ') || campaign.utm_medium,
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: 'span',
                    props: {
                      style: { color: '#374151', fontSize: '17px', letterSpacing: '0.04em' },
                      children: 'academicark.com',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const buildThumbnailElement = (campaign, variant = 'purple') => {
  const c = VARIANT_COLORS[variant] || VARIANT_COLORS.purple;
  if (variant === 'blue')  return templateResendGlass(campaign, c);
  if (variant === 'green') return templateVercelBold(campaign, c);
  return templateLinearDark(campaign, c);
};



const generatePNG = async (campaign, variant) => {
  const fontData = loadFont();  // sync now — no await needed

  const svg = await satori(buildThumbnailElement(campaign, variant), {
    width: 1200, height: 630,
    fonts: [{
      name:   'Inter',
      data:   fontData,
      weight: 700,
      style:  'normal',
    }],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
};

// ═════════════════════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  GET ALL CAMPAIGNS
//     GET /api/v1/admin/utm?status=active&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
export const getAllCampaigns = async (req, res, next) => {
  try {
    const {
      status, utm_source, page  = 1,
      limit  = 20, sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (status)     filter.status     = status;
    if (utm_source) filter.utm_source = utm_source;

    const skip  = (Number(page) - 1) * Number(limit);

    const [campaigns, total] = await Promise.all([
      UTMCampaign
        .find(filter)
        .populate('createdBy', 'fullName email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean({ virtuals: true }),
      UTMCampaign.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    campaigns,
      meta: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  GET SINGLE CAMPAIGN
//     GET /api/v1/admin/utm/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignById = async (req, res, next) => {
  try {
    const campaign = await UTMCampaign
      .findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .lean({ virtuals: true });

    if (!campaign) return next(new AppError('Campaign not found', 404));

    return res.status(200).json({ success: true, data: campaign });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  CREATE CAMPAIGN
//     POST /api/v1/admin/utm
//     Body: { name, description, utm_source, utm_medium, utm_campaign,
//             utm_term, utm_content, baseUrl }
//     File (optional): thumbnail
// ─────────────────────────────────────────────────────────────────────────────
export const createCampaign = async (req, res, next) => {
  try {
    const {
      name, description,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      baseUrl,
    } = req.body;

    if (!name || !utm_source || !utm_medium || !utm_campaign) {
      return next(new AppError('name, utm_source, utm_medium, utm_campaign are required', 400));
    }

    const campaignData = {
      name, description,
      utm_source, utm_medium, utm_campaign,
      utm_term:    utm_term    || null,
      utm_content: utm_content || null,
      baseUrl:     baseUrl     || '/arkshots',
      createdBy:   req.user.id,
    };

    // Optional thumbnail upload on creation
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder:         'AcademicArk/utm-campaigns',
        transformation: [{ width: 1200, height: 630, crop: 'fill' }],
      });
      campaignData.thumbnail = {
        public_id:        result.public_id,
        secure_url:       result.secure_url,
        generatedVariant: req.body.variant || 'custom',
        source:           'custom_upload',
        aspectRatio:      '1200x630',
      };
    }

    const campaign = await UTMCampaign.create(campaignData);

    return res.status(201).json({
      success: true,
      message: 'Campaign created',
      data:    campaign.toJSON(),
    });
  } catch (err) {
    // Duplicate utm combo
    if (err.code === 11000) {
      return next(new AppError('A campaign with this UTM combination already exists', 409));
    }
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4️⃣  UPDATE CAMPAIGN
//     PUT /api/v1/admin/utm/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await UTMCampaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    const ALLOWED_UPDATES = [
      'name', 'description',
      'utm_source', 'utm_medium', 'utm_campaign',
      'utm_term', 'utm_content', 'baseUrl',
    ];

    ALLOWED_UPDATES.forEach(key => {
      if (req.body[key] !== undefined) campaign[key] = req.body[key];
    });

    // New thumbnail file uploaded
    if (req.file) {
      if (campaign.thumbnail?.public_id) {
        await cloudinary.uploader.destroy(campaign.thumbnail.public_id);
      }
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder:         'AcademicArk/utm-campaigns',
        transformation: [{ width: 1200, height: 630, crop: 'fill' }],
      });
      campaign.thumbnail = {
        public_id:        result.public_id,
        secure_url:       result.secure_url,
        generatedVariant: req.body.variant || 'custom',
        source:           'custom_upload',
        aspectRatio:      '1200x630',
      };
    }

    await campaign.save(); // pre-save rebuilds slug + fullUrl

    return res.status(200).json({
      success: true,
      message: 'Campaign updated',
      data:    campaign.toJSON(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('A campaign with this UTM combination already exists', 409));
    }
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5️⃣  DELETE CAMPAIGN
//     DELETE /api/v1/admin/utm/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await UTMCampaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    // Delete Cloudinary thumbnail if exists
    if (campaign.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(campaign.thumbnail.public_id);
    }

    // Delete all associated events
    await UTMEvent.deleteMany({ campaign: campaign._id });

    await campaign.deleteOne();

    return res.status(200).json({ success: true, message: 'Campaign and all events deleted' });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6️⃣  UPDATE STATUS
//     PATCH /api/v1/admin/utm/:id/status
//     Body: { status: 'active' | 'paused' | 'archived' }
// ─────────────────────────────────────────────────────────────────────────────
export const updateCampaignStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID = ['active', 'paused', 'archived'];

    if (!VALID.includes(status)) {
      return next(new AppError(`status must be one of: ${VALID.join(', ')}`, 400));
    }

    const campaign = await UTMCampaign.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!campaign) return next(new AppError('Campaign not found', 404));

    return res.status(200).json({
      success: true,
      message: `Campaign ${status}`,
      data:    { _id: campaign._id, status: campaign.status },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// THUMBNAIL
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 7️⃣  GENERATE THUMBNAIL PREVIEW
//     GET /api/v1/admin/utm/:id/thumbnail/generate?variant=all|purple|blue|green
// ─────────────────────────────────────────────────────────────────────────────
export const generateThumbnailPreview = async (req, res, next) => {
  try {
    const campaign = await UTMCampaign
      .findById(req.params.id)
      .select('name description utm_source utm_medium status')
      .lean();

    if (!campaign) return next(new AppError('Campaign not found', 404));

    const { variant = 'all' } = req.query;

    // Single variant → raw PNG stream
    if (variant !== 'all') {
      if (!VARIANT_COLORS[variant]) {
        return next(new AppError('variant must be purple | blue | green | all', 400));
      }
      const png = await generatePNG(campaign, variant);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${campaign.name}-${variant}.png"`);
      return res.send(png);
    }

    // All 3 → base64 JSON for frontend picker
    const [purple, blue, green] = await Promise.all([
      generatePNG(campaign, 'purple'),
      generatePNG(campaign, 'blue'),
      generatePNG(campaign, 'green'),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        purple: `data:image/png;base64,${purple.toString('base64')}`,
        blue:   `data:image/png;base64,${blue.toString('base64')}`,
        green:  `data:image/png;base64,${green.toString('base64')}`,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8️⃣  UPLOAD THUMBNAIL
//     POST /api/v1/admin/utm/:id/thumbnail
// ─────────────────────────────────────────────────────────────────────────────
export const uploadThumbnail = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded', 400));

    const campaign = await UTMCampaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    if (campaign.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(campaign.thumbnail.public_id);
    }

    const { variant = 'custom', source = 'auto_generated' } = req.body;

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder:         'AcademicArk/utm-campaigns',
      public_id:      `campaign-${campaign._id}-${variant}`,
      overwrite:      true,
      transformation: [{ width: 1200, height: 630, crop: 'fill' }],
    });

    campaign.thumbnail = {
      public_id:        result.public_id,
      secure_url:       result.secure_url,
      generatedVariant: variant,
      source,
      aspectRatio:      '1200x630',
    };

    await campaign.save();

    return res.status(200).json({
      success: true,
      message: 'Thumbnail uploaded',
      data:    campaign.thumbnail,
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9️⃣  DELETE THUMBNAIL
//     DELETE /api/v1/admin/utm/:id/thumbnail
// ─────────────────────────────────────────────────────────────────────────────
export const deleteThumbnail = async (req, res, next) => {
  try {
    const campaign = await UTMCampaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    if (!campaign.thumbnail?.public_id) {
      return next(new AppError('No thumbnail to delete', 400));
    }

    await cloudinary.uploader.destroy(campaign.thumbnail.public_id);

    campaign.thumbnail = {
      public_id: null, secure_url: null,
      generatedVariant: null, source: 'auto_generated', aspectRatio: '1200x630',
    };
    await campaign.save();

    return res.status(200).json({ success: true, message: 'Thumbnail deleted' });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 🔟  GET CAMPAIGN ANALYTICS
//     GET /api/v1/admin/utm/:id/analytics?from=2026-01-01&to=2026-03-01
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const campaign = await UTMCampaign
      .findById(id)
      .lean({ virtuals: true });

    if (!campaign) return next(new AppError('Campaign not found', 404));

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const matchStage = {
      campaign: campaign._id,
      ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
    };

    // ── Events per day ────────────────────────────
    const dailyEvents = await UTMEvent.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date:      { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // ── Device breakdown ──────────────────────────
    const deviceBreakdown = await UTMEvent.aggregate([
      { $match: { ...matchStage, eventType: 'page_visit' } },
      { $group: { _id: '$meta.deviceType', count: { $sum: 1 } } },
    ]);

    // ── Funnel: visit → session → registration ────
    const funnel = await UTMEvent.aggregate([
      { $match: matchStage },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]);

    const funnelMap = {};
    funnel.forEach(f => { funnelMap[f._id] = f.count; });

    return res.status(200).json({
      success: true,
      data: {
        campaign,                  // includes virtuals: conversionRate, emailOpenRate
        dailyEvents,
        deviceBreakdown,
        funnel: {
          page_visit:    funnelMap['page_visit']    || 0,
          session_start: funnelMap['session_start'] || 0,
          shot_viewed:   funnelMap['shot_viewed']   || 0,
          registration:  funnelMap['registration']  || 0,
        },
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣1️⃣ GET EVENT BREAKDOWN
//     GET /api/v1/admin/utm/:id/events?eventType=page_visit&page=1
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignEventBreakdown = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eventType, page = 1, limit = 50 } = req.query;

    const filter = { campaign: id };
    if (eventType) filter.eventType = eventType;

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      UTMEvent
        .find(filter)
        .populate('user', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UTMEvent.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    events,
      meta: {
        total,
        page:       Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣2️⃣ GET A/B TEST RESULTS
//     GET /api/v1/admin/utm/:id/ab-test
//     Compares thumbnail variant performance
// ─────────────────────────────────────────────────────────────────────────────
export const getABTestResults = async (req, res, next) => {
  try {
    const results = await UTMEvent.aggregate([
      {
        $match: {
          campaign:                   { $eq: new (await import('mongoose')).default.Types.ObjectId(req.params.id) },
          'meta.thumbnailVariant':    { $ne: null },
        },
      },
      {
        $group: {
          _id:            '$meta.thumbnailVariant',
          impressions:    { $sum: { $cond: [{ $eq: ['$eventType', 'thumbnail_impression'] }, 1, 0] } },
          clicks:         { $sum: { $cond: [{ $eq: ['$eventType', 'page_visit'] },           1, 0] } },
          registrations:  { $sum: { $cond: [{ $eq: ['$eventType', 'registration'] },         1, 0] } },
        },
      },
      {
        $addFields: {
          ctr: {
            $cond: [
              { $gt: ['$impressions', 0] },
              { $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣3️⃣ SEND EMAIL CAMPAIGN
//     POST /api/v1/admin/utm/email/send
//     Body: { campaignId, subject, htmlBody, targetAudience }
// ─────────────────────────────────────────────────────────────────────────────
export const sendEmailCampaign = async (req, res, next) => {
  try {
    const { campaignId, subject, htmlBody, targetAudience = 'all_users' } = req.body;

    if (!campaignId || !subject || !htmlBody) {
      return next(new AppError('campaignId, subject and htmlBody are required', 400));
    }

    const campaign = await UTMCampaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));
    if (campaign.status !== 'active') {
      return next(new AppError('Campaign must be active to send emails', 400));
    }

    // ── Build recipient list ──────────────────────
    const userFilter = { isVerified: true };

    if (targetAudience === 'sem4_only') {
      userFilter['academicProfile.semester'] = 4;
    } else if (targetAudience === 'active_users') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      userFilter.lastHomepageVisit = { $gte: thirtyDaysAgo };
    } else if (targetAudience === 'inactive_users') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      userFilter.lastHomepageVisit = { $lt: thirtyDaysAgo };
    }

    const recipients = await User
      .find(userFilter)
      .select('_id email fullName')
      .lean();

    if (recipients.length === 0) {
      return next(new AppError('No recipients found for this audience', 400));
    }

    // ── Inject tracking pixel + UTM CTA into htmlBody ─
    const pixelUrl = `${process.env.BACKEND_URL}/api/v1/utm/pixel/${campaignId}`;
    const injectedHtml = htmlBody
      .replace(
        '</body>',
        `<img src="${pixelUrl}?uid={{USER_ID}}" width="1" height="1" style="display:none" /></body>`
      );

    // ── Send in batches of 50 to avoid rate limits ─
    const BATCH_SIZE = 50;
    let sent = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(user => {
          const personalizedHtml = injectedHtml
            .replace(/{{USER_ID}}/g, user.id.toString())
            .replace(/{{NAME}}/g,    user.fullName || 'there')
            .replace(/{{UTM_LINK}}/g, campaign.fullUrl);

          return sendEmail({
            to:      user.email,
            subject,
            html:    personalizedHtml,
          });
        })
      );

      sent += batch.length;
    }

    // ── Update emailMeta on campaign ──────────────
    await UTMCampaign.findByIdAndUpdate(campaignId, {
      $set: {
        'emailMeta.subject':        subject,
        'emailMeta.targetAudience': targetAudience,
        'emailMeta.sentAt':         new Date(),
        'emailMeta.totalSent':      sent,
        'emailMeta.recipientCount': recipients.length,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Email sent to ${sent} recipients`,
      data:    { sent, targetAudience },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣4️⃣ GET EMAIL STATS
//     GET /api/v1/admin/utm/email/stats?campaignId=xxx
// ─────────────────────────────────────────────────────────────────────────────
export const getEmailStats = async (req, res, next) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) return next(new AppError('campaignId is required', 400));

    const campaign = await UTMCampaign
      .findById(campaignId)
      .select('name emailMeta stats')
      .lean({ virtuals: true });

    if (!campaign) return next(new AppError('Campaign not found', 404));

    // Live open count from events
    const liveOpenCount = await UTMEvent.countDocuments({
      campaign:  campaignId,
      eventType: 'email_open',
    });

    return res.status(200).json({
      success: true,
      data: {
        name:          campaign.name,
        emailMeta:     campaign.emailMeta,
        liveOpenCount,                         // cross-check vs denormalized
        emailOpenRate: campaign.emailOpenRate,  // virtual
        emailClickRate: campaign.emailClickRate, // virtual
        totalClicks:   campaign.stats.totalClicks,
      },
    });
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
};
