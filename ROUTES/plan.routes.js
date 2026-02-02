import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { isLoggedIn, authorizedRoles, optionalAuth } from "../MIDDLEWARES/auth.middleware.js";
import {
  getActivePlans,
  getAllPlansAdmin,
  createPlan,
  updatePlan,
  togglePlanStatus
} from "../CONTROLLERS/plan.controller.js";

const router = Router();

router.use(optionalAuth);
// 🔓 PUBLIC – show plans to users
router.get(
  "/",
  asyncWrap(getActivePlans)
);

// 🔐 ADMIN – manage plans
router.get(
  "/admin",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(getAllPlansAdmin)
);

router.post(
  "/admin",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(createPlan)
);

router.patch(
  "/admin/:id",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(updatePlan)
);

router.patch(
  "/admin/:id/toggle",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(togglePlanStatus)
);

export default router;
