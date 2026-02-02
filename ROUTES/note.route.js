import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import { addRating, bookmarkNote, deleteNote, downloadNote, getAllNotes, getAllNoteStats, getNote, getNotesController, getNoteViewers, getRecommendedNotes, getSemesterPreviewNotes, incrementViewCount, registerNote, toggleRecommendNote, updateNote } from "../CONTROLLERS/note.controller.js";
import upload from "../MIDDLEWARES/multer.middleware.js";
import { cacheNotes, cacheSemesterPreview } from "../MIDDLEWARES/cache.middleware.js";
import { addSem2ToFirstYearCommonSubjects, addSem4ToThirdSemCommonSubjects, addSem6ToFifthSemCommonSubjects, normalizeSemesterField, rollbackSemesterToNumber } from "../CONTROLLERS/migration.controller.js";
import { decideNotesMode } from "../MIDDLEWARES/decideNotesMode.js";
import { canUserDownload } from "../MIDDLEWARES/canUserDownload.js";

const router= Router();

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
router.route("/:id")
.get(
    optionalAuth,
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