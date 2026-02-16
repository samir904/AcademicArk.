import SeoPage from "../MODELS/seoPage.model.js";
import Note from "../MODELS/note.model.js";

// ========================================
// 🎯 GENERATE MAIN SITEMAP
// ========================================
export const generateSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || "https://academicark-mvp8.onrender.com";

    // 1️⃣ Fetch all published & indexable SEO pages
    const seoPages = await SeoPage.find({
      published: true,
      noIndex: false
    })
      .select("slug lastUpdated changeFrequency sitemapPriority")
      .lean();

    // 2️⃣ Fetch sample top notes (limit to prevent huge sitemap)
    const topNotes = await Note.find({ 
      published: true,
      slug: { $exists: true, $ne: null }
    })
      .select("slug updatedAt")
      .sort({ downloads: -1, views: -1 })
      .limit(100) // Only top 100 notes
      .lean();

    // 3️⃣ Static core pages
    const staticPages = [
      { url: "/", priority: 1.0, changefreq: "daily" },
      { url: "/notes", priority: 0.9, changefreq: "daily" },
      { url: "/search", priority: 0.8, changefreq: "weekly" },
      { url: "/leaderboard", priority: 0.7, changefreq: "weekly" },
      { url: "/about-developer", priority: 0.5, changefreq: "monthly" },
      { url: "/help", priority: 0.6, changefreq: "monthly" },
      { url: "/contact", priority: 0.6, changefreq: "monthly" }
    ];

    // 4️⃣ Start XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // 5️⃣ Add static pages
    staticPages.forEach(page => {
      xml += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`;
    });

    // 6️⃣ Add dynamic SEO pages (HIGH PRIORITY)
    seoPages.forEach(page => {
      const lastmod = page.lastUpdated 
        ? new Date(page.lastUpdated).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      xml += `
  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changeFrequency || "weekly"}</changefreq>
    <priority>${page.sitemapPriority || 0.8}</priority>
  </url>`;
    });

    // 7️⃣ Add top notes (LOWER PRIORITY)
    topNotes.forEach(note => {
      const lastmod = note.updatedAt 
        ? new Date(note.updatedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      xml += `
  <url>
    <loc>${baseUrl}/notes/${note.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    // 8️⃣ Return XML with correct headers
    res.header("Content-Type", "application/xml; charset=utf-8");
    res.header("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.send(xml);

  } catch (error) {
    console.error("❌ Sitemap Generation Error:", error);
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<error>Failed to generate sitemap</error>`);
  }
};

// ========================================
// 🎯 GENERATE ROBOTS.TXT
// ========================================
export const generateRobotsTxt = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || "https://academicark-mvp8.onrender.com";

    const robotsTxt = `# AcademicArk Robots.txt
# Generated dynamically

User-agent: *
Allow: /
Allow: /notes
Allow: /search
Allow: /leaderboard

# Disallow admin and user-specific pages
Disallow: /admin
Disallow: /profile
Disallow: /edit-profile
Disallow: /change-password
Disallow: /bookmarks
Disallow: /downloads
Disallow: /my-analytics
Disallow: /planner
Disallow: /attendance

# Disallow authentication pages
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /reset-password

# Disallow API endpoints
Disallow: /api/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for politeness (optional)
Crawl-delay: 1
`;

    res.header("Content-Type", "text/plain; charset=utf-8");
    res.header("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(robotsTxt);

  } catch (error) {
    console.error("❌ Robots.txt Generation Error:", error);
    res.status(500).send("User-agent: *\nDisallow:");
  }
};

// ========================================
// 🎯 SITEMAP INDEX (for future scaling)
// ========================================
export const generateSitemapIndex = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || "https://academicark-mvp8.onrender.com";

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Main sitemap
    xml += `
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`;

    // Future: Add more sitemaps when you have 1000+ URLs
    // xml += `
    // <sitemap>
    //   <loc>${baseUrl}/sitemap-notes.xml</loc>
    //   <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    // </sitemap>`;

    xml += `\n</sitemapindex>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);

  } catch (error) {
    console.error("❌ Sitemap Index Error:", error);
    res.status(500).send("Error generating sitemap index");
  }
};
