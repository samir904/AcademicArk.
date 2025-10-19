import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { changePassword, forgotPassword, getMyAnalytics, getMyBookmarks, getMyNotes, getProfile, getPublicProfile, login, logout, register, resetPassword, toggleProfileVisibility, updateProfile, updateSocialLinks } from "../CONTROLLERS/user.controller.js";
import { authorizedRoles, isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
import upload from "../MIDDLEWARES/multer.middleware.js";


const router= Router();


router.post("/register",upload.single('avatar'),asyncWrap(register));
router.post("/login",asyncWrap(login));
router.get("/logout",asyncWrap(logout));
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

export default router;