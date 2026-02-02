import { Router } from "express";
import asyncWrap from "../UTIL/asyncWrap.js";
import { authorizedRoles, isLoggedIn } from "../MIDDLEWARES/auth.middleware.js";
import {
  createCashfreeOrder,
  cashfreeWebhook,
  getPaymentStatus
} from "../CONTROLLERS/payment.controller.js";
import {
  getAllPaymentsAdmin,
  getPaymentStatsAdmin
} from "../CONTROLLERS/payment.admin.controller.js";
const router = Router();

// 🔐 Create order (user initiates payment)
router.post(
  "/create-order",
  asyncWrap(isLoggedIn),
  asyncWrap(createCashfreeOrder)
);

// 🔔 Cashfree webhook (NO auth)
router.post(
  "/cashfree/webhook",
  asyncWrap(cashfreeWebhook)
);

// 🔎 Frontend polls this after redirect
router.get(
  "/status/:orderId",
  asyncWrap(isLoggedIn),
  asyncWrap(getPaymentStatus)
);

// 🔐 ADMIN: all payments (table)
router.get(
  "/admin/all",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(getAllPaymentsAdmin)
);

// 📊 ADMIN: payment analytics (dashboard cards)
router.get(
  "/admin/stats",
  asyncWrap(isLoggedIn),
  asyncWrap(authorizedRoles("ADMIN")),
  asyncWrap(getPaymentStatsAdmin)
);

export default router;
