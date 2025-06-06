const Course = require("../models/Course");

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
    const course = await Course.findOne({ slug: req.params.slug }).populate("instructor");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    console.error("Error fetching course by slug:", err);
    res.status(500).json({ message: "Failed to fetch course" });
  }
};

// ✅ Create new course
exports.createCourse = async (req, res) => {
  try {
    const course = await Course.create({ ...req.body, instructor: req.user._id });
    res.status(201).json(course);
  } catch (err) {
    console.error("Create course error:", err);
    res.status(400).json({ message: "Failed to create course" });
  }
};

// ✅ Update course
exports.updateCourse = async (req, res) => {
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
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: "published" },
      { new: true }
    );
    res.json(course);
  } catch (err) {
    console.error("Publish course error:", err);
    res.status(500).json({ message: "Failed to publish course" });
  }
};
// ✅ Add Module
exports.addModuleToCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    course.modules.push(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error("Add module error:", err);
    res.status(400).json({ message: "Failed to add module" });
  }
};

// ✅ Update Module
exports.updateModule = async (req, res) => {
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
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    module.lessons.push(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    console.error("Add lesson error:", err);
    res.status(400).json({ message: "Failed to add lesson" });
  }
};

// ✅ Update Lesson
exports.updateLesson = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const lesson = module.lessons.id(req.params.lessonId);
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
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const module = course.modules.id(req.params.moduleId);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const lesson = module.lessons.id(req.params.lessonId);
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
  try {
    const { relatedBundleIds } = req.body;

    if (!Array.isArray(relatedBundleIds)) {
      return res.status(400).json({ message: "relatedBundleIds must be an array of ObjectIds" });
    }

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
