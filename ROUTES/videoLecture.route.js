import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import {
  authorizedRoles,
  isLoggedIn,
  optionalAuth,
} from "../MIDDLEWARES/auth.middleware.js";
import {
  registerVideoLecture,
  getAllVideoLectures,
  getVideoLecture,
  addVideoRating,
  bookmarkVideo,
  // addVideoRating,
  // bookmarkVideo,
} from "../CONTROLLERS/videoLecture.controller.js";

const router = Router();

router
  .route("/")
  .post(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER", "ADMIN")),
    asyncWrap(registerVideoLecture)
  )
  .get(optionalAuth, asyncWrap(getAllVideoLectures));

router
  .route("/:id")
  .get(optionalAuth, asyncWrap(getVideoLecture));

// Later:
router.post("/:id/rate", asyncWrap(isLoggedIn), asyncWrap(addVideoRating));
router.get("/:id/bookmark", asyncWrap(isLoggedIn), asyncWrap(bookmarkVideo));

export default router;
