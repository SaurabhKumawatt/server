// File: controllers/courseController.js
const Course = require("../models/Course");

// Public: Get all published courses
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({ status: "published" }).populate("instructor", "fullName");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// Public: Get course by slug
exports.getCourseBySlug = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug }).populate("instructor");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch course" });
  }
};

// Admin/Instructor: Create new course
exports.createCourse = async (req, res) => {
  try {
    const { title, slug, category, price } = req.body;
    const course = await Course.create({ ...req.body, instructor: req.user._id });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: "Failed to create course" });
  }
};

// Admin/Instructor: Update course details
exports.updateCourse = async (req, res) => {
  try {
    const updated = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update course" });
  }
};

// Admin: Delete course
exports.deleteCourse = async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete course" });
  }
};

// Admin/Instructor: Publish course
exports.publishCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: "published" },
      { new: true }
    );
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to publish course" });
  }
};

// Add Module to Course
exports.addModuleToCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    course.modules.push(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: "Failed to add module" });
  }
};

// Update Module
exports.updateModule = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    const module = course.modules.id(req.params.moduleId);
    Object.assign(module, req.body);
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: "Failed to update module" });
  }
};

// Delete Module
exports.deleteModule = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    course.modules.id(req.params.moduleId).remove();
    await course.save();
    res.json({ message: "Module removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete module" });
  }
};

// Add Lesson to Module
exports.addLessonToModule = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    const module = course.modules.id(req.params.moduleId);
    module.lessons.push(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: "Failed to add lesson" });
  }
};

// Update Lesson
exports.updateLesson = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    const module = course.modules.id(req.params.moduleId);
    const lesson = module.lessons.id(req.params.lessonId);
    Object.assign(lesson, req.body);
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: "Failed to update lesson" });
  }
};

// Delete Lesson
exports.deleteLesson = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    const module = course.modules.id(req.params.moduleId);
    module.lessons.id(req.params.lessonId).remove();
    await course.save();
    res.json({ message: "Lesson removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete lesson" });
  }
};
