import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import { addRating, bookmarkNote, bulkUploadNotes, deleteNote, downloadNote, getAllNotes, getAllNoteStats, getNote, getNotesController, getNoteViewers, getRecommendedNotes, getRelatedNotes, getSemesterPreviewNotes, getSubjectSuggestions, incrementViewCount, registerNote, toggleLockNote, toggleRecommendNote, updateNote } from "../CONTROLLERS/note.controller.js";
import upload from "../MIDDLEWARES/multer.middleware.js";
import { cacheNotes, cacheSemesterPreview } from "../MIDDLEWARES/cache.middleware.js";
import { addSem2ToFirstYearCommonSubjects, addSem4ToThirdSemCommonSubjects, addSem6ToFifthSemCommonSubjects, normalizeSemesterField, rollbackSemesterToNumber } from "../CONTROLLERS/migration.controller.js";
import { decideNotesMode } from "../MIDDLEWARES/decideNotesMode.js";
import { canUserDownload } from "../MIDDLEWARES/canUserDownload.js";
import { trackRelatedNoteClick } from "../CONTROLLERS/relatedNotesController.js";
import { bulkUploadProgress } from "../UTIL/job.store.js";

const router= Router();

// GET /api/v1/notes/subjects/suggestions?q=oper&semester=5
router.get(
  '/subjects/suggestions',
  optionalAuth,
  asyncWrap(getSubjectSuggestions)
);
// note.routes.js — add ABOVE the bulk-upload POST route

// POST /api/v1/notes/bulk-upload/validate  (dry-run — no upload, just validate metadata)
router.post(
  "/bulk-upload/validate",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(async (req, res, next) => {
    let metadataList;
    try {
      metadataList = JSON.parse(req.body.metadata);
    } catch {
      return next(new AppError('Invalid metadata JSON', 400));
    }

    if (!Array.isArray(metadataList) || metadataList.length === 0)
      return next(new AppError('Metadata array is required', 400));

    const VALID_CATEGORIES = ['Notes', 'Important Question', 'PYQ', 'Handwritten Notes'];

    const errors = [];
    for (const meta of metadataList) {
      const errs = [];
      if (!meta.title?.trim() || meta.title.trim().length < 3)
        errs.push('Title must be at least 3 characters');
      if (!meta.description?.trim() || meta.description.trim().length < 10)
        errs.push('Description must be at least 10 characters');
      if (!meta.subject?.trim())
        errs.push('Subject is required');
      const semNums = String(meta.semester ?? '')
        .split(',').map(s => parseInt(s.trim())).filter(n => n >= 1 && n <= 8);
      if (!semNums.length)
        errs.push('At least one valid semester (1–8) is required');
      if (!VALID_CATEGORIES.includes(meta.category))
        errs.push(`Invalid category: ${meta.category}`);
      if (errs.length) errors.push({ filename: meta.filename, errors: errs });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed — fix errors and retry',
        validationErrors: errors,
      });
    }

    return res.status(200).json({
      success: true,
      message: `All ${metadataList.length} rows passed validation`,
    });
  })
);
// POST /api/v1/notes/bulk-upload
router.post(
  "/bulk-upload",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  upload.fields([{ name: 'files', maxCount: 50 }]),
  asyncWrap(bulkUploadNotes)
);
router.get(
  "/bulk-upload/template",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  (req, res) => {
    const csv = [
      "filename,title,description,subject,semester,category",
      "os_unit1.pdf,Operating Systems Unit 1,Process management and CPU scheduling,Operating Systems,5,Notes",
      "cn_pyq_2023.pdf,Computer Networks PYQ 2023,Previous year questions 2023,Computer Networks,5,PYQ",
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bulk_upload_template.csv"');
    res.send(csv);
  }
);
// GET /api/v1/notes/bulk-upload/progress/:jobId
router.get(
  "/bulk-upload/progress/:jobId",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  bulkUploadProgress   // SSE handler below
);

router.route("/")
.post(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER","ADMIN")),
    upload.single('fileDetails'),
    asyncWrap(registerNote)
).get(
    optionalAuth,
    decideNotesMode,          // 🧠 decide first
    asyncWrap(cacheNotes),//attempt to serve from cache first 
    asyncWrap(getAllNotes)//if not then hit controller and then cache
)

router.get(
  "/preview",
  optionalAuth,
  cacheSemesterPreview,
  asyncWrap(getSemesterPreviewNotes)
);
// 📊 STATS ROUTE (MUST BE ABOVE /:id)
router.get(
  "/stats",
  optionalAuth,
  asyncWrap(getAllNoteStats)
);

// ============================================
// ✅ NEW: GET NOTE VIEWERS (Separate Endpoint)
// ============================================
// Route: GET /notes/:id/viewers
// Query params: ?page=1&limit=20
router.get("/:id/viewers",
    optionalAuth,
    asyncWrap(getNoteViewers)
);
// ── Add BEFORE /:id route (specific routes must come before param routes) ──
router.get(
  "/:id/related",
  optionalAuth,
  asyncWrap(getRelatedNotes)
);
router.route("/:id")
.get(
    isLoggedIn,// protected by islogged in new 
    asyncWrap(getNote)
)
.put(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER","ADMIN")),
    upload.single('fileDetails'),
    asyncWrap(updateNote)
)
.delete(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(deleteNote)
)


router.route("/:id/view").get(optionalAuth, asyncWrap(incrementViewCount));

router.post("/:id/rate",
    asyncWrap(isLoggedIn),
    asyncWrap(addRating)
)

router.route("/:id/bookmark")
.get(
    asyncWrap(isLoggedIn),
    asyncWrap(bookmarkNote)
)
router.get("/:id/download",
    asyncWrap(isLoggedIn),
     asyncWrap(canUserDownload),
    asyncWrap(downloadNote)
)

// Admin routes (add these to your existing routes)
router.route("/admin/recommend/:id")
  .patch(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(toggleRecommendNote)
  );

router.route("/admin/recommendations")
  .get(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(getRecommendedNotes)
  );

  // 🔒 Admin: Lock / Unlock Note
router.route("/admin/lock/:id")
  .patch(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(toggleLockNote)
  );
// POST /api/v1/notes/related-click
// optionalAuth → attaches req.user if token present, doesn't block if not
router.post("/related-click", optionalAuth, trackRelatedNoteClick);

// Optional: Get all notes for admin dashboard
// router.route("/admin/all")
//   .get(
//     asyncWrap(isLoggedIn),
//     asyncWrap(authorizedRoles("ADMIN")),
//     asyncWrap(getAllNotesForAdmin)
//   );

// // 🚨 ONE-TIME MIGRATION ROUTE
// router.post(
//   "/first-year/common-subjects",
//   asyncWrap(isLoggedIn),
//   asyncWrap(authorizedRoles("ADMIN")),
//   asyncWrap(migrateFirstYearCommonSubjects)
// );

// router.post(
//   "/cleanupInvalidSemesterTwo",
//   asyncWrap(isLoggedIn),
//   asyncWrap(authorizedRoles("ADMIN")),
//   asyncWrap(cleanupInvalidSemesterTwo)
// );

router.post(
  "/normalizesemester",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(addSem6ToFifthSemCommonSubjects)
);


export default router;