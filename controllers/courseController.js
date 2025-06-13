const Course = require("../models/Course");
const axios = require("axios");
const { validationResult } = require("express-validator");

// ✅ Get all published courses (Public)
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({ status: "published" }).populate("instructor", "fullName");
    res.json(courses);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// ✅ Get course by slug (Public)
exports.getCourseBySlug = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate("instructor", "fullName")
      .populate("relatedCourses", "title thumbnail1");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch course" });
  }
};

// Protected version (with sub-courses)
exports.getProtectedCourseBySlug = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate("instructor", "fullName")
      .populate("relatedCourses", "title slug thumbnail1 thumbnail2 price discountedPrice");

    if (!course) return res.status(404).json({ message: "Course not found" });

    // Optional: check if user is enrolled in bundle
    const enrolled = await Enrollment.findOne({ user: req.user._id, course: course._id });
    if (!enrolled) {
      return res.status(403).json({ message: "Access denied: not enrolled in this bundle" });
    }
    
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch course" });
  }
};

// ✅ Get YouTube playlist videos for a course
exports.getPlaylistVideos = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course || !course.youtubePlaylistId) {
      return res.status(404).json({ message: "Playlist not found for this course" });
    }

    const apiKey = process.env.YT_API_KEY;
    const playlistId = course.youtubePlaylistId;
    let nextPageToken = '';
    const videos = [];

    do {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlistItems`, {
          params: {
            part: "snippet",
            playlistId,
            maxResults: 50,
            pageToken: nextPageToken,
            key: apiKey
          }
        });

      response.data.items.forEach(item => {
        const { title, thumbnails, resourceId } = item.snippet;
        videos.push({
          videoId: resourceId.videoId,
          title,
          thumbnail: thumbnails?.medium?.url || "",
        });
      });

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    res.json(videos);
  } catch (err) {
    console.error("❌ Error fetching playlist:", err.message);
    res.status(500).json({ message: "Failed to fetch playlist videos" });
  }
};

exports.enrollRelatedCoursesForUser = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    const bundle = await Course.findById(courseId).populate("relatedCourses");
    if (!bundle) return res.status(404).json({ message: "Bundle not found" });

    const related = bundle.relatedCourses || [];

    for (const sub of related) {
      const already = await Enrollment.findOne({ userId, courseId: sub._id });
      if (!already) {
        await Enrollment.create({
          userId,
          courseId: sub._id,
          status: "active",
        });

        await User.findByIdAndUpdate(userId, {
          $push: { enrolledCourses: { course: sub._id, progress: 0 } },
        });

        await Course.findByIdAndUpdate(sub._id, {
          $inc: { learnersEnrolled: 1 },
        });
      }
    }

    res.json({ message: "User enrolled in all related sub-courses" });
  } catch (err) {
    console.error("❌ Admin enroll update failed:", err);
    res.status(500).json({ message: "Failed to enroll related courses" });
  }
};


// ✅ Create new course
exports.createCourse = async (req, res) => {
  const errors = validationResult(req); // <-- added
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  try {
    const course = await Course.create({
      ...req.body,
      instructor: req.user._id,
    });
    res.status(201).json(course);
  } catch (err) {
    console.error("Create course error:", err);
    res.status(400).json({ message: "Failed to create course" });
  }
};


// ✅ Update course
exports.updateCourse = async (req, res) => {
  const errors = validationResult(req); // ✅ validate inputs
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  try {
    const updated = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (err) {
    console.error("Update course error:", err);
    res.status(400).json({ message: "Failed to update course" });
  }
};


// ✅ Delete course
exports.deleteCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    console.error("Delete course error:", err);
    res.status(500).json({ message: "Failed to delete course" });
  }
};

// ✅ Publish course
exports.publishCourse = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: "published" },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (err) {
    console.error("Publish course error:", err);
    res.status(500).json({ message: "Failed to publish course" });
  }
};

// ✅ Add Module
exports.addModuleToCourse = async (req, res) => {
  const errors = validationResult(req); // ✅ collect express-validator errors
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    course.modules.push(req.body); // safe — schema sanitizes internally
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error("Add module error:", err);
    res.status(400).json({ message: "Failed to add module" });
  }
};

// ✅ Update Module
exports.updateModule = async (req, res) => {
  const errors = validationResult(req); // ✅ express-validator check
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  if (
    !mongoose.Types.ObjectId.isValid(req.params.courseId) ||
    !mongoose.Types.ObjectId.isValid(req.params.moduleId)
  ) {
    return res.status(400).json({ message: "Invalid course or module ID" });
  }

  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    Object.assign(module, req.body);
    await course.save();
    res.json(course);
  } catch (err) {
    console.error("Update module error:", err);
    res.status(400).json({ message: "Failed to update module" });
  }
};


// ✅ Delete Module
exports.deleteModule = async (req, res) => {
  if (
    !mongoose.Types.ObjectId.isValid(req.params.courseId) ||
    !mongoose.Types.ObjectId.isValid(req.params.moduleId)
  ) {
    return res.status(400).json({ message: "Invalid course or module ID" });
  }

  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    module.remove();
    await course.save();
    res.json({ message: "Module removed" });
  } catch (err) {
    console.error("Delete module error:", err);
    res.status(500).json({ message: "Failed to delete module" });
  }
};


// ✅ Add Lesson
exports.addLessonToModule = async (req, res) => {
  const errors = validationResult(req); // ✅ express-validator
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  if (
    !mongoose.Types.ObjectId.isValid(req.params.courseId) ||
    !mongoose.Types.ObjectId.isValid(req.params.moduleId)
  ) {
    return res.status(400).json({ message: "Invalid course or module ID" });
  }

  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    module.lessons.push(req.body); // schema sanitizes internally
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error("Add lesson error:", err);
    res.status(400).json({ message: "Failed to add lesson" });
  }
};

// ✅ Update Lesson
exports.updateLesson = async (req, res) => {
  const errors = validationResult(req); // ✅ express-validator
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { courseId, moduleId, lessonId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(moduleId) ||
    !mongoose.Types.ObjectId.isValid(lessonId)
  ) {
    return res.status(400).json({ message: "Invalid course/module/lesson ID" });
  }

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const lesson = module.lessons.id(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    Object.assign(lesson, req.body);
    await course.save();
    res.json(course);
  } catch (err) {
    console.error("Update lesson error:", err);
    res.status(400).json({ message: "Failed to update lesson" });
  }
};

// ✅ Delete Lesson
exports.deleteLesson = async (req, res) => {
  const { courseId, moduleId, lessonId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(moduleId) ||
    !mongoose.Types.ObjectId.isValid(lessonId)
  ) {
    return res.status(400).json({ message: "Invalid course/module/lesson ID" });
  }

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const lesson = module.lessons.id(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    lesson.remove();
    await course.save();
    res.json({ message: "Lesson removed" });
  } catch (err) {
    console.error("Delete lesson error:", err);
    res.status(500).json({ message: "Failed to delete lesson" });
  }
};

// ✅ Admin: Update relatedBundleIds of a course
exports.updateRelatedBundles = async (req, res) => {
  const errors = validationResult(req); // express-validator errors
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const { relatedBundleIds } = req.body;

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { relatedBundleIds },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({
      message: "Related bundles updated successfully",
      relatedBundleIds: course.relatedBundleIds,
    });
  } catch (err) {
    console.error("❌ Error updating related bundles:", err);
    res.status(500).json({ message: "Failed to update related bundles" });
  }
};


// ✅ add and Remove one related course from a bundle
exports.updateRelatedCourses = async (req, res) => {
  const errors = validationResult(req); // express-validator check
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const { relatedCourses } = req.body;

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { relatedCourses },
      { new: true }
    );

    if (!course) return res.status(404).json({ message: "Course not found" });

    res.json({
      message: "Related courses updated",
      relatedCourses: course.relatedCourses,
    });
  } catch (err) {
    console.error("❌ Error updating related courses:", err);
    res.status(500).json({ message: "Failed to update related courses" });
  }
};

exports.removeRelatedCourse = async (req, res) => {
  const { id, courseIdToRemove } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(courseIdToRemove)) {
    return res.status(400).json({ message: "Invalid course ID or courseIdToRemove" });
  }

  try {
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    course.relatedCourses = course.relatedCourses.filter(
      (cid) => cid.toString() !== courseIdToRemove
    );

    await course.save();

    res.json({
      message: "✅ Related course removed",
      updatedRelatedCourses: course.relatedCourses,
    });
  } catch (err) {
    console.error("❌ Error removing related course:", err);
    res.status(500).json({ message: "Failed to remove related course" });
  }
};