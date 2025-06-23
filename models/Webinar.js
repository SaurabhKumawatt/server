const mongoose = require("mongoose");
const validator = require("validator");

const webinarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Webinar title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    date: {
      type: Date,
      required: [true, "Webinar date is required"],
      validate: {
        validator: (v) => v instanceof Date && v.toString() !== "Invalid Date",
        message: "Invalid date format",
      },
    },

    time: {
      type: String,
      required: [true, "Time is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i.test(v);
        },
        message: "Time must be in HH:MM AM/PM format",
      },
    },

    thumbnail: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || validator.isURL(v);
        },
        message: "Thumbnail must be a valid URL",
      },
    },

    zoomLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || validator.isURL(v);
        },
        message: "Zoom link must be a valid URL",
      },
    },

    youtubeLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || validator.isURL(v);
        },
        message: "YouTube link must be a valid URL",
      },
    },

    status: {
      type: String,
      enum: {
        values: ["upcoming", "completed"],
        message: "Status must be either 'upcoming' or 'completed'",
      },
      default: "upcoming",
    },
  },
  { timestamps: true }
);

// Index for date to speed up calendar queries
webinarSchema.index({ date: 1 });

module.exports = mongoose.model("Webinar", webinarSchema);
