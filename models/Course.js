const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");

const sanitize = (value) =>
  sanitizeHtml(value || "", {
    allowedTags: [],
    allowedAttributes: {},
  });

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      set: sanitize,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      set: sanitize,
    },
    description: {
      type: String,
      set: sanitize,
    },
    thumbnail1: {
      type: String,
    },
    thumbnail2: {
      type: String,
    },
    points: [
      {
        heading: {
          type: String,
          set: sanitize,
        },
        description: {
          type: String,
          set: sanitize,
        },
      },
    ],
    category: {
      type: String,
      required: true,
      set: sanitize,
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
    modules: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true,
        },
        title: {
          type: String,
          required: true,
          set: sanitize,
        },
        description: {
          type: String,
          default: null,
          set: sanitize,
        },
        position: {
          type: Number,
          required: true,
          min: 0,
        },
        lessons: [
          {
            _id: {
              type: mongoose.Schema.Types.ObjectId,
              auto: true,
            },
            title: {
              type: String,
              required: true,
              set: sanitize,
            },
            videoUrl: {
              type: String,
              default: null,
            },
            videoThumbnailUrl: {
              type: String,
              default: null,
            },
            content: {
              type: String,
              default: null,
              set: sanitize,
            },
            duration: {
              type: Number,
              min: 0,
              default: 0,
            },
            description: {
              type: String,
              default: null,
              set: sanitize,
            },
            isFreePreview: {
              type: Boolean,
              default: false,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    affiliateCommissionPercent: {
      type: mongoose.Schema.Types.Decimal128,
      default: 20.0,
    },
    tags: [
      {
        type: String,
        set: sanitize,
      },
    ],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    learnersEnrolled: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    youtubePlaylistId: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
