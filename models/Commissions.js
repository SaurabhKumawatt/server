const mongoose = require("mongoose");

const commissionsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    referralUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    amount: {
      type: Number,
      required: [true, "Commission amount is required"],
      min: [0, "Amount must be at least 0"],
    },

    bundleCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "unpaid", "paid"],
      default: "pending",
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Transaction ID is required"],
    },

    paymentSuccess: {
      type: Boolean,
      default: true,
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

// 🔐 Prevent duplicate commission for same user+payment
commissionsSchema.index({ userId: 1, transactionId: 1 }, { unique: true });

module.exports = mongoose.model("Commissions", commissionsSchema);
