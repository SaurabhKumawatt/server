const Training = require("../models/Training");
const axios = require("axios");

exports.getTrainingPlayer = async (req, res) => {
  try {
    const slug = req.params.slug;
    const training = await Training.findOne({ slug });

    if (!training) {
      return res.status(404).json({ message: "Training not found" });
    }

    res.json(training);
  } catch (err) {
    console.error("❌ Error fetching training:", err);
    res.status(500).json({ message: "Server error while fetching training" });
  }
};

exports.getTrainingPlaylistVideos = async (req, res) => {
  try {
    const { id } = req.params;

    const training = await Training.findOne({ youtubePlaylistId: id });
    if (!training)
      return res.status(404).json({ message: "Training not found" });

    const apiKey = process.env.YT_API_KEY;
    const playlistId = training.youtubePlaylistId;

    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/playlistItems`,
      {
        params: {
          part: "snippet",
          maxResults: 50,
          playlistId,
          key: apiKey,
        },
      }
    );

    const videos = response.data.items.map((item) => ({
  videoId: item.snippet.resourceId.videoId,
  title: item.snippet.title,
  thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "", // fallback
}));
    res.status(200).json(videos);
  } catch (err) {
    console.error("❌ Error fetching playlist:", err.message);
    res.status(500).json({ message: "Failed to fetch playlist videos" });
  }
};

exports.getTrainingBySlug = async (req, res) => {
  try {
    const training = await Training.findOne({ slug: req.params.slug });
    if (!training) return res.status(404).json({ message: "Training not found" });

    res.json(training);
  } catch (err) {
    console.error("❌ Error fetching training by slug:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateTrainingThumbnail = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Thumbnail upload failed" });
    }

    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { thumbnail: req.file.path },
      { new: true }
    );

    if (!training) {
      return res.status(404).json({ message: "Training not found" });
    }

    res.json({ message: "Thumbnail updated successfully", thumbnail: training.thumbnail });
  } catch (err) {
    console.error("Thumbnail update error:", err);
    res.status(500).json({ message: "Failed to update thumbnail" });
  }
};