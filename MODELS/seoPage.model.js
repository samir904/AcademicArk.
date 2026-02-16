import mongoose from "mongoose";
const seoPageSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  
  pageType: {
    type: String,
    required: true,
    enum: ['semester', 'subject', 'branch', 'category', 'blog', 'landing'],
    index: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 65,
    trim: true
  },
  
  h1: {
    type: String,
    required: true,
    maxlength: 80,
    trim: true
  },
  
  metaDescription: {
    type: String,
    required: true,
    maxlength: 160,
    trim: true
  },
  
  keywords: [{
    type: String,
    trim: true
  }],
  
  introContent: {
    type: String,
    required: true,
    minlength: 200,
    maxlength: 2000
  },
  
  filters: {
    semester: Number,
    branch: String,
    subject: String,
    category: String,
    university: String,
    course: String   // ADD THIS
  },
  
  faqs: [{
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true }
  }],
  
  schemaMarkup: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  relatedPages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SeoPage'
  }],
  
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  avgTimeOnPage: { type: Number, default: 0 },
  
  published: {
    type: Boolean,
    default: true,
    index: true
  },

  noIndex: {
    type: Boolean,
    default: false
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  changeFrequency: {
    type: String,
    enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
    default: 'weekly'
  },
  
  sitemapPriority: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  }

}, { timestamps: true });

// Canonical URL
seoPageSchema.virtual('canonicalUrl').get(function() {
  return `https://academicark.in/${this.slug}`;
});

// Auto-update lastUpdated
seoPageSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Indexes
seoPageSchema.index({ slug: 1, published: 1 });
seoPageSchema.index({ pageType: 1, published: 1 });
seoPageSchema.index({ "filters.semester": 1 });
seoPageSchema.index({ "filters.subject": 1 });
seoPageSchema.index({ "filters.category": 1 });

export default mongoose.model("SeoPage", seoPageSchema);