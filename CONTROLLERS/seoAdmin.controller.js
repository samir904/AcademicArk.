import SeoPage from "../MODELS/seoPage.model.js";
import Note from "../MODELS/note.model.js";

// ========================================
// 🎯 CREATE NEW SEO PAGE
// ========================================
export const createSeoPage = async (req, res) => {
  try {
    const {
      slug,
      pageType,
      title,
      h1,
      metaDescription,
      keywords,
      introContent,
      filters,
      faqs,
      published,
      changeFrequency,
      sitemapPriority
    } = req.body;

    // Validate required fields
    if (!slug || !pageType || !title || !h1 || !metaDescription || !introContent) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Check if slug already exists
  const normalizedSlug = slug.trim().toLowerCase();

const existingPage = await SeoPage.findOne({ slug: normalizedSlug });
    if (existingPage) {
      return res.status(400).json({
        success: false,
        message: "SEO page with this slug already exists"
      });
    }

    // Auto-generate schema markup based on page type
    let schemaMarkup = generateSchemaMarkup(pageType, { title, metaDescription, slug });

    // Create new SEO page
    const seoPage = await SeoPage.create({
      slug: normalizedSlug,
      pageType,
      title,
      h1,
      metaDescription,
      keywords: keywords || [],
      introContent,
      filters: filters || {},
      faqs: faqs || [],
      schemaMarkup,
      published: published !== undefined ? published : true,
      changeFrequency: changeFrequency || 'weekly',
      sitemapPriority: sitemapPriority || 0.8
    });

    res.status(201).json({
      success: true,
      message: "SEO page created successfully",
      data: seoPage
    });

  } catch (error) {
    console.error("❌ Create SEO Page Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 UPDATE SEO PAGE
// ========================================
export const updateSeoPage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If pageType changed, regenerate schema markup
    if (updateData.pageType) {
      updateData.schemaMarkup = generateSchemaMarkup(
        updateData.pageType,
        {
          title: updateData.title,
          metaDescription: updateData.metaDescription,
          slug: updateData.slug
        }
      );
    }

    const seoPage = await SeoPage.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
updateData.lastUpdated = new Date();

    if (!seoPage) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SEO page updated successfully",
      data: seoPage
    });

  } catch (error) {
    console.error("❌ Update SEO Page Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 DELETE SEO PAGE
// ========================================
export const deleteSeoPage = async (req, res) => {
  try {
    const { id } = req.params;

    const seoPage = await SeoPage.findByIdAndDelete(id);

    if (!seoPage) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SEO page deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete SEO Page Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 GET SINGLE SEO PAGE (for editing)
// ========================================
export const getSeoPageById = async (req, res) => {
  try {
    const { id } = req.params;

    const seoPage = await SeoPage.findById(id).lean();

    if (!seoPage) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      data: seoPage
    });

  } catch (error) {
    console.error("❌ Get SEO Page Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 GET ALL SEO PAGES (Admin list view)
// ========================================
export const getAllSeoPagesAdmin = async (req, res) => {
  try {
    const { pageType, published, search, sortBy = '-createdAt' } = req.query;

    // Build filter
    const filter = {};
    if (pageType) filter.pageType = pageType;
    if (published !== undefined) filter.published = published === 'true';
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { slug: new RegExp(search, 'i') },
        { h1: new RegExp(search, 'i') }
      ];
    }

    const seoPages = await SeoPage.find(filter)
      .select('slug title pageType filters views clicks published createdAt lastUpdated')
      .sort(sortBy)
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
      message: error.message
    });
  }
};

// ========================================
// 🎯 PREVIEW SEO PAGE (without saving)
// ========================================
export const previewSeoPage = async (req, res) => {
  try {
    const { filters } = req.body;

    // Fetch notes based on filters
    const noteFilters = { published: true };

    if (filters?.semester) {
      noteFilters.semester = { $in: [filters.semester] };
    }
    if (filters?.subject) {
 noteFilters.subject = filters.subject.toLowerCase();

    }
    if (filters?.course) {
      noteFilters.course = filters.course;
    }
    if (filters?.university) {
      noteFilters.university = filters.university;
    }
    if (filters?.category) {
      noteFilters.category = filters.category;
    }

    const notes = await Note.find(noteFilters)
      .select('title subject semester category downloads views')
      .limit(20)
      .lean();

    // Calculate stats
    const totalNotes = notes.length;
    const totalDownloads = notes.reduce((sum, note) => sum + (note.downloads || 0), 0);
    const totalViews = notes.reduce((sum, note) => sum + (note.views || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalNotes,
        totalDownloads,
        totalViews,
        sampleNotes: notes.slice(0, 5)
      }
    });

  } catch (error) {
    console.error("❌ Preview Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 BULK PUBLISH/UNPUBLISH
// ========================================
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, published } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No IDs provided"
      });
    }

    await SeoPage.updateMany(
      { _id: { $in: ids } },
      { $set: { published } }
    );

    res.status(200).json({
      success: true,
      message: `${ids.length} pages ${published ? 'published' : 'unpublished'} successfully`
    });

  } catch (error) {
    console.error("❌ Bulk Update Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========================================
// 🎯 HELPER: Generate Schema Markup
// ========================================
function generateSchemaMarkup(pageType, data) {
  const baseSchema = {
    "@context": "https://schema.org"
  };

  switch (pageType) {
    case 'subject':
      return {
        ...baseSchema,
        "@type": "Course",
        "name": data.title,
        "description": data.metaDescription,
        "provider": {
          "@type": "EducationalOrganization",
          "name": "AcademicArk",
          "url": "https://academicark-mvp8.onrender.com"
        }
      };

    case 'semester':
      return {
        ...baseSchema,
        "@type": "CollectionPage",
        "name": data.title,
        "description": data.metaDescription,
        "url": `https://academicark-mvp8.onrender.com/${data.slug}`
      };

    case 'category':
      return {
        ...baseSchema,
        "@type": "CollectionPage",
        "name": data.title,
        "description": data.metaDescription
      };

    default:
      return {
        ...baseSchema,
        "@type": "WebPage",
        "name": data.title,
        "description": data.metaDescription
      };
  }
}

export default {
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
  getSeoPageById,
  getAllSeoPagesAdmin,
  previewSeoPage,
  bulkUpdateStatus
};
