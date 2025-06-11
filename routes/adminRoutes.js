// routes/adminRoutes.js (naya file bana sakte ho ya payoutRoutes.js me add karo)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });


const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles"); 
const { uploadPayoutFile } = require("../middleware/multerMiddleware");

const {
    getUsersForPayoutApproval,
    approveAndGeneratePayout,
    listPayoutCSVFiles,
    uploadBankResponse,
    downloadWeeklyPayoutCSV,
    getUsersForPayout,
    getProcessingPayouts,
    getCompletePayouts,
    getPayoutCSVFiles
} = require("../controllers/adminController");


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



module.exports = router;
