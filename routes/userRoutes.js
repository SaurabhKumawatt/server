console.log("🛠️ Loading userRoutes");

const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { check, validationResult } = require("express-validator");

// 🧠 Controllers
const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getLoggedInUserProfile,
  updateUserProfile,
  changePassword,
  getKycStatus,
  submitKycDetails,
  getAffiliateLeads,
  getAffiliateCommissions,
  requestPayout,
  getIndustryEarnings,
  updateIndustryEarnings,
  getSalesStats,
  deleteLeadById,
  getTopIncomeLeads,
  loginAdmin,
  getUserPayouts,
  getCommissionSummary,
  getLeaderboard,
  getAllPublishedTrainings
} = require("../controllers/userController");

// 🔐 Middlewares
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const { uploadTo } = require("../middleware/multerMiddleware");
const { uploadProfileImage } = require("../middleware/cloudinaryUpload");





// ==============================
// 👤 Auth Routes
// ==============================
router.post(
  "/register",
  [
    check("fullName").notEmpty().withMessage("Full Name is required"),
    check("username").notEmpty().withMessage("Username is required"),
    check("email").isEmail().withMessage("Valid email is required"),
    check("mobileNumber").isMobilePhone("en-IN").withMessage("Valid mobile number required"),
    check("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    check("address").notEmpty().withMessage("Address is required"),
  ],
  registerUser
);
router.post("/login", loginUser);
router.get("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

router.get("/validate-code/:code", async (req, res) => {
  try {
    const user = await User.findOne({
      affiliateCode: new RegExp(`^${req.params.code}$`, "i") // case-insensitive match
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ name: user.fullName });
  } catch (err) {
    console.error("Error validating referral code:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// 🔐 Authenticated User Routes
// ==============================
router.get("/me", protect, getLoggedInUserProfile);
router.put(
  "/update-profile",
  protect,
  uploadProfileImage.single("image"),
  updateUserProfile
);
router.put("/change-password", protect, changePassword);


// ==============================
// 🧾 KYC
// ==============================
router.get("/kyc-status", protect, getKycStatus);
router.get("/trainings", protect, getAllPublishedTrainings);
router.post(
  "/submit-kyc",
  protect,
  uploadTo("kyc-docs").fields([
    { name: "aadhaarFrontImage", maxCount: 1 },
    { name: "aadhaarBackImage", maxCount: 1 },
    { name: "panProofImage", maxCount: 1 },
  ]),
  submitKycDetails
);


// ==============================
// 💼 Affiliate Features
// ==============================
router.get("/leads", protect, authorizeRoles("paid-affiliate", "admin"), getAffiliateLeads);
router.delete("/leads/:id", protect, authorizeRoles("paid-affiliate", "admin"), deleteLeadById);
router.get("/commissions", protect, authorizeRoles("paid-affiliate", "admin"), getAffiliateCommissions);
router.get("/industry-earnings", protect, authorizeRoles("paid-affiliate", "admin"), getIndustryEarnings);
router.post("/request-payout", protect, authorizeRoles("paid-affiliate", "admin"), requestPayout);
router.get("/sales-stats", protect, authorizeRoles("paid-affiliate", "admin"), getSalesStats);
router.get("/top-income-leads", protect, authorizeRoles("paid-affiliate", "admin"), getTopIncomeLeads);
router.get("/payouts", protect, authorizeRoles("paid-affiliate", "admin"), getUserPayouts);
router.get("/commission-summary", protect, authorizeRoles("paid-affiliate", "admin"), getCommissionSummary);
router.get("/leaderboard", protect, getLeaderboard);


// ==============================
// 🔐 Admin Features
// ==============================
router.post("/admin-login",loginAdmin);
router.patch(
  "/:userId/industry-earnings",
  protect,
  authorizeRoles("admin"),
  updateIndustryEarnings
);

module.exports = router;
