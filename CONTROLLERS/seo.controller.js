import SeoPage from "../MODELS/seoPage.model.js";
import Note from "../MODELS/note.model.js";

// ========================================
// 🎯 GET SEO PAGE BY SLUG
// ========================================
export const getSeoPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // 1️⃣ Fetch SEO page
    const seoPage = await SeoPage.findOne({
      slug,
      published: true
    }).lean();

    if (!seoPage|| !seoPage.published) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    // 2️⃣ Build dynamic note filters
    const noteFilters = {};

if (seoPage.filters) {

  if (seoPage.filters.semester) {
    noteFilters.semester = { $in: [seoPage.filters.semester] };
  }

  if (seoPage.filters.subject) {
    noteFilters.subject = seoPage.filters.subject.toLowerCase();
  }

  if (seoPage.filters.course) {
    noteFilters.course = seoPage.filters.course;
  }

  if (seoPage.filters.university) {
    noteFilters.university = seoPage.filters.university;
  }

  if (seoPage.filters.category) {
    noteFilters.category = seoPage.filters.category;
  }
}


    // 3️⃣ Fetch notes with filters
    const notes = await Note.find(noteFilters)
      .select('title description subject semester course category fileDetails previewFile downloads views rating createdAt slug isLocked')
      .populate('uploadedBy', 'fullName email avatar')

      .sort({ 
        recommended: -1,      // Recommended first
        recommendedRank: 1,   // Then by rank
        downloads: -1,        // Then by popularity
        views: -1,
        createdAt: -1 
      })
      .limit(50)
      .lean();

    // 4️⃣ Calculate stats
    const totalNotes = notes.length;
    const totalDownloads = notes.reduce((sum, note) => sum + (note.downloads || 0), 0);
    const totalViews = notes.reduce((sum, note) => sum + (note.views || 0), 0);

    // Calculate average rating
    let totalRatings = 0;
    let ratingCount = 0;
    notes.forEach(note => {
      if (note.rating && note.rating.length > 0) {
        note.rating.forEach(r => {
          totalRatings += r.rating;
          ratingCount++;
        });
      }
    });
    const avgRating = ratingCount > 0 ? (totalRatings / ratingCount).toFixed(1) : 0;

    // 5️⃣ Increment view count asynchronously (don't block response)
    SeoPage.updateOne(
      { _id: seoPage._id },
      { $inc: { views: 1 } }
    ).exec(); // Fire and forget

    // 6️⃣ Return response
    res.status(200).json({
      success: true,
      data: {
        seo: {
          title: seoPage.title,
          h1: seoPage.h1,
          metaDescription: seoPage.metaDescription,
          keywords: seoPage.keywords,
          introContent: seoPage.introContent,
          faqs: seoPage.faqs,
          schemaMarkup: seoPage.schemaMarkup,
          slug: seoPage.slug,
          pageType: seoPage.pageType
        },
        notes,
        stats: {
          totalNotes,
          totalDownloads,
          totalViews,
          avgRating
        },
        filters: seoPage.filters // Send back for breadcrumb/UI
      }
    });

  } catch (error) {
    console.error("❌ SEO Page Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load page",
      error: error.message
    });
  }
};

// ========================================
// 🎯 GET ALL SEO PAGES (for sitemap/listing)
// ========================================
export const getAllSeoPages = async (req, res) => {
  try {
    const seoPages = await SeoPage.find({ published: true })
      .select('slug title pageType filters views clicks lastUpdated')
      .sort({ sitemapPriority: -1, views: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: seoPages.length,
      data: seoPages
    });

  } catch (error) {
    console.error("❌ Get All SEO Pages Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch SEO pages"
    });
  }
};

// ========================================
// 🎯 TRACK SEO PAGE CLICK (for analytics)
// ========================================
export const trackSeoPageClick = async (req, res) => {
  try {
    const { slug } = req.params;

    await SeoPage.updateOne(
      { slug },
      { $inc: { clicks: 1 } }
    );

    res.status(200).json({
      success: true,
      message: "Click tracked"
    });

  } catch (error) {
    console.error("❌ Track Click Error:", error);
    res.status(500).json({ success: false });
  }
};
