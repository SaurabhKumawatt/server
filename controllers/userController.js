// File: controllers/userController.js
const User = require("../models/User");
const Course = require("../models/Course");
const UserKyc = require("../models/UserKyc");
const Leads = require("../models/Leads");
const Commissions = require("../models/Commissions");
const Payout = require("../models/Payout");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ✅ Register User
exports.registerUser = async (req, res) => {
  try {
    const {
      fullName, username, email, mobileNumber,
      password, sponsorCode, address, state, dob,
    } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email or username already exists" });
    }

    const affiliateCode = `SV${Date.now().toString().slice(-6)}`;
    const newUser = await User.create({
      fullName, username, email, mobileNumber, password,
      sponsorCode, affiliateCode, address, state, dob,
    });

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
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "None",
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
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "None",
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
    if (req.file) {
      const user = await User.findById(req.user._id);
      if (user.profileImage) {
        const oldPath = path.join(__dirname, "..", "uploads", "profile", path.basename(user.profileImage));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updates.profileImage = `/uploads/profile/${req.file.filename}`;
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
    const user = await User.findById(req.user._id);

    if (!(await user.matchPassword(oldPassword))) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
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