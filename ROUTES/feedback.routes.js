import { Router } from "express";
import {
    submitFeedback,
    getUserFeedback,
    getFeedbackById,
    getAllFeedback,
    updateFeedbackStatus,
    getFeedbackAnalytics,
    deleteFeedback
} from "../CONTROLLERS/feedback.controller.js";
import { isLoggedIn, authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import asyncWrap from "../UTIL/asyncWrap.js";
import upload from "../MIDDLEWARES/multer.middleware.js";

const router = Router();

// USER ROUTES
router.post(
    "/submit",
    asyncWrap(isLoggedIn),
    upload.array("attachments", 3), // Max 3 files
    asyncWrap(submitFeedback)
);

router.get(
    "/my-feedback",
    asyncWrap(isLoggedIn),
    asyncWrap(getUserFeedback)
);

router.get(
    "/:id",
    asyncWrap(isLoggedIn),
    asyncWrap(getFeedbackById)
);

router.delete(
    "/:id",
    asyncWrap(isLoggedIn),
    asyncWrap(deleteFeedback)
);

// ADMIN ROUTES
router.get(
    "/",
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(getAllFeedback)
);

router.put(
    "/:id/status",
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(updateFeedbackStatus)
);

router.get(
    "/analytics/overview",
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("ADMIN")),
    asyncWrap(getFeedbackAnalytics)
);

export default router;
