const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    category: {
      type: String,
      required: true,
    },
    isBundle: {
      type: Boolean,
      default: false,
    },
    includedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    modules: [
      {
        title: String,
        contentType: {
          type: String,
          enum: ["video", "pdf", "quiz"],
          default: "video",
        },
        contentUrl: String,
        duration: String, // e.g. "10min"
        isLocked: {
          type: Boolean,
          default: false,
        },
      },
    ],
    price: {
      type: Number,
      required: true,
    },
    discountedPrice: {
      type: Number,
    },
    affiliateCommissionPercent: {
      type: Number,
      default: 20, // for affiliates
    },
    tags: [String],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    learnersEnrolled: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
