const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");

// 🎯 Controller Functions
const {
  initiatePayment,
  verifyPayment,
  getUserPayments,
  getAllPayments,
  getPaymentDetails,
  processRefund,
} = require("../controllers/paymentController");

// 🔐 Middlewares
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");


// ==============================
// 📩 Razorpay Webhook (No Auth)
// ==============================
router.post("/verify", verifyPayment);


// ==============================
// 🧾 Logged-in User Payments
// ==============================
router.post(
  "/initiate",
  protect,
  [
    check("amount").isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
    check("courseId").notEmpty().withMessage("Course ID is required")
  ],
  initiatePayment
);
router.get("/my-payments", protect, getUserPayments);


// ==============================
// 🔐 Admin Payment Management
// ==============================
router.get("/", protect, authorizeRoles("admin"), getAllPayments);
router.get("/:id", protect, authorizeRoles("admin"), getPaymentDetails);
router.put("/:id/refund", protect, authorizeRoles("admin"), processRefund);


module.exports = router;
