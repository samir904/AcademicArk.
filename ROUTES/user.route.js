import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { changePassword,
    // ✨ NEW IMPORTS
    updateAcademicProfile,
    getAcademicProfile,
    checkProfileCompletion,
    // ✨ new
    getCollegeList,
    approveCustomCollege,
    getAcademicAnalytics, forgotPassword, getMyAnalytics, getMyBookmarks, getMyNotes, getProfile, getPublicProfile, login, logout, register, resetPassword, toggleProfileVisibility, updateProfile, updateSocialLinks, 
    incrementSemesterOnce,
    getDownloadQuota} from "../CONTROLLERS/user.controller.js";
import { authorizedRoles, isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import upload from "../MIDDLEWARES/multer.middleware.js";


const router= Router();


router.post("/register",upload.single('avatar'),asyncWrap(register));
router.post("/login",asyncWrap(login));
router.get("/logout",asyncWrap(logout));
// router.post('/validate-token', validateToken);
router.get("/getprofile",asyncWrap(isLoggedIn),asyncWrap(getProfile));

router.post("/reset",asyncWrap(forgotPassword));
router.post("/reset-password/:resetToken",asyncWrap(resetPassword));
router.post("/change-password",asyncWrap(isLoggedIn),asyncWrap(changePassword));
router.put("/update",asyncWrap(isLoggedIn),upload.single('avatar'),asyncWrap(updateProfile))
router.get('/my-analytics', 
    asyncWrap(isLoggedIn),
    asyncWrap(getMyAnalytics)
);

router.get('/my-notes', 
    asyncWrap(isLoggedIn),
    asyncWrap(getMyNotes)
);

router.get('/my-bookmarks', 
    asyncWrap(isLoggedIn),
    asyncWrap(getMyBookmarks)
);

// NEW: Public profile routes
router.get('/public-profile/:userId', asyncWrap(getPublicProfile));
router.put('/update-social-links', asyncWrap(isLoggedIn), asyncWrap(updateSocialLinks));
router.put('/toggle-profile-visibility', asyncWrap(isLoggedIn), asyncWrap(toggleProfileVisibility));

// ✨ NEW: ACADEMIC PROFILE ROUTES
// Update academic profile (Semester, College, Branch)
router.put('/academic-profile', 
    asyncWrap(isLoggedIn), 
    asyncWrap(updateAcademicProfile)
);

// Get academic profile
router.get('/academic-profile', 
    asyncWrap(isLoggedIn), 
    asyncWrap(getAcademicProfile)
);

// Check if profile is completed
router.get('/academic-profile/check', 
    asyncWrap(isLoggedIn), 
    asyncWrap(checkProfileCompletion)
);
// ✨ NEW: Get college list (PUBLIC - no auth needed)
router.get('/colleges/list', 
    asyncWrap(getCollegeList)
);

// ✨ ADMIN ONLY: Get analytics about all users' academic profiles
router.get('/academic-analytics', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(getAcademicAnalytics)
);

// ✨ ADMIN ONLY: Approve custom colleges
router.post('/colleges/approve', 
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles('ADMIN')),
    asyncWrap(approveCustomCollege)
);

// 🚨 ADMIN ONLY — ONE TIME SEMESTER INCREMENT
router.post(
  "/academic-profile/increment-semester",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(incrementSemesterOnce)
);

router.get(
    "/download-quota",
    optionalAuth,
    asyncWrap(getDownloadQuota)
)


export default router;