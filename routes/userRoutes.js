console.log("🛠️ Loading userRoutes");

const express = require("express");
const router = express.Router();

// 🧠 Controllers
const {
  registerUser,
  loginUser,
  logoutUser,
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
} = require("../controllers/userController");

// 🔐 Middlewares
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const { uploadTo } = require("../middleware/multerMiddleware");


// ==============================
// 👤 Auth Routes
// ==============================
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", logoutUser);


// ==============================
// 🔐 Authenticated User Routes
// ==============================
router.get("/me", protect, getLoggedInUserProfile);

router.put(
  "/update-profile",
  protect,
  uploadTo("profile").single("image"),
  updateUserProfile
);

router.put("/change-password", protect, changePassword);


// ==============================
// 🧾 KYC
// ==============================
router.get("/kyc-status", protect, getKycStatus);

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
router.get("/leads", protect, getAffiliateLeads);
router.delete("/leads/:id", protect, deleteLeadById);
router.get("/commissions", protect, getAffiliateCommissions);
router.get("/industry-earnings", protect, getIndustryEarnings);
router.post("/request-payout", protect, requestPayout);
router.get("/sales-stats", protect, getSalesStats);
router.get("/top-income-leads", protect, getTopIncomeLeads);


// ==============================
// 🔐 Admin Features
// ==============================
router.patch(
  "/:userId/industry-earnings",
  protect,
  authorizeRoles("admin"),
  updateIndustryEarnings
);

module.exports = router;
