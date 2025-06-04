// const express = require("express");
// const multer = require("multer");
// const storage = multer.memoryStorage();
// const upload = multer({ storage });
// const { registerUser, loginUser, getMe, getAllCourses } = require("../controllers/authController");
// const { protect } = require("../middleware/authMiddleware");
// const { registerManualUser } = require("../controllers/authController");
// const { getMyCourses } = require("../controllers/userController");
// const { getPlaylistVideos,  getCourseBySlug } = require("../controllers/courseController");

// const router = express.Router();

// router.post("/signup/:slug", registerUser);
// router.post("/login", loginUser);
// router.get("/me", protect, getMe); // test token
// router.post("/manual-signup", upload.single("screenshot"), registerManualUser);
// router.get("/my-courses", protect, getMyCourses, getAllCourses);
// router.get("/:id/playlist", protect, getPlaylistVideos);
// router.get("/:slug", protect, getCourseBySlug);
// // router.get("/all", getAllCourses);

// module.exports = router;
