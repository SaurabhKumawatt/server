const mongoose = require("mongoose");

const userKycSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    accountHolderName: {
      type: String,
      required: true,
      minlength: 3,
      match: [/^[a-zA-Z\s]+$/, "Account holder name must only contain letters"],
    },

    accountNumber: {
      type: String,
      required: true,
    },

    bankName: {
      type: String,
      required: true,
      minlength: 3,
      match: [/^[a-zA-Z\s]+$/, "Bank name must contain only letters"],
    },

    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC Code"],
    },

    branch: {
      type: String,
      required: true,
      minlength: 3,
    },

    upiId: {
      type: String,
      default: null,
      required: false,
    },

    aadhaarNumber: {
      type: String,
      unique: true,
      required: true,
    },

    aadhaarFrontImage: {
      type: String,
      required: true,
    },

    aadhaarBackImage: {
      type: String,
      required: true,
    },

    panCard: {
      type: String,
      unique: true,
      required: true,
    },

    panProofImage: {
      type: String,
      required: true,
    },

    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserKyc", userKycSchema);
