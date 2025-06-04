// File: controllers/enrollmentController.js
const Enrollment = require("../models/Enrollments");
const Course = require("../models/Course");
const User = require("../models/User");
const Payment = require("../models/Payment");

// ✅ User: Get all enrolled courses
exports.getUserEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user._id })
      .populate("courseId")
      .sort({ createdAt: -1 });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch enrollments" });
  }
};

// ✅ User: Update progress in a course
exports.updateCourseProgress = async (req, res) => {
  const { courseId, progress } = req.body;
  try {
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId,
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    enrollment.progress = progress;
    await enrollment.save();
    res.json({ message: "Progress updated", enrollment });
  } catch (err) {
    res.status(400).json({ message: "Failed to update progress" });
  }
};

// 🔐 Admin: Get all enrollments
exports.getAllEnrollments = async (req, res) => {
  try {
    const all = await Enrollment.find()
      .populate("userId courseId")
      .sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    res.status(500).json({ message: "Error fetching enrollments" });
  }
};

// 🔐 Admin: Get specific enrollment
exports.getEnrollmentDetails = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate("userId courseId");
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve enrollment" });
  }
};

// 🔐 Admin: Update status of enrollment
exports.updateEnrollmentStatus = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    enrollment.status = req.body.status;
    await enrollment.save();

    res.json({ message: "Status updated", enrollment });
  } catch (err) {
    res.status(400).json({ message: "Failed to update status" });
  }
};

// ✅ Enroll via email
exports.manualEnrollUserWithPayment = async (req, res) => {
  try {
    const { email, courseId, paymentDetails } = req.body;

    const user = await User.findOne({ email });
    const mainCourse = await Course.findById(courseId);
    if (!user || !mainCourse) return res.status(404).json({ message: "User or course not found" });

    const already = await Enrollment.findOne({ userId: user._id, courseId });
    if (already) return res.status(400).json({ message: "Already enrolled in selected bundle" });

    // 1. Enroll in selected bundle
    const payment = await Payment.create({
      user: user._id,
      course: courseId,
      forBundleCourseId: courseId,
      amountPaid: paymentDetails.amountPaid || 0,
      razorpayOrderId: `manual_${Date.now()}`,
      razorpayPaymentId: paymentDetails.razorpayPaymentId || null,
      status: paymentDetails.status || "captured",
      paidAt: paymentDetails.paidAt || new Date(),
      remarks: paymentDetails.remarks || "Manual entry",
    });

    await Enrollment.create({
      userId: user._id,
      courseId,
      paymentId: payment._id,
      status: "active",
    });

    await User.findByIdAndUpdate(user._id, {
      $push: {
        enrolledCourses: {
          course: courseId,
          progress: 0,
        },
      },
    });

    // 2. Auto-enroll in all lower-priced bundles
    const lowerBundles = await Course.find({
      isBundle: true,
      price: { $lt: mainCourse.price },
    });

    for (const bundle of lowerBundles) {
      const alreadyIn = await Enrollment.findOne({
        userId: user._id,
        courseId: bundle._id,
      });
      if (alreadyIn) continue;

      const dummyPayment = await Payment.create({
        user: user._id,
        course: bundle._id,
        forBundleCourseId: courseId, // parent bundle
        amountPaid: 0,
        razorpayOrderId: `auto_${Date.now()}_${bundle._id}`,
        status: "captured",
        paidAt: new Date(),
        remarks: `Auto-enrolled via ${mainCourse.title}`,
      });

      await Enrollment.create({
        userId: user._id,
        courseId: bundle._id,
        paymentId: dummyPayment._id,
        status: "active",
      });

      await User.findByIdAndUpdate(user._id, {
        $push: {
          enrolledCourses: {
            course: bundle._id,
            progress: 0,
          },
        },
      });
    }

    res.status(201).json({
      message: `Enrolled in ${mainCourse.title} + ${lowerBundles.length} lower bundles`,
    });
  } catch (err) {
    console.error("Manual enroll error:", err);
    res.status(500).json({ message: "Manual enrollment failed" });
  }
};

// ✅ Unenroll via email
exports.manualUnenrollUser = async (req, res) => {
  try {
    const { email, courseId } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const enrollment = await Enrollment.findOneAndDelete({ userId: user._id, courseId });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    await User.findByIdAndUpdate(user._id, {
      $pull: {
        enrolledCourses: { course: courseId },
      },
    });

    res.status(200).json({ message: "Unenrolled successfully" });
  } catch (err) {
    console.error("Unenroll error:", err);
    res.status(500).json({ message: "Failed to unenroll" });
  }
};
