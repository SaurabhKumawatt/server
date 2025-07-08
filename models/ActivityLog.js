// 📁 models/ActivityLog.js
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ipAddress: String,
    userAgent: String,
    device: String,
    os: String,
    browser: String,
    location: {
      country: String,
      region: String,
      city: String,
    },
    endpoint: String,
    method: String,
    status: String,
    note: String,
  },
  { timestamps: true }
);

activityLogSchema.index({ userId: 1, endpoint: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
