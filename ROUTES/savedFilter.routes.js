import { Router } from "express";
import {
  createSavedFilter,
  getSavedFilters,
  deleteSavedFilter,
  setDefaultSavedFilter,
  incrementPresetUsage
} from "../CONTROLLERS/savedFilter.controller.js";
import { isLoggedIn } from "../middlewares/auth.middleware.js";
import asyncWrap from '../UTIL/asyncWrap.js'

const router = Router();

router.use(isLoggedIn);

// Create preset
router.post("/", asyncWrap(createSavedFilter));

// Get all presets
router.get("/", asyncWrap(getSavedFilters));

// Delete preset
router.delete("/:id", asyncWrap(deleteSavedFilter));

// Set default preset
router.put("/:id/default", asyncWrap(setDefaultSavedFilter));

// Track usage (called when user applies preset)
router.post("/:id/use", asyncWrap(incrementPresetUsage));

export default router;