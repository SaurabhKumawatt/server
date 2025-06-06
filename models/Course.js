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
    thumbnail1: {
      type: String,
    },
    thumbnail2: {
      type: String,
    },
    points: [
      {
        heading: { type: String, required: false },
        description: { type: String, required: false }
      }
    ],
    category: {
      type: String,
      required: true,
    },
    isBundle: {
      type: Boolean,
      default: false,
    },
    relatedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ], 
    relatedBundleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    modules: [{
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true
      },
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        default: null
      },
      position: {
        type: Number,
        required: true,
        min: 0
      },

      lessons: [{
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true
        },
        title: {
          type: String,
          required: true
        },
        videoUrl: {
          type: String,
          default: null
        },
        videoThumbnailUrl: {
          type: String,
          default: null
        },
        content: {
          type: String,
          default: null
        },
        duration: {
          type: Number,
          min: 0,
          default: 0
        },
        description: {
          type: String,
          default: null
        },
        isFreePreview: {
          type: Boolean,
          default: false
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    price: {
      type: Number,
      required: true,
    },
    discountedPrice: {
      type: Number,
    },
    affiliateCommissionPercent: {
      type: Number,
      default: 20,
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

    // 🔽 New Field for YouTube Playlist
    youtubePlaylistId: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
