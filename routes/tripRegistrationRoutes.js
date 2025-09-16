const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const {
  getUserByAffiliate,
  registerTrip,
  verifyTripPayment,
  getAllTripRegistrations,
  checkUserTrip 
} = require("../controllers/tripRegistrationController");

// User autofill by affiliate code
router.get("/user/:affiliateCode", protect, getUserByAffiliate);

// Register & pay
router.post("/register", protect, registerTrip);

// Razorpay webhook
router.post("/verify", verifyTripPayment);

// Admin: View all paid registrations
router.get("/", protect, authorizeRoles("admin"), getAllTripRegistrations);

// routes/tripRegistrationRoutes.js
router.get("/check/:userId", protect, checkUserTrip);


module.exports = router;
