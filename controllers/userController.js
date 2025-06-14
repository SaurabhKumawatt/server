// File: controllers/userController.js
const User = require("../models/User");
const Course = require("../models/Course");
const UserKyc = require("../models/UserKyc");
const Leads = require("../models/Leads");
const Commissions = require("../models/Commissions");
const Training = require("../models/Training");
const Payout = require("../models/Payout");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { sendWelcomeEmail } = require("../utils/email");
const { sendOtpEmail } = require("../utils/email");
const { validationResult } = require("express-validator");
const { Types } = require("mongoose");


// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ✅ Register User
exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  try {
    const {
      fullName, username, email, mobileNumber,
      password, sponsorCode, address, state, dob,
    } = req.body;

    const existingUser = await User.findOne({
      $or: [
        { email },
        { username },
        { mobileNumber }
      ]
    });
    if (existingUser) {
      return res.status(400).json({
        message: "Email, mobile number or username already exists"
      });
    }


    const lastUser = await User.findOne({ affiliateCode: { $regex: /^SV\d+$/ } })
      .sort({ createdAt: -1 })
      .lean();

    let nextCodeNumber = 1001;
    if (lastUser && lastUser.affiliateCode) {
      const numPart = parseInt(lastUser.affiliateCode.replace("SV", ""));
      if (!isNaN(numPart)) {
        nextCodeNumber = numPart + 1;
      }
    }
    const affiliateCode = `SV${nextCodeNumber}`;
    let newUser;
    try {
      newUser = await User.create({
        fullName, username, email, mobileNumber, password,
        sponsorCode, affiliateCode, address, state, dob,
      });
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ message: `${field} already exists` });
      }
      throw err;
    }

    // 📧 Send welcome mail
    try {
      await sendWelcomeEmail({
        to: newUser.email,
        name: newUser.fullName
      });
    } catch (mailErr) {
      console.error("📭 Failed to send welcome email:", mailErr.message);
    }

    // ➕ Create lead if sponsor is valid
    if (sponsorCode) {
      const referrer = await User.findOne({ affiliateCode: sponsorCode });
      if (referrer) {
        await Leads.create({
          referralId: referrer._id,
          leadUserId: newUser._id,
          name: newUser.fullName,
          email: newUser.email,
          mobile: newUser.mobileNumber,
          bundleCourseId: null,
        });
      }
    }

    const token = generateToken(newUser._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,                       // 🔁 false for localhost
      sameSite: isProduction ? "None" : "Lax",    // 🔁 Lax for localhost
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "Registered successfully. Please complete your enrollment.",
      user: {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        mobileNumber: newUser.mobileNumber,
        sponsorCode: newUser.sponsorCode,
        affiliateCode: newUser.affiliateCode,
      },
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,                       // 🔁 false for localhost
      sameSite: isProduction ? "None" : "Lax",    // 🔁 Lax for localhost
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful", user });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Logout
exports.logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "None",
    secure: process.env.NODE_ENV === "development",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// ✅ Get Profile
exports.getLoggedInUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").populate("enrolledCourses.course", "title price");
    let sponsor = null;

    if (user.sponsorCode) {
      sponsor = await User.findOne({ affiliateCode: user.sponsorCode }).select("fullName");
    }

    res.json({ ...user.toObject(), sponsorName: sponsor?.fullName || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

// ✅ Update Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const updates = req.body;
    if (req.file && req.file.path) {
      updates.profileImage = req.file.path; // Cloudinary returns full URL here
    }


    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Change Password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new passwords are required." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (!Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!(await user.matchPassword(oldPassword))) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ message: "Old and new password cannot be the same" });
    }

    user.password = newPassword;
    await user.save();

    console.log(`[SECURITY] Password changed for user: ${user.email} at ${new Date().toISOString()}`);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Password change error:", err.message);
    res.status(400).json({ message: "Password change failed" });
  }
};

// ✅ Get KYC Status
exports.getKycStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const kyc = await UserKyc.findOne({ userId: req.user._id }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      status: user.kycStatus || "not-submitted",
      reason: user.kycReason || null,
      kyc: kyc || null,
    });
  } catch (err) {
    console.error("❌ Error fetching KYC status:", err);
    res.status(500).json({ message: "Server error while fetching KYC" });
  }
};



// ✅ Submit KYC
exports.submitKycDetails = async (req, res) => {
  try {
    const existing = await UserKyc.findOne({ userId: req.user._id });
    if (existing) return res.status(400).json({ message: "KYC already submitted" });

    const kyc = await UserKyc.create({
      userId: req.user._id,
      ...req.body,
      aadhaarFrontImage: req.files?.aadhaarFrontImage?.[0]?.path,
      aadhaarBackImage: req.files?.aadhaarBackImage?.[0]?.path,
      panProofImage: req.files?.panProofImage?.[0]?.path,
    });

    res.status(201).json({ message: "KYC submitted successfully", kyc });
  } catch (err) {
    console.error("❌ KYC submission error:", err);
    res.status(400).json({ message: err.message });
  }
};

// ✅ Get Leads
exports.getAffiliateLeads = async (req, res) => {
  try {
    const leads = await Leads.find({ referralId: req.user._id, status: "new" })
      .populate("leadUserId", "fullName mobileNumber affiliateCode profileImage")
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leads" });
  }
};

// ✅ Delete Lead
exports.deleteLeadById = async (req, res) => {
  try {
    const lead = await Leads.findOneAndDelete({
      _id: req.params.id,
      referralId: req.user._id,
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found or unauthorized" });
    }

    res.json({ message: "Lead deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get Commissions
exports.getAffiliateCommissions = async (req, res) => {
  try {
    const commissions = await Commissions.find({ userId: req.user._id })
      .populate("referralUser", "fullName profileImage mobileNumber affiliateCode")
      .populate("bundleCourseId", "title")
      .sort({ createdAt: -1 });

    res.json(commissions);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Request Payout
exports.requestPayout = async (req, res) => {
  try {
    const { amount, commissionId } = req.body;
    const payout = await Payout.create({
      userId: req.user._id,
      amount,
      commissionId,
    });

    res.status(201).json({ message: "Payout requested", payout });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Get Industry Earnings
exports.getIndustryEarnings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("industryEarnings");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.industryEarnings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update Industry Earnings (Admin only)
exports.updateIndustryEarnings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { industryEarnings } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.industryEarnings = industryEarnings;
    await user.save();

    res.status(200).json({ message: "Industry earnings updated", industryEarnings });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getSalesStats = async (req, res) => {
  try {
    const filterType = req.query.type || "daily";
    const user = await User.findById(req.user._id);
    const commissions = await Commissions.find({ userId: req.user._id }).populate("bundleCourseId");

    const pieMap = {};
    const barMap = {};

    commissions.forEach(c => {
      const created = new Date(c.createdAt);
      let label;

      if (filterType === "daily") {
        label = created.toLocaleDateString("en-IN");
      } else if (filterType === "weekly") {
        const week = new Date(created);
        week.setDate(created.getDate() - created.getDay());
        label = `Week of ${week.toLocaleDateString("en-IN")}`;
      } else if (filterType === "monthly") {
        label = created.toLocaleString("default", { month: "short", year: "numeric" });
      }

      const courseName = c.bundleCourseId?.title || "Other";
      pieMap[courseName] = (pieMap[courseName] || 0) + 1;
      barMap[label] = (barMap[label] || 0) + c.amount;
    });

    // Create last 7 date/week/month labels
    let barData = [];
    const today = new Date();

    if (filterType === "daily") {
      for (let i = 6; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const label = day.toLocaleDateString("en-IN");
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    }

    if (filterType === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const week = new Date(today);
        week.setDate(today.getDate() - i * 7);
        const label = `Week of ${week.toLocaleDateString("en-IN")}`;
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    }

    if (filterType === "monthly") {
      for (let i = 6; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const label = month.toLocaleString("default", { month: "short", year: "numeric" });
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    }

    const pieData = Object.entries(pieMap).map(([name, value]) => ({ name, value }));
    res.json({ pieData, barData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate sales stats" });
  }
};



exports.getTopIncomeLeads = async (req, res) => {
  try {
    // 1. Find users referred by current user
    const referredUsers = await User.find({ sponsorCode: req.user.affiliateCode });
    const referredIds = referredUsers.map(u => u._id);

    // 2. Aggregate commissions earned by each referred user
    const earnings = await Commissions.aggregate([
      { $match: { user: { $in: referredIds } } },
      { $group: { _id: "$user", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          name: "$userInfo.fullName",
          profileImage: "$userInfo.profileImage",
          total: 1
        }
      }
    ]);

    res.status(200).json(earnings);
  } catch (error) {
    console.error("Top income leads error:", error);
    res.status(500).json({ message: "Server error while fetching top income leads" });
  }
};

// admin
// userController.js ke loginUser method me thoda change:
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Not an admin" });
    }

    const token = generateToken(user._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Admin login successful", user });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /api/user/payouts
exports.getUserPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(payouts);
  } catch (error) {
    console.error("❌ getUserPayouts error:", error);
    res.status(500).json({ message: "Failed to fetch payouts" });
  }
};

// GET /api/user/commission-summary
exports.getCommissionSummary = async (req, res) => {
  try {
    const [paid, unpaid, pending, processing] = await Promise.all([
      Commissions.aggregate([
        { $match: { userId: req.user._id, status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Commissions.aggregate([
        { $match: { userId: req.user._id, status: "unpaid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Commissions.aggregate([
        { $match: { userId: req.user._id, status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Commissions.aggregate([
        { $match: { userId: req.user._id, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    res.status(200).json({
      paid: paid[0]?.total || 0,
      unpaid: unpaid[0]?.total || 0,
      pending: pending[0]?.total || 0,
      processing: processing[0]?.total || 0,

    });
  } catch (error) {
    console.error("❌ getCommissionSummary error:", error);
    res.status(500).json({ message: "Failed to fetch commission summary" });
  }
};

// GET /api/user/leaderboard?type=daily|weekly|monthly|all
exports.getLeaderboard = async (req, res) => {
  try {
    const type = req.query.type || "all";

    let dateFilter = {};
    const now = new Date();

    if (type === "daily") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter.createdAt = { $gte: startOfDay };
    } else if (type === "weekly") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      dateFilter.createdAt = { $gte: sevenDaysAgo };
    } else if (type === "monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: startOfMonth };
    }

    const leaderboard = await Commissions.aggregate([
      {
        $match: type === "all" ? {} : dateFilter,
      },
      {
        $group: {
          _id: "$userId",
          totalEarnings: { $sum: "$amount" },
        },
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          fullName: "$user.fullName",
          profileImage: "$user.profileImage",
          totalEarnings: 1,
        },
      },
    ]);

    res.status(200).json(leaderboard);
  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};

//Forgot Password 
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found with this email" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: otpCode,
      expiresAt: otpExpiry,
    };

    await user.save();

    await sendOtpEmail({ to: email, otp: otpCode, name: user.fullName });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(" Error in forgotPassword:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
// OTP Verification 
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.otp || user.otp.code !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Mark OTP as used or clear it
    user.otp = undefined;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error(" Error in verifyOtp:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });


    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Error in resetPassword:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getAllPublishedTrainings = async (req, res) => {
  try {
    const trainings = await Training.find({ status: "published" })
      .select("title slug thumbnail type")
      .sort({ createdAt: -1 });

    res.status(200).json(trainings);
  } catch (err) {
    console.error("❌ Error fetching trainings:", err);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};