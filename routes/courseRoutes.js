const express = require("express");
const router = express.Router();

const { body } = require("express-validator");
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
router.post(
  "/",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("slug").optional().isSlug().withMessage("Invalid slug format"),
    body("category").notEmpty().withMessage("Category is required"),
    body("price").isNumeric().withMessage("Price must be a number"),
    body("description").optional().isString(),
    body("discountedPrice").optional().isNumeric(),
    body("affiliateCommissionPercent").optional().isNumeric(),
  ],
  createCourse
);

router.put(
  "/:id",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").optional().isString().withMessage("Title must be a string"),
    body("slug").optional().isSlug().withMessage("Invalid slug format"),
    body("description").optional().isString(),
    body("category").optional().isString(),
    body("price").optional().isNumeric().withMessage("Price must be a number"),
    body("discountedPrice").optional().isNumeric(),
    body("affiliateCommissionPercent").optional().isNumeric(),
    body("tags").optional().isArray(),
  ],
  updateCourse
);

router.delete(
  "/:id",
  protect,
  authorizeRoles("admin"),
  deleteCourse
);
router.put(
  "/:id/publish",
  protect,
  authorizeRoles("admin", "instructor"),
  publishCourse
);

router.get("/:slug", protect, getProtectedCourseBySlug);
router.post("/enroll-related-courses", protect, authorizeRoles("admin", "instructor"), enrollRelatedCoursesForUser);



// ==============================
// 📦 Modules
// ==============================
router.post(
  "/:courseId/modules",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").notEmpty().withMessage("Module title is required"),
    body("description").optional().isString(),
    body("position")
      .isInt({ min: 0 })
      .withMessage("Module position must be a non-negative integer"),
  ],
  addModuleToCourse
);
router.put(
  "/:courseId/modules/:moduleId",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").optional().isString().withMessage("Title must be a string"),
    body("description").optional().isString(),
    body("position").optional().isInt({ min: 0 }).withMessage("Position must be a non-negative number"),
  ],
  updateModule
);
router.delete(
  "/:courseId/modules/:moduleId",
  protect,
  authorizeRoles("admin", "instructor"),
  deleteModule
);



// ==============================
// 🎬 Lessons
// ==============================
router.post(
  "/:courseId/modules/:moduleId/lessons",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").notEmpty().withMessage("Lesson title is required"),
    body("content").optional().isString(),
    body("description").optional().isString(),
    body("duration").optional().isNumeric().withMessage("Duration must be a number"),
    body("isFreePreview").optional().isBoolean(),
    body("videoUrl").optional().isString(),
    body("videoThumbnailUrl").optional().isString(),
  ],
  addLessonToModule
);
router.put(
  "/:courseId/modules/:moduleId/lessons/:lessonId",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("title").optional().isString(),
    body("content").optional().isString(),
    body("description").optional().isString(),
    body("duration").optional().isNumeric().withMessage("Duration must be a number"),
    body("isFreePreview").optional().isBoolean(),
    body("videoUrl").optional().isString(),
    body("videoThumbnailUrl").optional().isString(),
  ],
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
  authorizeRoles("admin", "instructor"),
  [
    body("relatedBundleIds")
      .isArray({ min: 0 })
      .withMessage("relatedBundleIds must be an array")
      .custom((arr) => arr.every(id => mongoose.Types.ObjectId.isValid(id)))
      .withMessage("Each relatedBundleId must be a valid ObjectId"),
  ],
  updateRelatedBundles
);

router.patch(
  "/:id/related-courses",
  protect,
  authorizeRoles("admin", "instructor"),
  [
    body("relatedCourses")
      .isArray({ min: 0 })
      .withMessage("relatedCourses must be an array"),
    body("relatedCourses.*")
      .custom(id => mongoose.Types.ObjectId.isValid(id))
      .withMessage("Each relatedCourse must be a valid ObjectId"),
  ],
  updateRelatedCourses
);
router.delete(
  "/:id/related-courses/:courseIdToRemove",
  protect,
  authorizeRoles("admin", "instructor"),
  removeRelatedCourse
);





module.exports = router;