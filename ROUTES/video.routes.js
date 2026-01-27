import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn, authorizedRoles, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import {
    uploadVideo,
    getAllVideos,
    getVideo,
    updateWatchProgress,
    rateVideo,
    bookmarkVideo,
    getBookmarkedVideos,
    getWatchHistory,
    getVideosBySubjectChapter,
    getRecommendedVideos,
    deleteVideo
} from "../CONTROLLERS/video.controller.js";

const router = Router();

// ============================================================================
//  ✅ PUBLIC ROUTES (Anyone can view)
// ============================================================================

// Get all videos with filters
// GET /api/v1/videos?subject=data-structures&semester=2&sortBy=views&page=1&limit=12
router.get("/",
    optionalAuth,
    asyncWrap(getAllVideos)
);

// Get videos by subject and chapter
// GET /api/v1/videos/subject/data-structures/semester/2/chapter/1
// Get videos by subject and chapter
router.get("/:subject/:semester/:chapter",
    optionalAuth,
    asyncWrap(getVideosBySubjectChapter)
);

// Get videos by subject and semester only
router.get("/:subject/:semester",
    optionalAuth,
    asyncWrap(getVideosBySubjectChapter)
);

// Get single video and track view
// GET /api/v1/videos/watch/:id
router.get("/watch/:id",
    optionalAuth,
    asyncWrap(getVideo)
);

// Get recommended videos
// GET /api/v1/videos/recommended/:id
router.get("/recommended/:id",
    optionalAuth,
    asyncWrap(getRecommendedVideos)
);


// ============================================================================
//  ✅ AUTHENTICATED ROUTES (Login required)
// ============================================================================

// Upload new video (Teacher/Admin only)
// POST /api/v1/videos/upload
router.post("/upload",
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER", "ADMIN")),
    asyncWrap(uploadVideo)
);

// Update watch progress
// PUT /api/v1/videos/:id/watch-progress
router.put("/:id/watch-progress",
    asyncWrap(isLoggedIn),
    asyncWrap(updateWatchProgress)
);

// Rate video
// POST /api/v1/videos/:id/rate
router.post("/:id/rate",
    asyncWrap(isLoggedIn),
    asyncWrap(rateVideo)
);

// Bookmark video
// GET /api/v1/videos/:id/bookmark
router.get("/:id/bookmark",
    asyncWrap(isLoggedIn),
    asyncWrap(bookmarkVideo)
);

// Get user's bookmarked videos
// GET /api/v1/videos/bookmarks/my-bookmarks
router.get("/bookmarks/my-bookmarks",
    asyncWrap(isLoggedIn),
    asyncWrap(getBookmarkedVideos)
);

// Get watch history
// GET /api/v1/videos/history/my-history
router.get("/history/my-history",
    asyncWrap(isLoggedIn),
    asyncWrap(getWatchHistory)
);

// Delete video (Teacher/Admin only)
// DELETE /api/v1/videos/:id
router.delete("/:id",
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER", "ADMIN")),
    asyncWrap(deleteVideo)
);

export default router;