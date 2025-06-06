const express = require("express");
const router = express.Router();

const { uploadTo } = require("../middleware/multerMiddleware");
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const Course = require("../models/Course");

const {
  getAllCourses,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  addModuleToCourse,
  updateModule,
  deleteModule,
  addLessonToModule,
  updateLesson,
  deleteLesson,
} = require("../controllers/courseController");


// ==============================
// 🔧 Dev Test Ping
// ==============================
router.get("/ping", (req, res) => {
  res.send("👋 Course Routes Working");
});


// ==============================
// 📖 Public Access
// ==============================
router.get("/", getAllCourses);
router.get("/:slug", getCourseBySlug);


// ==============================
// 🔐 Admin/Instructor - Course CRUD
// ==============================
router.post("/", protect, authorizeRoles("admin", "instructor"), createCourse);
router.put("/:id", protect, authorizeRoles("admin", "instructor"), updateCourse);
router.delete("/:id", protect, authorizeRoles("admin"), deleteCourse);
router.put("/:id/publish", protect, authorizeRoles("admin", "instructor"), publishCourse);


// ==============================
// 📦 Modules
// ==============================
router.post("/:courseId/modules", protect, authorizeRoles("admin", "instructor"), addModuleToCourse);
router.put("/:courseId/modules/:moduleId", protect, authorizeRoles("admin", "instructor"), updateModule);
router.delete("/:courseId/modules/:moduleId", protect, authorizeRoles("admin", "instructor"), deleteModule);


// ==============================
// 🎬 Lessons
// ==============================
router.post(
  "/:courseId/modules/:moduleId/lessons",
  protect,
  authorizeRoles("admin", "instructor"),
  addLessonToModule
);

router.put(
  "/:courseId/modules/:moduleId/lessons/:lessonId",
  protect,
  authorizeRoles("admin", "instructor"),
  updateLesson
);

router.delete(
  "/:courseId/modules/:moduleId/lessons/:lessonId",
  protect,
  authorizeRoles("admin", "instructor"),
  deleteLesson
);


// ==============================
// 🖼 Thumbnail Upload
// ==============================
// ✅ Upload thumbnail1 image
router.put(
  "/:id/thumbnail1",
  protect,
  authorizeRoles("admin", "instructor"),
  uploadTo("course-thumbnails").single("thumbnail1"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { thumbnail1: `/uploads/course-thumbnails/${req.file.filename}` },
      { new: true }
    );

    res.json({ message: "Thumbnail1 updated", thumbnail1: course.thumbnail1 });
  }
);

module.exports = router;
