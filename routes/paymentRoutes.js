const express = require("express");
const router = express.Router();

const {
  initiatePayment,
  verifyPayment,
  getUserPayments,
  getAllPayments,
  getPaymentDetails,
  processRefund,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");

// ✅ Razorpay Webhook (public endpoint, no auth required)
router.post("/verify", verifyPayment);

// ✅ Logged-in User: Initiate Payment

// ✅ Logged-in User: View own payments
router.post("/initiate", protect, initiatePayment);
router.get("/my-payments", protect, getUserPayments);

// 🔐 Admin Only: Manage all payments
router.get("/", protect, authorizeRoles("admin"), getAllPayments);
router.get("/:id", protect, authorizeRoles("admin"), getPaymentDetails);
router.put("/:id/refund", protect, authorizeRoles("admin"), processRefund);

module.exports = router;
