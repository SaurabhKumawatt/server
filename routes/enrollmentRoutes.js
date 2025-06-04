const express = require("express");
const router = express.Router();

const {
  getUserEnrollments,
  updateCourseProgress,
  getAllEnrollments,
  getEnrollmentDetails,
  updateEnrollmentStatus,
  manualEnrollUserWithPayment,
  manualUnenrollUser,
} = require("../controllers/enrollmentController");

const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");

// ✅ Authenticated User Routes
router.get("/my-enrollments", protect, getUserEnrollments);
router.put("/update-progress", protect, updateCourseProgress);

// 🔐 Admin Only Routes
router.get("/", protect, authorizeRoles("admin"), getAllEnrollments);
router.get("/:id", protect, authorizeRoles("admin"), getEnrollmentDetails);
router.put("/:id/status", protect, authorizeRoles("admin"), updateEnrollmentStatus);
router.post("/manual-enroll", protect, authorizeRoles("admin"), manualEnrollUserWithPayment);
router.delete("/manual-unenroll", protect, authorizeRoles("admin"), manualUnenrollUser);

module.exports = router;
