const axios = require("axios");
const Course = require("../models/Course");

// GET /api/courses/:slug
const getCourseBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ slug: slug.toLowerCase() });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json(course);
  } catch (error) {
    console.error("❌ Error fetching course:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/courses/:id/playlist
const getPlaylistVideos = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId);
    if (!course || !course.youtubePlaylistId) {
      return res.status(404).json({ message: "Playlist not found for this course" });
    }

    const playlistId = course.youtubePlaylistId;
    const apiKey = process.env.YT_API_KEY;

    const response = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
      params: {
        part: "snippet",
        maxResults: 50,
        playlistId,
        key: apiKey,
      },
    });

    const videos = response.data.items.map((item) => ({
      title: item.snippet.title,
      videoId: item.snippet.resourceId.videoId,
      thumbnail: item.snippet.thumbnails.medium.url,
    }));

    res.json(videos);
  } catch (err) {
    console.error("❌ Error fetching playlist:", err.message);
    res.status(500).json({ message: "Error fetching playlist" });
  }
};


module.exports = { getCourseBySlug, getPlaylistVideos };
