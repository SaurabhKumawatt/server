const express = require("express");
const router = express.Router();

const { uploadTo } = require("../middleware/multerMiddleware");
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const Course = require("../models/Course");
const { uploadThumbnailImage } = require("../middleware/cloudinaryUpload");

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
  updateRelatedBundles,
  getPlaylistVideos,
  getProtectedCourseBySlug,
  enrollRelatedCoursesForUser,
  removeRelatedCourse,
  updateRelatedCourses
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


// loged in user
router.get("/:id/playlist", protect, getPlaylistVideos);


// ==============================
// 🔐 Admin/Instructor - Course CRUD
// ==============================
router.post("/", protect, authorizeRoles("admin", "instructor"), createCourse);
router.put("/:id", protect, authorizeRoles("admin", "instructor"), updateCourse);
router.delete("/:id", protect, authorizeRoles("admin"), deleteCourse);
router.put("/:id/publish", protect, authorizeRoles("admin", "instructor"), publishCourse);
router.get("/:slug", protect, getProtectedCourseBySlug);
router.post("/enroll-related-courses", protect, authorizeRoles("admin", "instructor"), enrollRelatedCoursesForUser);



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
  uploadThumbnailImage.single("thumbnail1"),
  async (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Upload failed" });
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { thumbnail1: req.file.path },
      { new: true }
    );

    res.json({ message: "Thumbnail1 updated", thumbnail1: course.thumbnail1 });
  }
);

router.put(
  "/:id/thumbnail2",
  protect,
  authorizeRoles("admin", "instructor"),
  uploadThumbnailImage.single("thumbnail2"),
  async (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Upload failed" });
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { thumbnail2: req.file.path },
      { new: true }
    );

    res.json({ message: "Thumbnail2 updated", thumbnail2: course.thumbnail2 });
  }
);

router.patch(
  "/:id/related-bundles",
  protect,
  authorizeRoles("admin"),
  updateRelatedBundles
);

router.patch(
  "/:id/related-courses",
  protect,
  authorizeRoles("admin", "instructor"),
  updateRelatedCourses
);

router.delete(
  "/:id/related-courses/:courseIdToRemove",
  protect,
  authorizeRoles("admin", "instructor"),
  removeRelatedCourse
);




module.exports = router;