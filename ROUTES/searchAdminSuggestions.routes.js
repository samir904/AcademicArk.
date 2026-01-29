// routes/searchAdminSuggestions.routes.js
import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles } from "../MIDDLEWARES/auth.middleware.js";
import { getCorrectionSuggestions } from "../CONTROLLERS/searchAdminSuggestions.controller.js";

const router = Router();

router.get(
  "/corrections",
  authorizedRoles("ADMIN"),
  asyncWrap(getCorrectionSuggestions)
);

export default router;
