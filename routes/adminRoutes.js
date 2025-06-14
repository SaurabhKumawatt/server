// routes/adminRoutes.js (naya file bana sakte ho ya payoutRoutes.js me add karo)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });


const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles"); 
const { uploadPayoutFile } = require("../middleware/multerMiddleware");
const { uploadTrainingThumbnail } = require("../middleware/cloudinaryUpload");

const {
    getUsersForPayoutApproval,
    approveAndGeneratePayout,
    listPayoutCSVFiles,
    uploadBankResponse,
    downloadWeeklyPayoutCSV,
    getUsersForPayout,
    getProcessingPayouts,
    getCompletePayouts,
    getPayoutCSVFiles,
    createTraining,
     getAllUserSummaries, 
     loginAsUser,
     getPendingKycs,
     updateKycStatus
} = require("../controllers/adminController");

// 🔐 Get complete user info (admin only)
router.get("/users/summary", protect, authorizeRoles("admin"), getAllUserSummaries);

// 🔐 Login as user (admin impersonation)
router.post("/login-as-user/:userId", protect, authorizeRoles("admin"), loginAsUser);

router.get("/kyc/pending", protect, authorizeRoles("admin"), getPendingKycs);
router.put("/kyc/:userId/update", protect, authorizeRoles("admin"), updateKycStatus);


router.get("/payouts", protect, authorizeRoles("admin"), getUsersForPayout);

router.get("/payout/users-for-approval", protect, authorizeRoles("admin"), getUsersForPayoutApproval);
router.post("/payout/approve-and-generate", protect, authorizeRoles("admin"), approveAndGeneratePayout);
router.get("/payout/download-weekly", protect, authorizeRoles("admin"), downloadWeeklyPayoutCSV);
router.get("/payout/files", protect, authorizeRoles("admin"), listPayoutCSVFiles);
router.post(
  "/payout/upload-bank-response",
  protect,
  authorizeRoles("admin"),
  uploadPayoutFile().single("file"),
  uploadBankResponse
);
router.get("/payouts/processing", protect, authorizeRoles("admin"), getProcessingPayouts);
router.get("/payouts/complete", protect, authorizeRoles("admin"), getCompletePayouts);

router.post(
  "/trainings",
  protect,
  authorizeRoles("admin"),
  uploadTrainingThumbnail.single("thumbnail"),
  createTraining
);


module.exports = router;
