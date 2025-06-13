const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title can't exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    thumbnail: {
      type: String,
      required: [true, "Thumbnail URL is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["playlist", "single"],
      default: "single",
      required: true,
    },
    youtubePlaylistId: {
      type: String,
      default: null,
      trim: true,
      match: [/^[a-zA-Z0-9_-]{10,}$/, "Invalid YouTube Playlist ID"],
    },
    youtubeVideoId: {
      type: String,
      default: null,
      trim: true,
      match: [/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"],
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  { timestamps: true }
);

// Index for fast slug lookup
trainingSchema.index({ slug: 1 });

// Strict schema — block any extra fields
mongoose.set("strictQuery", true); // (if using Mongoose 7+)
trainingSchema.set("strict", true); // block extra keys at doc level

module.exports = mongoose.model("Training", trainingSchema);
