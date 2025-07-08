const mongoose = require("mongoose");

const reelIdeaSchema = new mongoose.Schema(
  {
    overlayText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    ideaText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    tags: {
      type: [String],
      default: [],
      validate: (arr) => arr.length <= 10,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isNew: {
      type: Boolean,
      default: false,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// 📈 Index for fast fetching of latest active ideas
reelIdeaSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("ReelIdea", reelIdeaSchema);
