// routes/adminRoutes.js 
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });


const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const { uploadPayoutFile } = require("../middleware/multerMiddleware");
const { uploadTrainingThumbnail, uploadWebinarThumbnail, uploadPromotionalThumbnail } = require("../middleware/cloudinaryUpload");

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
  updateKycStatus,
  bulkRegisterAndEnrollWithRelations,
  getFailedPayouts,
  getReceivedPayments,
  deleteUnpaidAffiliate,
  getAllWebinars,
  createOrUpdateWebinar,
  deleteWebinar,
  getAllPromotionalFolders,
  createOrUpdatePromotionalMaterial,
  deletePromotionalMaterial,
  getMonthlyTDSReport,
  generateTDSCSVByMonth,
  listTDSFiles,
  downloadTDSCSV,
  getPromotionalMaterialById,
  exportInvoiceSheet,
  listInvoiceFiles,
  deleteInvoiceOrPayoutFile,
  createCampaign,
  getAllCampaigns,
  deleteCampaign
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

router.post(
  "/bulk-register-paid-users",
  protect,
  authorizeRoles("admin"),
  bulkRegisterAndEnrollWithRelations
);
router.get("/payouts/failed", protect, authorizeRoles("admin"), getFailedPayouts);
router.get("/payments/received", protect, authorizeRoles("admin"), getReceivedPayments);
router.delete(
  "/users/unpaid/:id",
  protect,
  authorizeRoles("admin"),
  deleteUnpaidAffiliate
);
router.post(
  "/webinars",
  protect,
  authorizeRoles("admin"),
  uploadWebinarThumbnail.single("thumbnail"), // 🔗 Cloudinary thumbnail middleware
  createOrUpdateWebinar
);

router.get(
  "/webinars",
  protect,
  authorizeRoles("admin"),
  getAllWebinars
);

router.delete(
  "/webinars/:id",
  protect,
  authorizeRoles("admin"),
  deleteWebinar
);


router.post(
  "/marketing/promotional",
  protect,
  authorizeRoles("admin"),
  uploadPromotionalThumbnail.single("thumbnail"),
  createOrUpdatePromotionalMaterial
);

router.delete(
  "/marketing/promotional/:id",
  protect,
  authorizeRoles("admin"),
  deletePromotionalMaterial
);
router.get(
  "/marketing/promotional/folders",
  protect,
  authorizeRoles("admin"),
  getAllPromotionalFolders
);



router.get("/tds/report", protect, authorizeRoles("admin"), getMonthlyTDSReport);
router.post("/tds/generate", protect, authorizeRoles("admin"), generateTDSCSVByMonth);
router.get("/tds/files", protect, authorizeRoles("admin"), listTDSFiles);
router.get("/tds/download/:fileName", protect, authorizeRoles("admin"), downloadTDSCSV);
router.get(
  "/invoices/export",
  protect,
  authorizeRoles("admin"),
  exportInvoiceSheet
);
router.get(
  "/invoices/files",
  protect,
  authorizeRoles("admin"),
  listInvoiceFiles
);

router.delete(
  "/:type/delete-file",
  protect,
  authorizeRoles("admin"),
  deleteInvoiceOrPayoutFile
);

router.post("/target-campaign", protect, authorizeRoles("admin"), createCampaign);
router.get("/target-campaigns", protect, authorizeRoles("admin"), getAllCampaigns);
router.delete("/target-campaign/:id", protect, authorizeRoles("admin"), deleteCampaign);


module.exports = router;
