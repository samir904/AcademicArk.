import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
import {
  createSearchSynonym,
  updateSearchSynonym,
  toggleSearchSynonym,

  createSearchCorrection,
  updateSearchCorrection,
  toggleSearchCorrection
} from "../CONTROLLERS/searchAdminManage.controller.js";

const router = Router();

/* -------------------- SYNONYMS -------------------- */

router.use(isLoggedIn);
router.post(
  "/synonym",
  authorizedRoles("ADMIN"),
  asyncWrap(createSearchSynonym)
);

router.put(
  "/synonym/:id",
  authorizedRoles("ADMIN"),
  asyncWrap(updateSearchSynonym)
);

router.patch(
  "/synonym/:id/toggle",
  authorizedRoles("ADMIN"),
  asyncWrap(toggleSearchSynonym)
);

/* -------------------- CORRECTIONS -------------------- */

router.post(
  "/correction",
  authorizedRoles("ADMIN"),
  asyncWrap(createSearchCorrection)
);

router.put(
  "/correction/:id",
  authorizedRoles("ADMIN"),
  asyncWrap(updateSearchCorrection)
);

router.patch(
  "/correction/:id/toggle",
  authorizedRoles("ADMIN"),
  asyncWrap(toggleSearchCorrection)
);

export default router;
