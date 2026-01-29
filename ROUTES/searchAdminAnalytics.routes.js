// routes/searchAdminAnalytics.routes.js
import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
import {
  getFailedSearches,
  getTopSearchQueries,
  getSearchCorrections,
  getFailedSearchActionsSummary,   // 👈 ADD
  getSearchSynonyms
} from "../CONTROLLERS/searchAdminAnalytics.controller.js";
import searchAdminSuggestionsRoutes from './searchAdminSuggestions.routes.js'
const router = Router();


router.use(isLoggedIn);

// app.use("/search/admin/suggestions", searchAdminSuggestionsRoutes);
router.use("/suggestions",searchAdminSuggestionsRoutes)
/**
 * 📊 ADMIN: FAILED SEARCHES
 */
router.get(
  "/failed",
  authorizedRoles("ADMIN"),
  asyncWrap(getFailedSearches)
);

router.get(
  "/failed/actions",
  authorizedRoles("ADMIN"),
  asyncWrap(getFailedSearchActionsSummary)
);

/**
 * 📈 ADMIN: TOP SEARCH QUERIES
 */
router.get(
  "/top",
  authorizedRoles("ADMIN"),
  asyncWrap(getTopSearchQueries)
);

/**
 * 🧠 ADMIN: TYPO → CORRECTION MAPPING
 */
router.get(
  "/corrections",
  authorizedRoles("ADMIN"),
  asyncWrap(getSearchCorrections)
);

router.get(
    "/synonyms",
    authorizedRoles('ADMIN'),
    asyncWrap(getSearchSynonyms)
)
export default router;
