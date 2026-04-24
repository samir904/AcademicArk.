import mongoose from "mongoose";
import Note from "../MODELS/note.model.js";
import Apperror from "../UTIL/error.util.js";
import cloudinary from "cloudinary";
import fs from "fs/promises"
// import fetch from "nodea-fetch";
import redisClient from "../CONFIG/redisClient.js"
// import redisClient from "../server.sjs"
import axios from "axios";
import { logUserActivity } from "../UTIL/activityLogger.js";
import { addWatermarkToPDF } from "../UTIL/pdfWatermark.util.js";
import User from "../MODELS/user.model.js";
import { addDownloadWatermarkToPDF } from "../UTIL/downloadWatermark.util.js";
import { markStudyActivity } from "../UTIL/updateStudyActivity.js";
import { extractUnitFromTitle } from "../UTIL/unitExtractor.js";
import VideoLecture from "../MODELS/videoLecture.model.js";
import { generatePreviewFromUrl } from "../UTIL/generatePreviewFromUrl.js";
import { uploadPdfBuffer } from "../UTIL/uploadPdfBuffer.js";
import slugify from "slugify";
// import redis      from "../CONFIG/redis.js";           // your ioredis client
// import Papa from 'papaparse'; // npm install papaparse
// import path from 'path';
import Papa from 'papaparse'; // npm install papaparse
// import fs from 'fs/promises';
import path from 'path';
import { bulkJobs } from "../UTIL/job.store.js";

// ─────────────────────────────────────────────
// CACHE BUST  ← FIX 2: was using undefined `redis`, now `redisClient`
// ─────────────────────────────────────────────
export const bustNoteCache = async (noteId) => {
  await redisClient.del(NOTE_CACHE_KEY(noteId));  // ✅ redisClient not redis
};
// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const NOTE_CACHE_TTL   = 60 * 5;   // 5 min
const NOTE_CACHE_KEY   = (id) => `note:${id}`;
const ACCESS_CACHE_KEY = (id) => `user:access:${id}`;
const ACCESS_CACHE_TTL = 60 * 2;   // 2 min

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Fire-and-forget — never blocks the response
const fireAndForget = (promise) => {
  Promise.resolve(promise).catch((err) =>
    console.error("🔥 background task failed:", err.message)
  );
};

// Atomic view count — no load → check → save cycle
// const incrementViewCount = (noteId, userId) => {
//   const userObjId = new mongoose.Types.ObjectId(userId);
//   return Note.findByIdAndUpdate(
//     noteId,
//     {
//       $addToSet: { viewedBy: userObjId },  // no-op if already exists
//       $inc:      { views: 1 },
//     },
//     { new: false }  // don't need the result
//   );
// };

// ─────────────────────────────────────────────
// CACHED NOTE FETCH
// ─────────────────────────────────────────────
const getCachedNote = async (id) => {
  const cacheKey = NOTE_CACHE_KEY(id);

  const cached = await redisClient.get(cacheKey);
  if (cached) return { note: JSON.parse(cached), fromCache: true };

  const note = await Note.findById(id)
    .populate("uploadedBy", "fullName avatar.secure_url")
    .select("+isLocked +previewPages +previewFile +fileDetails")
    .lean();

  if (note) {
    const { views, viewedBy, ...cacheable } = note;
    // ✅ FIX 1 — node-redis v4: set(key, value, { EX: ttl }) not setex()
    await redisClient.set(
      cacheKey,
      JSON.stringify(cacheable),
      { EX: NOTE_CACHE_TTL }
    );
  }

  return { note, fromCache: false };
};

// ─────────────────────────────────────────────
// CACHED ACCESS CHECK
// ─────────────────────────────────────────────
const getUserAccess = async (userId) => {
  if (!userId) return null;

  const cacheKey = ACCESS_CACHE_KEY(userId);
  const cached   = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const user = await User.findById(userId)
    .select("access.expiresAt access.plan")
    .lean();

  const access = user?.access ?? null;
  if (access) {
    // ✅ FIX 1 — same fix here
    await redisClient.set(
      cacheKey,
      JSON.stringify(access),
      { EX: ACCESS_CACHE_TTL }
    );
  }

  return access;
};
// ─────────────────────────────────────────────
// PREVIEW — trigger async generation, never block
// Called after response is sent
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PREVIEW GENERATION
// ─────────────────────────────────────────────
const ensurePreviewExists = async (note) => {
  if (note.previewFile?.secure_url) return;

  try {
    const maxPages      = note.previewPages || 8;
    const previewBuf    = await generatePreviewFromUrl(
      note.fileDetails.secure_url,
      maxPages
    );
    const previewUpload = await uploadPdfBuffer(previewBuf, {
      folder:    "AcademicArk/previews",
      public_id: `preview_${note._id}`,
    });

    await Note.findByIdAndUpdate(note._id, {
      $set: {
        "previewFile.public_id":  previewUpload.public_id,
        "previewFile.secure_url": previewUpload.secure_url,
      },
    });

    // ✅ FIX 2 — was redis.del, now redisClient.del
    await redisClient.del(NOTE_CACHE_KEY(note._id.toString()));
    console.log(`✅ Preview generated for note ${note._id}`);
  } catch (err) {
    console.error(`❌ Preview generation failed for ${note._id}:`, err.message);
  }
};


// ─────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────
// export const getNote = async (req, res, next) => {
//   const { id } = req.params;
//   const userId = req.user?.id;

//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     // ✅ FIX 3 — was AppError (undefined), now matches import name
//     return next(new AppError("Invalid note Id", 400));
//   }

//   try {
//     const [{ note }, access] = await Promise.all([
//       getCachedNote(id),
//       getUserAccess(userId),
//     ]);

//     if (!note) return next(new AppError("Note not found", 404));

//     const isSupporter =
//       access?.expiresAt && new Date(access.expiresAt) > new Date();

//     let pdfUrl        = note.fileDetails.secure_url;
//     let mode          = "FULL";
//     let maxPages      = null;
//     let allowDownload = true;
//     let needsPreview  = false;

//     if (note.isLocked && !isSupporter) {
//       mode          = "PREVIEW";
//       maxPages      = note.previewPages || 8;
//       allowDownload = false;

//       if (note.previewFile?.secure_url) {
//         pdfUrl = note.previewFile.secure_url;
//       } else {
//         needsPreview = true;
//         pdfUrl       = null;
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: "Note fetched successfully",
//       data: {
//         ...note,
//         pdfAccess: {
//           pdfUrl,
//           mode,
//           maxPages,
//           allowDownload,
//           previewPending: needsPreview,
//         },
//       },
//     });

//     // ── Fire-and-forget side effects ──────────
//     if (userId) {
//       fireAndForget(incrementViewCount(id, userId));
//       fireAndForget(
//         logUserActivity(userId, "NOTE_VIEWED", {
//           resourceId:   id,
//           resourceType: "NOTE",
//           ipAddress:    req.ip,
//           userAgent:    req.get("user-agent"),
//           sessionId:    req.sessionID,
//         })
//       );
//       fireAndForget(markStudyActivity(userId));
//     }

//     if (needsPreview) {
//       fireAndForget(ensurePreviewExists(note));
//     }

//   } catch (error) {
//     console.error("❌ getNote error:", error);
//     next(new Apperror("Failed to fetch note", 500));  // ✅ FIX 3
//   }
// };

// CONTROLLERS/note.controller.js — add this function


export const bulkUploadNotes = async (req, res, next) => {
  const userId       = req.user.id;
  const uploadedFiles = req.files?.files ?? [];

  // ── 1. Parse metadata ─────────────────────────────────────────────
  let metadataList;
  try {
    metadataList = JSON.parse(req.body.metadata);
  } catch {
    return next(new Apperror("Invalid metadata JSON", 400));
  }

  if (!Array.isArray(metadataList) || metadataList.length === 0)
    return next(new Apperror("Metadata array is required", 400));

  if (uploadedFiles.length === 0)
    return next(new Apperror("At least one PDF file is required", 400));

  // ── 2. Build filename → file map ──────────────────────────────────
  const fileMap = {};
  for (const file of uploadedFiles) {
    fileMap[file.originalname] = file;
  }

  // ── 3. Match metadata rows to files ──────────────────────────────
  const matched   = [];
  const unmatched = [];

  for (const row of metadataList) {
    if (fileMap[row.filename]) {
      matched.push({ meta: row, file: fileMap[row.filename] });
    } else {
      unmatched.push(row.filename);
    }
  }

  // ── 4. Register job AFTER matched is built ✅ ─────────────────────
  const jobId = req.body.jobId ?? `bulk_${Date.now()}`;

  const results = {
    success: [],
    failed:  [],
    skipped: unmatched.map(f => ({
      filename: f,
      reason: "Not found in uploaded files",
    })),
  };

  // Now safe — matched.length is known
  bulkJobs.set(jobId, {
    total:   matched.length,
    done:    0,
    current: null,
    results,   // ← shared reference, updates live as results arrays fill up
  });

  // ── 5. Validate all rows before any upload ────────────────────────
  const validationErrors = [];
  for (const { meta } of matched) {
    const errs = [];
    if (!meta.title?.trim() || meta.title.trim().length < 3)
      errs.push("Title must be at least 3 characters");
    if (!meta.description?.trim() || meta.description.trim().length < 10)
      errs.push("Description must be at least 10 characters");
    if (!meta.subject?.trim())
      errs.push("Subject is required");
    const semArray = normalizeSemesters(meta.semester);
    if (!semArray.length)
      errs.push("At least one semester is required");
    const validCategories = ["Notes", "Important Question", "PYQ", "Handwritten Notes"];
    if (!validCategories.includes(meta.category))
      errs.push(`Invalid category: ${meta.category}`);
    if (errs.length)
      validationErrors.push({ filename: meta.filename, errors: errs });
  }

  if (validationErrors.length > 0) {
    bulkJobs.delete(jobId); // clean up — job never started
    return res.status(400).json({
      success: false,
      message: "Validation failed — fix errors and retry",
      validationErrors,
    });
  }

  // ── 6. Sequential upload loop ─────────────────────────────────────
  for (let i = 0; i < matched.length; i++) {
    const { meta, file } = matched[i];

    // Update current file BEFORE upload attempt ✅
    bulkJobs.get(jobId).current = meta.filename;

    try {
      const extractedUnit = extractUnitFromTitle(meta.title);
      const semesterArray = normalizeSemesters(meta.semester);

      // Unique slug
      const baseSlug = slugify(
        `${meta.title}-semester-${semesterArray[0]}-${meta.subject}-aktu`,
        { lower: true, strict: true }
      );
      let slug = baseSlug;
      let counter = 1;
      while (await Note.findOne({ slug })) {
        slug = `${baseSlug}-${counter++}`;
      }

      // SEO fields
      const seoTitle = `${meta.title} | AKTU ${meta.subject} Semester ${semesterArray[0]} Notes`;
      const seoDescription = `Download ${meta.title} for AKTU ${meta.subject} semester ${semesterArray[0]}. Updated syllabus notes, important questions and PYQ available on AcademicArk.`;

      // Create note doc
      const note = await Note.create({
        title:       meta.title.trim(),
        description: meta.description.trim(),
        subject:     meta.subject.toLowerCase().trim(),
        course:      'BTECH',
        semester:    semesterArray,
        university:  'AKTU',
        category:    meta.category.trim(),
        unit:        extractedUnit,
        uploadedBy:  userId,
        slug,
        seoTitle,
        seoDescription,
        fileDetails: { public_id: meta.title, secure_url: 'pending' },
      });

      // Watermark + Cloudinary
      // In your bulk upload loop — replace this section:
if (file.mimetype === 'application/pdf') {
  try {
    await addWatermarkToPDF(file.path, 'AcademicArk');
  } catch (wmErr) {
    // Watermark failed — log it but don't abort the upload
    console.warn(`⚠️ Watermark skipped for ${meta.filename}: ${wmErr.message}`);
    // Continue to upload the original un-watermarked file
  }
}



      const result = await cloudinary.v2.uploader.upload(file.path, {
        folder:          "AcademicArk",
        resource_type:   'auto',
        access_mode:     'public',
        type:            'upload',
        use_filename:    true,
        unique_filename: true,
      });

      note.fileDetails.public_id  = result.public_id;
      note.fileDetails.secure_url = result.secure_url;
      await note.save();

      await fs.rm(file.path);

      results.success.push({
        filename: meta.filename,
        title:    note.title,
        id:       note._id,
        slug:     note.slug,
      });

    } catch (err) {
      console.error(`[BulkUpload] Failed: ${meta.filename}`, err.message);
      try { await fs.rm(file.path); } catch {}

      results.failed.push({
        filename: meta.filename,
        title:    meta.title,
        reason:   err.message,
      });
    }

    // ✅ Increment done OUTSIDE try/catch — always runs after success OR failure
    bulkJobs.get(jobId).done = i + 1;
  }

  // ── 7. Bust cache ─────────────────────────────────────────────────
  await redisClient.del(`notes:${JSON.stringify({})}`);

  // ── 8. Return summary with jobId ✅ ──────────────────────────────
  res.status(200).json({
    success: true,
    message: `Bulk upload complete: ${results.success.length} uploaded, ${results.failed.length} failed, ${results.skipped.length} skipped`,
    jobId,   // ← frontend needs this to poll SSE
    summary: {
      total:    matched.length,
      uploaded: results.success.length,
      failed:   results.failed.length,
      skipped:  results.skipped.length,
    },
    results,
  });
};

// ── Helper ────────────────────────────────────────────────────────
function normalizeSemesters(semester) {
  if (!semester) return [];
  if (Array.isArray(semester))
    return semester.map(Number).filter(n => n >= 1 && n <= 8);
  return String(semester)
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => n >= 1 && n <= 8);
}

// ── Helper: normalize semester field from CSV string or array ──────
// function normalizeSemesters(semester) {
//   if (!semester) return [];
//   // CSV might send "5" or "5,6" or [5,6]
//   if (Array.isArray(semester)) return semester.map(Number).filter(n => n >= 1 && n <= 8);
//   return String(semester).split(',').map(s => parseInt(s.trim())).filter(n => n >= 1 && n <= 8);
// }
// // CONTROLLERS/note.controller.js — add this function

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/notes/subjects/suggestions?q=oper&semester=5
// Returns distinct subjects matching the query, optionally filtered by semester
// ─────────────────────────────────────────────────────────────────────────────
export const getSubjectSuggestions = async (req, res, next) => {
  try {
    const { q = '', semester } = req.query;

    if (!q.trim()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    const matchFilter = {
      subject: { $regex: escapeRegex(q.trim()), $options: 'i' },
    };

    // Semester filter — supports single or comma-separated "5" or "5,6"
    if (semester) {
      const semNums = String(semester)
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => n >= 1 && n <= 8);

      if (semNums.length) {
        matchFilter.semester = { $in: semNums };
      }
    }

    const suggestions = await Note.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $toLower: '$subject' },          // normalize case
          displaySubject: { $first: '$subject' }, // original casing for display
          count: { $sum: 1 },                     // note count per subject
        },
      },
      { $sort: { count: -1 } },                  // most-noted subjects first
      { $limit: 8 },                             // cap suggestions
      {
        $project: {
          _id: 0,
          subject: '$displaySubject',
          count: 1,
        },
      },
    ]);

    return res.status(200).json({ success: true, data: suggestions });
  } catch (err) {
    console.error('getSubjectSuggestions error:', err);
    return next(new AppError('Failed to fetch subject suggestions', 500));
  }
};
export const registerNote = async (req, res, next) => {
    const { title, description, subject, course, semester, university, category } = req.body;
    const userId = req.user.id;
    if (!userId) {
        return next(new Apperror("Something went wrong please login again"))
    }
    if (!title || !description || !subject || !course || !university || !category) {
        return next(new Apperror("All fields are required "))
    }
    if (!semester || (Array.isArray(semester) && semester.length === 0)) {
        return next(new Apperror("At least one semester is required"));
    }
    if (!req.file) {
        return next(new Apperror("File is required", 400));
    }
    // ✅ AUTO-EXTRACT UNIT FROM TITLE
    const extractedUnit = extractUnitFromTitle(title);
    const semesterArray = Array.isArray(semester)
        ? semester.map(s => parseInt(s))
        : [parseInt(semester)];

        // ============================================
    // 🔥 GENERATE UNIQUE SLUG
    // ============================================

    const baseSlug = slugify(
        `${title}-semester-${semesterArray[0]}-${subject}-aktu`,
        { lower: true, strict: true }
    );

    let slug = baseSlug;
    let counter = 1;

    while (await Note.findOne({ slug })) {
        slug = `${baseSlug}-${counter++}`;
    }

    // ============================================
    // 🔥 AUTO SEO FIELDS
    // ============================================

    const seoTitle = `${title} | AKTU ${subject} Semester ${semesterArray[0]} Notes`;
    const seoDescription = `Download ${title} for AKTU ${subject} semester ${semesterArray[0]}. Updated syllabus notes, important questions and PYQ available on AcademicArk.`;

    // ============================================
    // 📝 CREATE NOTE
    // ============================================

    const note = await Note.create({
        title: title.trim(),
        description: description.trim(),
        subject: subject.toLowerCase().trim(), // Normalize to lowercase
        course: course.toUpperCase().trim(),   // Normalize to uppercase
        semester: semesterArray,          // Ensure Array
        university: university.toUpperCase().trim(),
        category: category.trim(),
        unit: extractedUnit,  // ✅ AUTO-FILLED
        uploadedBy: userId,
        slug,
        seoTitle,
        seoDescription,
        fileDetails: {
            public_id: title,
            secure_url: 'dummy'
        }
    });

    if (!note) {
        return next(new Apperror("Note not uploaded please try again"))
    }

    if (req.file) {
        try {
            // ✨ ADD WATERMARK BEFORE UPLOADING TO CLOUDINARY
            if (req.file.mimetype === 'application/pdf') {
                await addWatermarkToPDF(req.file.path, 'AcademicArk');
                console.log('✅ Watermark added to PDF');
            }
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "AcademicArk",
                resource_type: 'auto', // auto-detect file type
                access_mode: 'public', // Make sure it's public
                type: 'upload', // Standard upload type
                use_filename: true,
                unique_filename: true,
            });
            if (result) {
                note.fileDetails.public_id = result.public_id;
                note.fileDetails.secure_url = result.secure_url;
                await fs.rm(`uploads/${req.file.filename}`)
            }
        } catch (error) {
    console.error("❌ Cloudinary upload error:", error);

    return next(
        new Apperror(error.message || "Failed to upload note please try again!", 500)
    );
}
    }
    await note.save();
    await redisClient.del(`notes:${JSON.stringify({})}`)//clear top level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`)//clear specific filter
    res.status(201).json({
        success: true,
        message: "Note uploaded successfully",
        data: note
    })
}
export const getNotesController = async (req, res, next) => {
    if (req._notesMode === "SEMESTER_PREVIEW") {
        return getSemesterPreviewNotes(req, res, next);
    }

    return getAllNotes(req, res, next);
};
export const getAllNotes = async (req, res) => {
    try {
        if (!req.query.semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const limit = 21;
        const cursor = req.query.cursor
            ? JSON.parse(decodeURIComponent(req.query.cursor))
            : null;

        const isFirstPage = !cursor;

        const escapeRegex = (text = "") =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const semesterNumber = Number(req.query.semester);

        const filters = {
            semester: { $in: [semesterNumber] } // ✅ WORKS FOR [5] & [5,6]
        };

        if (req.query.subject)
            filters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (req.query.unit)
            filters.unit = Number(req.query.unit);

        if (req.query.university)
            filters.university = new RegExp(escapeRegex(req.query.university), "i");

        if (req.query.course)
            filters.course = new RegExp(escapeRegex(req.query.course), "i");

        if (req.query.category)
            filters.category = new RegExp(escapeRegex(req.query.category), "i");

        // if (cursor) {
        //     filters.createdAt = { $lt: new Date(cursor) };
        // }

        const pipeline = [
            { $match: filters },

            ...(isFirstPage
                ? [
                    {
                        $facet: {
                            recommended: [
                                { $match: { recommended: true } },
                                {
                                    $addFields: {
                                        subjectValue: { $toLower: "$subject" },
                                        categoryValue: {
                                            $switch: {
                                                branches: [
                                                    { case: { $eq: ["$category", "Notes"] }, then: 0 },
                                                    { case: { $eq: ["$category", "Handwritten Notes"] }, then: 1 },
                                                    { case: { $eq: ["$category", "Important Question"] }, then: 2 },
                                                    { case: { $eq: ["$category", "PYQ"] }, then: 3 }
                                                ],
                                                default: 99
                                            }
                                        }
                                    }
                                },
                                {
                                    $sort: {
                                        subjectValue: 1,
                                        categoryValue: 1,
                                        unit: 1,
                                        recommendedRank: 1,
                                        downloads: -1,
                                        views: -1,
                                        createdAt: -1
                                    }
                                }
                            ],
                            normal: [
                                { $match: { recommended: { $ne: true } } },
                                {
                                    $sort: {
                                        downloads: -1,
                                        views: -1,
                                        createdAt: -1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $project: {
                            notes: { $concatArrays: ["$recommended", "$normal"] }
                        }
                    },
                    { $unwind: "$notes" },
                    { $replaceRoot: { newRoot: "$notes" } }
                ]
                : [
                    { $match: { recommended: { $ne: true } } },
                    {
                        $match: {
                            $or: [
                                { createdAt: { $lt: new Date(cursor.createdAt) } },
                                {
                                    createdAt: new Date(cursor.createdAt),
                                    _id: { $lt: new mongoose.Types.ObjectId(cursor._id) }
                                }
                            ]
                        }
                    },
                    { $sort: { createdAt: -1, _id: -1 } }
                ]),

            { $limit: limit + 1 },

            {
                $lookup: {
                    from: "users",
                    localField: "uploadedBy",
                    foreignField: "_id",
                    as: "uploadedBy"
                }
            },
            { $unwind: "$uploadedBy" },
            // ── STRIP SENSITIVE FIELDS ──────────────────────────────────────
            // fileDetails.secure_url  → full PDF download URL (paywall bypass)
            // fileDetails.public_id   → Cloudinary ID (security exposure)
            // previewFile.public_id   → Cloudinary ID (security exposure)
            // viewedBy                → privacy leak (array of user IDs)
            // bookmarkedBy            → privacy leak (array of user IDs)
            // uploadedBy.password     → should never leave server
            // uploadedBy.email        → privacy (not needed on cards)
            {
                $project: {
                    // ── NOTE FIELDS: include only what the card UI needs ──
                    title:           1,
                    slug:            1,
                    description:     1,
                    subject:         1,
                    unit:            1,
                    course:          1,
                    semester:        1,
                    university:      1,
                    category:        1,
                    downloads:       1,
                    views:           1,
                    rating:          1,
                    isLocked:        1,
                    previewPages:    1,
                    recommended:     1,
                    recommendedRank: 1,
                    createdAt:       1,
                    updatedAt:       1,
                    seoTitle:        1,
                    seoDescription:  1,

                    // ── PREVIEW URL only (watermarked/limited — safe to expose) ──
                    "previewFile.secure_url": 1,
                    //   previewFile.public_id  → NOT included ✅

                    // ── fileDetails: public_id and secure_url BOTH removed ──
                    //   DO NOT add fileDetails here at all ✅

                    // ── Uploader: only safe public fields ──
                    "uploadedBy._id":             1,
                    "uploadedBy.fullName":         1,
                    "uploadedBy.avatar.secure_url": 1,
                    //   uploadedBy.email    → NOT included ✅
                    //   uploadedBy.password → NOT included ✅
                    //   uploadedBy.role     → NOT included ✅
                }
            }
        ];

        const result = await Note.aggregate(pipeline);

        const hasMore = result.length > limit;
        const notes = hasMore ? result.slice(0, limit) : result;
        // 🔐 Cursor must always come from NORMAL stream ordering
        const normalNotesInPage = notes.filter(n => !n.recommended);

        const last = normalNotesInPage[normalNotesInPage.length - 1];


        const nextCursor = last
            ? encodeURIComponent(JSON.stringify({
                createdAt: last.createdAt,
                _id: last._id
            }))
            : null;

        // console.log({
        //     semester: semesterNumber,
        //     matchedCount: await Note.countDocuments(filters),
        //     cursor
        // });
        res.setHeader("Cache-Control", "no-store");

        res.status(200).json({
            success: true,
            data: { notes, nextCursor, hasMore }
        });
    } catch (err) {
        console.error("❌ getAllNotes error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notes"
        });
    }
};

export const getSemesterPreviewNotes = async (req, res) => {
    try {
        const semester = Number(req.query.semester);
        if (!semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const limit = 30;
        const cursor = req.query.cursor
            ? JSON.parse(decodeURIComponent(req.query.cursor))
            : null;

        const filters = {
            semester: { $in: [semester] }
        };

        if (cursor) {
            filters.$or = [
                { createdAt: { $lt: new Date(cursor.createdAt) } },
                {
                    createdAt: new Date(cursor.createdAt),
                    _id: { $lt: new mongoose.Types.ObjectId(cursor._id) }
                }
            ];
        }

        const notes = await Note.find(filters)
            // ── EXCLUSION-ONLY select ─────────────────────────────────────
            // Mongoose rule: NEVER mix inclusions + exclusions in .select()
            // Mixing causes exclusions to be silently ignored → full doc returned
            // Solution: exclude only the fields we want gone, keep everything else
            .select(`
                -fileDetails
                -viewedBy
                -bookmarkedBy
                -previewFile.public_id
            `)
            .sort({
                recommended:     -1,
                recommendedRank:  1,
                downloads:       -1,
                views:           -1,
                createdAt:       -1,
                _id:             -1
            })
            .limit(limit + 1)
            // ── populate: exclude sensitive user fields ────────────────────
            .populate("uploadedBy", "-password -email -role -__v");

        const hasMore = notes.length > limit;
        const sliced  = hasMore ? notes.slice(0, limit) : notes;
        const last    = sliced[sliced.length - 1];

        const nextCursor = last
            ? encodeURIComponent(JSON.stringify({
                createdAt: last.createdAt,
                _id:       last._id
            }))
            : null;

        res.setHeader("Cache-Control", "no-store");

        res.status(200).json({
            success: true,
            mode: "SEMESTER_PREVIEW",
            data: { notes: sliced, nextCursor, hasMore }
        });

    } catch (error) {
        console.error("❌ getSemesterPreviewNotes error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch semester preview"
        });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET RELATED NOTES
// GET /api/v1/notes/:id/related
// Auth: optional — public endpoint, no fileDetails returned
// ─────────────────────────────────────────────────────────────────────────────
export const getRelatedNotes = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new Apperror("Invalid note ID", 400));
  }

  // ── Fetch current note metadata only ────────────────────────────────
  const currentNote = await Note.findById(id)
    .select("subject unit semester category")
    .lean();

  if (!currentNote) return next(new Apperror("Note not found", 404));

  const { subject, unit, semester, category } = currentNote;
  const semArray = Array.isArray(semester) ? semester : [semester];

  // ── Shared exclusion selects (no fileDetails, no PII) ───────────────
 const SAFE_SELECT = "_id title category unit downloads views isLocked previewPages recommended recommendedRank";
 const SAFE_POPULATE = "fullName avatar.secure_url";
  // ── Base filter — same subject + semester, exclude current note ──────
  // subject stored lowercase → case-insensitive regex match still correct
  const baseFilter = {
    subject:  new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    semester: { $in: semArray },
    _id:      { $ne: new mongoose.Types.ObjectId(id) },
  };

  const isStudyContent = ["Notes", "Handwritten Notes"].includes(category);

  let related = {};
  let strategy;
if (isStudyContent) {
  strategy = "STUDY_CONTENT";

  const unitFilter     = unit ? { unit }           : {};
  const nextUnitFilter = unit ? { unit: unit + 1 } : null;

  // ── Run all four queries in parallel ─────────────────────────────────
  const [
    allSameUnit,          // ← fetch all, filter after
    importantQuestions,
    pyqs,
    nextUnitNotes,
  ] = await Promise.all([

    // ── Same-unit: Notes + Handwritten Notes ─────────────────────────
    // Fetch up to 6 sorted recommended-first.
    // After fetch: if any recommended exist → keep only those (curated).
    // Otherwise  → keep all (fallback).
    Note.find({
      ...baseFilter,
      ...unitFilter,
      category: { $in: ["Notes", "Handwritten Notes"] },
    })
      .select(SAFE_SELECT)
      .populate("uploadedBy", SAFE_POPULATE)
      .sort({ recommended: -1, recommendedRank: 1, downloads: -1 })
      .limit(6)
      .lean(),

    // ── Important Questions ───────────────────────────────────────────
    Note.find({ ...baseFilter, category: "Important Question" })
      .select(SAFE_SELECT)
      .populate("uploadedBy", SAFE_POPULATE)
      .sort({ recommended: -1, downloads: -1, views: -1 })
      .limit(6)
      .lean(),

    // ── PYQs ─────────────────────────────────────────────────────────
    Note.find({ ...baseFilter, category: "PYQ" })
      .select(SAFE_SELECT)
      .populate("uploadedBy", SAFE_POPULATE)
      .sort({ recommended: -1,title: -1, downloads: -1, views: -1 })
      .limit(6)
      .lean(),

    // ── Next unit notes ───────────────────────────────────────────────
    nextUnitFilter
      ? Note.find({
          ...baseFilter,
          ...nextUnitFilter,
          category: { $in: ["Notes", "Handwritten Notes"] },
        })
          .select(SAFE_SELECT)
          .populate("uploadedBy", SAFE_POPULATE)
          .sort({ recommended: -1, recommendedRank: 1, downloads: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([]),
  ]);

  // ── Recommended-first logic for sameUnitNotes ─────────────────────
  // If the DB has any curated (recommended) notes for this unit → show only those.
  // Keeps the sidebar tight and high-signal.
  // If nothing is curated → fallback to all same-unit notes so section never disappears.
  const hasRecommended = allSameUnit.some((n) => n.recommended === true);
  const sameUnitNotes  = hasRecommended
    ? allSameUnit.filter((n) => n.recommended === true)
    : allSameUnit;

  related = {
    sameUnitNotes,
    importantQuestions,
    pyqs,
    nextUnitNotes,
  };
  } else {
    // ────────────────────────────────────────────────────────────────────
    // Strategy B: User is reading PYQ or Important Question
    // Show:  more of same type | recommended notes | handwritten notes
    // ────────────────────────────────────────────────────────────────────
    strategy = "ASSESSMENT_CONTENT";
// ── Cross-category: PYQ viewer gets ImpQ, ImpQ viewer gets PYQ ──────
  const crossCategory = category === "PYQ" ? "Important Question" : "PYQ";
  const crossLabel    = category === "PYQ" ? "importantQuestions" : "pyqs";

    const [
      moreLikeThis,
      crossCategoryNotes,    // ← NEW
      recommendedNotes,
      handwrittenNotes,
    ] = await Promise.all([

      // ── More of same category (PYQ or ImpQ) — same subject ──
      Note.find({ ...baseFilter, category })
        .select(SAFE_SELECT)
        .populate("uploadedBy", SAFE_POPULATE)
        .sort({ recommended: -1,title: -1, downloads: -1, views: -1 })
        .limit(8),
 // ── Cross-category: PYQ ↔ Important Question ─────────────────────
    // User in "practice mode" — show the complementary exam-prep content
    // PYQ viewer   → sees Important Questions (what to expect)
    // ImpQ viewer  → sees PYQs (actual past papers to practice)
    Note.find({ ...baseFilter, category: crossCategory })
      .select(SAFE_SELECT)
      .populate("uploadedBy", SAFE_POPULATE)
      .sort({ recommended: -1, downloads: -1, views: -1 })
      .limit(6),

      // ── Admin recommended Notes — same subject (2-3 max) ──
      Note.find({ ...baseFilter, category: "Notes", recommended: true })
        .select(SAFE_SELECT)
        .populate("uploadedBy", SAFE_POPULATE)
        .sort({ recommendedRank: 1, downloads: -1 })
        .limit(3),

      // ── Handwritten Notes — same subject (2-3 max) ──
      Note.find({ ...baseFilter, category: "Handwritten Notes" })
        .select(SAFE_SELECT)
        .populate("uploadedBy", SAFE_POPULATE)
        .sort({ recommended: -1, downloads: -1 })
        .limit(3),
    ]);

    related = {
      moreLikeThis,
      [crossLabel]: crossCategoryNotes,   // ← dynamic key ✅
      recommendedNotes,
      handwrittenNotes,
    };
  }

  // ── Strip empty sections before sending ─────────────────────────────
  // Don't send empty arrays — frontend can check section existence
  Object.keys(related).forEach((k) => {
    if (!related[k]?.length) delete related[k];
  });

  res.setHeader("Cache-Control", "public, max-age=300"); // 5 min — safe, no auth data

  return res.status(200).json({
    success: true,
    data: {
      strategy,                                  // frontend uses this to decide layout
      context: { subject, unit, semester, category }, // what the user is currently viewing
      related,
    },
  });
};


export const getAllNoteStats = async (req, res) => {
    try {
        if (!req.query.semester) {
            return res.status(400).json({
                success: false,
                message: "Semester is required"
            });
        }

        const escapeRegex = (text = "") =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        /** --------------------
         * NOTES FILTERS
         * -------------------- */
        const noteFilters = {
            semester: Number(req.query.semester)
        };

        if (req.query.subject)
            noteFilters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (req.query.unit)
            noteFilters.unit = Number(req.query.unit);

        if (req.query.university)
            noteFilters.university = new RegExp(escapeRegex(req.query.university), "i");

        if (req.query.course)
            noteFilters.course = new RegExp(escapeRegex(req.query.course), "i");

        if (req.query.category)
            noteFilters.category = new RegExp(escapeRegex(req.query.category), "i");

        if (
            req.query.uploadedBy &&
            mongoose.Types.ObjectId.isValid(req.query.uploadedBy)
        ) {
            noteFilters.uploadedBy = new mongoose.Types.ObjectId(req.query.uploadedBy);
        }

        /** --------------------
         * NOTES AGGREGATION
         * -------------------- */
        const noteStats = await Note.aggregate([
            { $match: noteFilters },
            {
                $facet: {
                    total: [{ $count: "count" }],
                    categoryStats: [
                        {
                            $group: {
                                _id: "$category",
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        const totalNotes = noteStats[0]?.total[0]?.count || 0;

        const categoryStats = {};
        noteStats[0]?.categoryStats.forEach(item => {
            categoryStats[item._id] = item.count;
        });

        /** --------------------
         * VIDEO STATS
         * -------------------- */
        const videoFilters = {
            semester: Number(req.query.semester)
        };

        if (req.query.subject)
            videoFilters.subject = new RegExp(escapeRegex(req.query.subject), "i");

        if (
            req.query.uploadedBy &&
            mongoose.Types.ObjectId.isValid(req.query.uploadedBy)
        ) {
            videoFilters.uploadedBy = new mongoose.Types.ObjectId(req.query.uploadedBy);
        }

        const totalVideos = await VideoLecture.countDocuments(videoFilters);

        /** --------------------
         * MERGE RESULT
         * -------------------- */
        if (totalVideos > 0) {
            categoryStats["Video"] = totalVideos;
        }

        res.status(200).json({
            success: true,
            data: {
                total: totalNotes + totalVideos,
                categories: categoryStats
            }
        });

    } catch (error) {
        console.error("❌ getAllNoteStats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch stats"
        });
    }
};
export const getNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400));
    }

    try {
        const note = await Note.findById(id)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .populate({
                path: "rating",
                populate: {
                    path: "user",
                    select: "fullName avatar"
                }
            })
            .select(
                "+views +downloads +viewedBy +isLocked +previewPages +previewFile"
            );

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        /* ---------------------------
           🔍 VIEW COUNT (UNCHANGED)
        ---------------------------- */
        if (userId) {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const alreadyViewed = note.viewedBy.some(v => v.equals(userObjectId));

            if (!alreadyViewed) {
                note.views += 1;
                note.viewedBy.push(userObjectId);
                await note.save();
            }
        }

        /* ---------------------------
           🔒 ACCESS DECISION
        ---------------------------- */
        /* ---------------------------
    🔒 ACCESS DECISION (FIXED)
 ---------------------------- */
        let dbUser = null;

        if (userId) {
            dbUser = await User.findById(userId).select("access");
        }

        const isSupporter =
            dbUser?.access?.expiresAt &&
            new Date(dbUser.access.expiresAt) > new Date();

        let pdfUrl = note.fileDetails.secure_url;
        let mode = "FULL";
        let maxPages = null;
        let allowDownload = true;

        // 🔒 LOCKED + FREE USER
        if (note.isLocked && !isSupporter) {
            mode = "PREVIEW";
            maxPages = note.previewPages || 8;
            allowDownload = false;

            // 🔥 LAZY PREVIEW GENERATION
            if (!note.previewFile?.secure_url) {
                try {
                    const previewBuffer = await generatePreviewFromUrl(
                        note.fileDetails.secure_url,
                        maxPages
                    );

                    const previewUpload = await uploadPdfBuffer(previewBuffer, {
                        folder: "AcademicArk/previews",
                        public_id: `preview_${note._id}`,
                    });

                    note.previewFile = {
                        public_id: previewUpload.public_id,
                        secure_url: previewUpload.secure_url
                    };

                    await note.save();
                } catch (err) {
                    console.error("❌ Preview generation failed:", err);
                    return next(
                        new Apperror("Preview not available at the moment", 500)
                    );
                }
            }

            // 🔐 SERVE PREVIEW PDF
            pdfUrl = note.previewFile.secure_url;
        }

        /* ---------------------------
           📊 ACTIVITY LOGGING
        ---------------------------- */
        if (userId) {
            await logUserActivity(userId, "NOTE_VIEWED", {
                resourceId: id,
                resourceType: "NOTE",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
                sessionId: req.sessionID
            });
        }

        await markStudyActivity(userId);

        /* ---------------------------
           📤 FINAL RESPONSE
        ---------------------------- */
        res.status(200).json({
            success: true,
            message: "Note fetched successfully",
            data: {
                ...note.toObject(),
                pdfAccess: {
                    pdfUrl,
                    mode,        // PREVIEW | FULL
                    maxPages,    // number | null
                    allowDownload
                }
            }
        });

    } catch (error) {
        console.error("❌ getNote error:", error);
        next(new Apperror("Failed to fetch note", 500));
    }
};


// 🔒 Toggle note lock (Admin only)
export const toggleLockNote = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isLocked, previewPages } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new Apperror("Invalid note ID", 400));
        }

        // Validation
        if (typeof isLocked !== "boolean") {
            return next(new Apperror("isLocked must be boolean", 400));
        }

        if (isLocked && previewPages !== undefined) {
            if (typeof previewPages !== "number" || previewPages < 1 || previewPages > 30) {
                return next(
                    new Apperror("previewPages must be a number between 1 and 30", 400)
                );
            }
        }

        const updates = {
            isLocked,
            ...(isLocked && previewPages ? { previewPages } : {})
        };

        // If unlocking → reset previewPages to default (optional but clean)
        if (!isLocked) {
            updates.previewPages = 8;
        }

        const note = await Note.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate("uploadedBy", "fullName avatar.secure_url");

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // 🧹 Clear cache
        await redisClient.del(`notes:${JSON.stringify({})}`);

        res.status(200).json({
            success: true,
            message: isLocked
                ? "Note locked successfully"
                : "Note unlocked successfully",
            data: {
                id: note._id,
                title: note.title,
                isLocked: note.isLocked,
                previewPages: note.previewPages
            }
        });

    } catch (error) {
        console.error("❌ toggleLockNote error:", error);
        return next(
            new Apperror(error.message || "Failed to toggle note lock", 500)
        );
    }
};


// ✅ OPTIMIZED: Get all notes without viewer data


// export const getAllNotes = async (req, res, next) => {
//     try {
//         console.log('Query params:', req.query);

//         const filters = {};

//         // Handle each filter with case-insensitive matching where needed
//         if (req.query.subject) {
//             filters.subject = { $regex: req.query.subject, $options: 'i' };
//         }
//         if (req.query.semester) {
//             filters.semester = parseInt(req.query.semester);
//         }
//         if (req.query.university) {
//             filters.university = { $regex: req.query.university, $options: 'i' };
//         }
//         if (req.query.course) {
//             filters.course = { $regex: req.query.course, $options: 'i' };
//         }
//         if (req.query.category) {
//             filters.category = { $regex: req.query.category, $options: 'i' };
//         }

//         console.log('MongoDB filters:', filters);

//         // ✅ REMOVED: .populate("viewedBy", ...) - Don't fetch viewer data here
//         const notes = await Note.find(filters)
//             .populate("uploadedBy", "fullName avatar.secure_url")
//             .sort({ createdAt: -1 })
//             .select('+views +downloads +viewedBy'); // Include viewedBy count but don't populate

//         console.log('Found notes:', notes.length);

//         // ✅ Map to return only viewer count, not full data
//         const notesWithViewerCount = notes.map(note => ({
//             ...note.toObject(),
//             viewerCount: note.viewedBy?.length || 0,
//             viewedBy: undefined // Remove the full viewedBy array
//         }));

//         res.status(200).json({
//             success: true,
//             count: notes.length,
//             data: notesWithViewerCount
//         });

//     } catch (error) {
//         console.error('Error fetching notes:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch notes',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };

// ✅ OPTIMIZED: Get single note (for detail page)
// export const getNote = async (req, res, next) => {
//     try {
//         const { id } = req.params;

//         if (!id || !mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid note ID'
//             });
//         }

//         const note = await Note.findById(id)
//             .populate("uploadedBy", "fullName avatar.secure_url email")
//             .select('+views +downloads +viewedBy +ratings');

//         if (!note) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Note not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: {
//                 ...note.toObject(),
//                 viewerCount: note.viewedBy?.length || 0,
//                 viewedBy: undefined // Remove full viewer list from here
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching note:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch note',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// };


export const updateNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400))
    }
    const note = await Note.findById(id);
    if (!note) {
        return next(new Apperror("Note not found", 404))
    }
    if (note.uploadedBy.toString() !== userId.toString() && req.user.role !== "ADMIN") {
        return next(new Apperror("Note authorized to update this", 403))
    }
    const updates = {
        ...req.body
    }
    if (req.file) {
        await cloudinary.v2.uploader.destroy(note.fileDetails.public_id);
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "AcademicArk",
                resource_type: 'auto', // auto-detect file type
                access_mode: 'public', // Make sure it's public
                type: 'upload', // Standard upload type
                use_filename: true,
                unique_filename: true,
            });
            if (result) {
                note.fileDetails.public_id = result.public_id;
                note.fileDetails.secure_url = result.secure_url;
                await fs.rm(`uploads/${req.file.filename}`)
            }
        } catch (error) {
            return next(new Apperror(error.mesage || "Note not updated successfully"));
        }
    }
    const newnote = await Note.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true
    });
    // After note.save() in registerNote, updateNote, deleteNote:
    await redisClient.del(`notes:${JSON.stringify({})}`);        // clear top-level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`); // clear specific filter
 await bustNoteCache(req.params.id);

    res.status(200).json({
        success: true,
        mesage: 'Note updated successfully',
        data: newnote
    })
}

export const deleteNote = async (req, res, next) => {
    const { id } = req.params;
    const userId=req.user?.id
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400))
    }
    const note = await Note.findById(id);
    if (!note) {
        return next(new Apperror("Note not found please try again!", 404))
    }
    if (note.uploadedBy.toString() !== req.user.id.toString() && req.user.role !== "ADMIN") {
        return next(new Apperror("Not authorized to delete this note", 403))
    }

    await cloudinary.v2.uploader.destroy(note.fileDetails.public_id);

    await Note.findByIdAndDelete(id);
    // After note.save() in registerNote, updateNote, deleteNote:
    await redisClient.del(`notes:${JSON.stringify({})}`);        // clear top-level cache
    await redisClient.del(`notes:${JSON.stringify(req.query)}`); // clear specific filter
    await bustNoteCache(req.params.id);
    // ✅ LOG DOWNLOAD ACTIVITY (only if user is logged in)
    if (userId) {
        await logUserActivity(userId, "NOTE_DOWNLOADED", {
            resourceId: id,
            resourceType: "NOTE",
            downloadSize: fileResponse.data.length,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });
    }
    res.status(200).json({
        success: true,
        mesage: 'Note deleted'
    })
    // Note: res.json has been overridden by cacheNotes middleware,
    // so this response is ALSO stored into Redis automatically.
}

// Fix your backend addRating controller
export const addRating = async (req, res, next) => {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
        return next(new Apperror("Rating must be between 1 and 5", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Check if user already rated
        const existingRatingIndex = note.rating.findIndex(r => r.user.toString() === userId);

        const newRating = {
            user: userId,
            rating: Number(rating),
            review: review || "", // Review is optional
            createdAt: new Date()
        };

        if (existingRatingIndex !== -1) {
            // Update existing rating
            note.rating[existingRatingIndex] = newRating;
        } else {
            // Add new rating
            note.rating.push(newRating);
        }

        await note.save();
        // ✅ LOG RATING ACTIVITY
        await logUserActivity(userId, "NOTE_RATED", {
            resourceId: id,
            resourceType: "NOTE",
            ratingValue: rating,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });

        // Populate the updated note
        const updatedNote = await Note.findById(id)
            .populate('uploadedBy', 'fullName avatar')
            .populate('rating.user', 'fullName');
        await markStudyActivity(userId);
        res.status(200).json({
            success: true,
            message: existingRatingIndex !== -1 ? "Rating updated successfully" : "Rating added successfully",
            data: updatedNote
        });
    } catch (error) {
        console.error('Rating error:', error);
        return next(new Apperror("Failed to add rating", 500));
    }
};


// Make sure your backend toggleBookmark returns proper structure
export const bookmarkNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    const note = await Note.findById(id).populate('uploadedBy', 'fullName avatar');

    if (!note) {
        return next(new Apperror("Note not found", 404));
    }

    const isBookmarked = note.bookmarkedBy.includes(userId);

    if (isBookmarked) {
        note.bookmarkedBy.pull(userId);
    } else {
        note.bookmarkedBy.push(userId);
    }

    await note.save();
    // ✅ LOG BOOKMARK ACTIVITY (only if newly bookmarked)
    if (!isBookmarked) {
        await logUserActivity(userId, "NOTE_BOOKMARKED", {
            resourceId: id,
            resourceType: "NOTE",
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            sessionId: req.sessionID
        });
    }

    const updatedNote = await Note.findById(id).populate('uploadedBy', 'fullName avatar');
    await markStudyActivity(userId);
    res.status(200).json({
        success: true,
        message: isBookmarked ? 'Note removed from bookmarks' : 'Note bookmarked successfully',
        data: updatedNote // Make sure this structure matches your frontend expectations
    });
};


// Fix your backend downloadNote controller
// Fix your backend downloadNote controller
// Backend - Get download URL instead of redirecting
// export const downloadNote = async (req, res, next) => {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//         return next(new Apperror("Invalid note id", 400));
//     }

//     try {
//         const note = await Note.findById(id);
//         if (!note) {
//             return next(new Apperror("Note not found", 404));
//         }

//         // Increment download count
//         note.downloads += 1;
//         await note.save();

//         // Return the URL instead of redirecting
//         res.status(200).json({
//             success: true,
//             message: "Download URL retrieved",
//             data: {
//                 downloadUrl: note.fileDetails.secure_url,
//                 filename: `${note.title}.pdf`,
//                 downloads: note.downloads
//             }
//         });

//     } catch (error) {
//         console.error('Download error:', error);
//         return next(new Apperror("Failed to get download URL", 500));
//     }
// };



export const downloadNote = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id; // Optional - user may not be logged in

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Log URL for manual testing
        // console.log('Fetching PDF from:', note.fileDetails.secure_url);

        // Increment download count
        note.downloads += 1;
        await note.save();

        // Fetch the file
        const fileResponse = await axios.get(note.fileDetails.secure_url, {
            responseType: 'arraybuffer' // Binary data
        });

        // ✅ STEP 4: Convert to buffer
        let pdfBuffer = Buffer.from(fileResponse.data);

        // Log fetched size to check
        // console.log('Fetched PDF size:', fileResponse.data.length, 'bytes');
        // ✅ LOG DOWNLOAD ACTIVITY (only if user is logged in)
        if (userId) {
            const user = await User.findById(userId).select('fullName email');

            if (user) {
                try {
                    console.log('✨ Adding download watermark...');

                    // Add watermark with user info
                    pdfBuffer = await addDownloadWatermarkToPDF(pdfBuffer, {
                        fullName: user.fullName,
                        email: user.email,
                        downloadDate: new Date(),
                    });

                    console.log('✅ Download watermark added successfully');
                    console.log(`📧 User: ${user.fullName} (${user.email})`);
                } catch (watermarkError) {
                    console.error('⚠️ Watermark error (continuing anyway):', watermarkError.message);
                    // Don't fail - continue with original PDF if watermark fails
                }
            }
            await logUserActivity(userId, "NOTE_DOWNLOADED", {
                resourceId: id,
                resourceType: "NOTE",
                downloadSize: fileResponse.data.length,
                planType: req.user?.access?.plan || "FREE",
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID
            });
        }
        // Set headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${note.title}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length); // ✅ CORRECT — watermarked size
        // ✅ STEP 8: SEND PDF
        console.log('📤 Sending PDF to client...');
        // res.status(200).send(pdfBuffer);
        // ✅ NEW — streams in 64KB chunks so browser fires progress events
const CHUNK_SIZE = 64 * 1024; // 64KB per chunk
let offset = 0;

const writeChunk = () => {
  while (offset < pdfBuffer.length) {
    const chunk = pdfBuffer.slice(offset, offset + CHUNK_SIZE);
    offset += CHUNK_SIZE;
    
    const canContinue = res.write(chunk);
    
    // If buffer is full, wait for drain before continuing
    if (!canContinue) {
      res.once('drain', writeChunk);
      return;
    }
  }
  res.end(); // Done
};

writeChunk();
        console.log('✅ Download completed successfully');
        await markStudyActivity(userId);
    } catch (error) {
        console.error('Download error:', error.message);
        return next(new Apperror("Failed to download note: " + error.message, 500));
    }
};




export const getMostViewedNotes = async (req, res, next) => {
    try {
        const timeRange = req.query.timeRange || '7days'; // 7days, 30days, all

        let dateFilter = {};
        if (timeRange === '7days') {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
        } else if (timeRange === '30days') {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
        }

        const notes = await Note.find(dateFilter)
            .populate("uploadedBy", "fullName avatar.secure_url")
            .sort({ views: -1 }) // Sort by views descending
            .limit(10); // Top 10

        res.status(200).json({
            success: true,
            data: notes
        });
    } catch (error) {
        next(new Apperror("Failed to fetch most viewed notes", 500));
    }
};

export const incrementViewCount = async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new Apperror("Invalid note Id", 400));
    }

    try {
        const note = await Note.findById(id);
        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // ✅ INCREMENT VIEWS
        if (userId) {
            const alreadyViewed = note.viewedBy.includes(userId);
            if (!alreadyViewed) {
                note.views += 1;
                note.viewedBy.push(userId);
                await note.save();
            }
        }

        res.status(200).json({
            success: true,
            message: "View counted",
            data: { views: note.views }
        });

    } catch (error) {
        next(new Apperror("Failed to increment view", 500));
    }
};

// ✅ COPY THIS ENTIRE FUNCTION
export const getNoteViewers = async (req, res, next) => {
    try {
        // ✅ IMPORTANT: Use 'id' not 'noteId' because route is /:id
        const { id: noteId } = req.params;

        console.log('🔍 getNoteViewers called with noteId:', noteId);

        // Validate noteId
        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            console.log('❌ Invalid noteId:', noteId);
            return res.status(400).json({
                success: false,
                message: 'Invalid note ID'
            });
        }

        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        console.log('📄 Pagination - Page:', page, 'Limit:', limit, 'Skip:', skip);

        // Find note and get total viewer count
        const note = await Note.findById(noteId).select('viewedBy');
        if (!note) {
            console.log('❌ Note not found:', noteId);
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const totalViewers = note.viewedBy?.length || 0;
        console.log('👥 Total viewers found:', totalViewers);

        // Fetch paginated viewers with user details
        const viewers = await Note.findById(noteId)
            .select('viewedBy')
            .populate({
                path: 'viewedBy',
                select: 'fullName avatar email role academicProfile.semester academicProfile.branch',
                options: {
                    skip: skip,
                    limit: limit
                }
            });

        const viewersList = viewers.viewedBy || [];
        console.log('✅ Returned viewers count:', viewersList.length);

        res.status(200).json({
            success: true,
            data: {
                viewers: viewersList,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(totalViewers / limit),
                    total_viewers: totalViewers,
                    viewers_per_page: limit
                }
            }
        });

    } catch (error) {
        console.error('❌ Error in getNoteViewers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch viewers',
            error: error.message
        });
    }
};

// Toggle note as recommended
export const toggleRecommendNote = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { recommended, rank } = req.body;

        // Validate input
        if (typeof recommended !== 'boolean') {
            return next(new Apperror("Recommended must be boolean", 400));
        }

        if (recommended && (!rank || rank < 1)) {
            return next(new Apperror("Rank must be positive number for recommended notes", 400));
        }

        // Update note
        const note = await Note.findByIdAndUpdate(
            id,
            {
                recommended,
                recommendedRank: recommended ? rank : 0
            },
            { new: true }
        ).populate("uploadedBy", "fullName avatar.secure_url");

        if (!note) {
            return next(new Apperror("Note not found", 404));
        }

        // Clear cache
        await redisClient.del(`notes:${JSON.stringify({})}`);

        res.status(200).json({
            success: true,
            message: `Note ${recommended ? 'marked' : 'unmarked'} as recommended`,
            data: note
        });

    } catch (error) {
        console.error("Error toggling recommendation:", error);
        return next(new Apperror(error.message || "Failed to toggle recommendation", 500));
    }
};

// Get all recommended notes (for admin dashboard)
export const getRecommendedNotes = async (req, res, next) => {
    try {
        const recommendedNotes = await Note.find({ recommended: true })
            .sort({
                recommendedRank: 1,
                downloads: -1
            })
            .select('title subject category recommendedRank downloads views uploadedBy')
            .populate("uploadedBy", "fullName avatar.secure_url")
            .lean();

        res.status(200).json({
            success: true,
            count: recommendedNotes.length,
            data: recommendedNotes
        });

    } catch (error) {
        console.error("Error fetching recommended notes:", error);
        return next(new Apperror(error.message || "Failed to fetch recommended notes", 500));
    }
};