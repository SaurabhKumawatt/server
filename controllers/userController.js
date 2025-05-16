const User = require("../models/User");

exports.getMyCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("enrolledCourses.course");

    const formatted = user.enrolledCourses.map((item) => ({
      title: item.course.title,
      thumbnail: item.course.thumbnail,
      slug: item.course.slug,
      progress: item.progress,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Fetch My Courses Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
