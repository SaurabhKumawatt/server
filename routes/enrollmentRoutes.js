const express = require("express");
const router = express.Router();

// 🎯 Controller Functions
const {
  getUserEnrollments,
  updateCourseProgress,
  getAllEnrollments,
  getEnrollmentDetails,
  updateEnrollmentStatus,
  manualEnrollUserWithPayment,
  manualUnenrollUser,
} = require("../controllers/enrollmentController");

// 🔐 Middlewares
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");


// ==============================
// 📚 User-Side Enrollments
// ==============================
router.get("/my-enrollments", protect, getUserEnrollments);
router.put("/update-progress", protect, updateCourseProgress);


// ==============================
// 🔐 Admin-Side Enrollment Management
// ==============================
router.get("/", protect, authorizeRoles("admin"), getAllEnrollments);
router.get("/:id", protect, authorizeRoles("admin"), getEnrollmentDetails);
router.put("/:id/status", protect, authorizeRoles("admin"), updateEnrollmentStatus);
router.post("/manual-enroll", protect, authorizeRoles("admin"), manualEnrollUserWithPayment);
router.delete("/manual-unenroll", protect, authorizeRoles("admin"), manualUnenrollUser);


module.exports = router;
