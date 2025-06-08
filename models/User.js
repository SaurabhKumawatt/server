const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [3, "Full name must be at least 3 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      match: [/^[a-zA-Z0-9_.-]*$/, "Username contains invalid characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Email is invalid"],
    },
    mobileNumber: {
      type: String,
      unique: true,
      required: [true, "Mobile number is required"],
      match: [/^[6-9]\d{9}$/, "Mobile number must be 10 digits starting with 6-9"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    profileImage: {
      type: String,
      default: "",
    },
    dob: {
      type: Date,
      default: null,
      validate: {
        validator: function (date) {
          return !date || date < new Date();
        },
        message: "Date of Birth cannot be in the future",
      },
    },
    role: {
      type: String,
      enum: ["unpaid-affiliate", "paid-affiliate", "admin", "instructor"],
      default: "unpaid-affiliate",
      required: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
    },
    state: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    affiliateCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    sponsorCode: {
      type: String,
      default: null,
    },
    referralClicks: {
      type: Number,
      default: 0,
      min: [0, "Referral clicks cannot be negative"],
    },
    referralConversions: {
      type: Number,
      default: 0,
      min: [0, "Referral conversions cannot be negative"],
    },
    referralEarnings: {
      type: Number,
      default: 0,
      min: [0, "Referral earnings cannot be negative"],
    },
    referralCommissionPercent: {
      type: Number,
      default: 80,
      min: [0, "Commission percent must be at least 0"],
      max: [100, "Commission percent cannot exceed 100"],
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    enrolledCourses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
        },
        progress: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
      },
    ],
    industryEarnings: [
      {
        label: {
          type: String,
          required: [true, "Industry label is required"],
        },
        initialAmount: {
          type: Number,
          default: 0,
          min: [0, "Initial amount cannot be negative"],
        },
        currentTotal: {
          type: Number,
          default: 0,
          min: [0, "Current total cannot be negative"],
        },
      },
    ],
  },
  { timestamps: true }
);

// 🔐 Encrypt password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔑 Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
