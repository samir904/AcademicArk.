import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { changePassword, forgotPassword, getMyAnalytics, getMyBookmarks, getMyNotes, getProfile, login, logout, register, resetPassword, updateProfile } from "../CONTROLLERS/user.controller.js";
import { isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
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
export default router;