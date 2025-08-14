// // routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { body, check, validationResult } = require("express-validator");

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
  getAllPublishedTrainings,
  adminSearchUser,
  updateKycDetails,
  getAllWebinars,
  getMyNearbyRank,
  sendOtpToCurrentEmail,
  verifyOtpForEmailUpdate,
  updateUserEmail,
  sendOtpForMobileUpdate,
  verifyOtpForMobileUpdate,
  updateMobileNumber,
  getPromotionalRootFolders,
  getPromotionalChildrenBySlug,
  getPromotionalChildrenByCat,
  trackCourseUsage,
  getTargetProgress,
  getUserTargetCampaigns
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
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  loginUser
);

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
router.put(
  "/change-password",
  protect,
  [
    body("oldPassword").isString().notEmpty().withMessage("Old password is required"),
    body("newPassword").isString().isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
  ],
  changePassword
);
router.get("/target-campaigns", protect, getUserTargetCampaigns);


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
    { name: "bankProofDoc", maxCount: 1 },
  ]),
  submitKycDetails
);
router.patch(
  "/submit-kyc",
  protect,
  uploadTo("kyc-docs").fields([
    { name: "aadhaarFrontImage", maxCount: 1 },
    { name: "aadhaarBackImage", maxCount: 1 },
    { name: "panProofImage", maxCount: 1 },
    { name: "bankProofDoc", maxCount: 1 },
  ]),
  updateKycDetails  // 🔁 new controller to update instead of create
);
router.get("/target-progress", protect, getTargetProgress);




// ==============================
// 💼 Affiliate Features
// ==============================
router.post("/update/send-otp", protect, authorizeRoles("paid-affiliate", "admin"), sendOtpToCurrentEmail);
router.post("/update/verify-otp", protect, authorizeRoles("paid-affiliate", "admin"), verifyOtpForEmailUpdate);
router.put("/update/email", protect, authorizeRoles("paid-affiliate", "admin"), updateUserEmail);
router.post("/update-mobile/send-otp", protect, authorizeRoles("paid-affiliate", "admin"), sendOtpForMobileUpdate);
router.post("/update-mobile/verify-otp", protect, authorizeRoles("paid-affiliate", "admin"), verifyOtpForMobileUpdate);
router.put("/update-mobile", protect, authorizeRoles("paid-affiliate", "admin"), updateMobileNumber);
router.get("/leads", protect, authorizeRoles("paid-affiliate", "admin"), getAffiliateLeads);
router.delete("/leads/:id", protect, authorizeRoles("paid-affiliate", "admin"), deleteLeadById);
router.get("/commissions", protect, authorizeRoles("paid-affiliate", "admin"), getAffiliateCommissions);
router.get("/industry-earnings", protect, authorizeRoles("paid-affiliate", "admin"), getIndustryEarnings);
router.post(
  "/request-payout",
  protect,
  [
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be a number greater than 0"),
    body("commissionId").isMongoId().withMessage("Invalid commission ID"),
  ],
  requestPayout
);
router.get("/sales-stats", protect, authorizeRoles("paid-affiliate", "admin"), getSalesStats);
router.get("/top-income-leads", protect, authorizeRoles("paid-affiliate", "admin"), getTopIncomeLeads);
router.get("/payouts", protect, authorizeRoles("paid-affiliate", "admin"), getUserPayouts);
router.get("/commission-summary", protect, authorizeRoles("paid-affiliate", "admin"), getCommissionSummary);
router.get("/leaderboard", protect, getLeaderboard);
router.get("/my-rank-nearby", protect, authorizeRoles("paid-affiliate", "admin"), getMyNearbyRank);
router.get("/marketing/promotional", protect, authorizeRoles("paid-affiliate", "admin"), getPromotionalRootFolders);
router.get("/marketing/promotional/:slug", protect, authorizeRoles("paid-affiliate", "admin"), getPromotionalChildrenBySlug);
router.get("/marketing/promotional-cat/:slug", protect, authorizeRoles("paid-affiliate", "admin"), getPromotionalChildrenByCat);
router.put("/track-usage", protect, authorizeRoles("paid-affiliate", "admin"), trackCourseUsage);






// ==============================
// 🔐 Admin Features
// ==============================
router.post("/admin-login", loginAdmin);
router.patch(
  "/:userId/industry-earnings",
  protect,
  authorizeRoles("admin"),
  [
    body("industryEarnings")
      .isArray().withMessage("industryEarnings must be an array")
  ],
  updateIndustryEarnings
);
router.get("/admin-search", protect, authorizeRoles("admin"), adminSearchUser);
router.get("/webinars", protect, authorizeRoles("paid-affiliate", "admin"), getAllWebinars);
router.get("/stravix/:videoId", (req, res) => {
  const { videoId } = req.params;
  const url = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`;
  res.redirect(url);
});

module.exports = router;
