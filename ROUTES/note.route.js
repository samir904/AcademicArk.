import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import { addRating, bookmarkNote, deleteNote, downloadNote, getAllNotes, getNote, incrementViewCount, registerNote, updateNote } from "../CONTROLLERS/note.controller.js";
import upload from "../MIDDLEWARES/multer.middleware.js";
import { cacheNotes } from "../MIDDLEWARES/cache.middleware.js";

const router= Router();

router.route("/")
.post(
    asyncWrap(isLoggedIn),
    asyncWrap(authorizedRoles("TEACHER","ADMIN")),
    upload.single('fileDetails'),
    asyncWrap(registerNote)
).get(
    optionalAuth,
    asyncWrap(cacheNotes),//attempt to serve from cache first 
    asyncWrap(getAllNotes)//if not then hit controller and then cache
)

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
    asyncWrap(downloadNote)
)


export default router;