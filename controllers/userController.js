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
const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");
const { encrypt } = require("../utils/encrypt");
const { decrypt } = require("../utils/encrypt");


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
    // 🧼 Sanitize + normalize inputs
    const {
      fullName, username, email, mobileNumber,
      password, sponsorCode, address, state, dob,
    } = req.body;

    const cleanData = {
      fullName: sanitizeHtml(fullName.trim()),
      username: sanitizeHtml(username.trim()),
      email: sanitizeHtml(email.trim().toLowerCase()),
      mobileNumber: sanitizeHtml(mobileNumber.trim()),
      password,
      sponsorCode: sponsorCode?.trim(),
      address: sanitizeHtml(address?.trim() || ""),
      state: sanitizeHtml(state?.trim() || ""),
      dob
    };

    // 🔍 Check if email/mobile/username already exists
    const existingUser = await User.findOne({
      $or: [
        { email: cleanData.email },
        { username: cleanData.username },
        { mobileNumber: cleanData.mobileNumber }
      ]
    });
    if (existingUser) {
      return res.status(400).json({
        message: "Email, mobile number or username already exists"
      });
    }

    // 🎯 Generate affiliate code
    const lastUser = await User.findOne({ affiliateCode: { $regex: /^SV\d+$/ } })
      .sort({ createdAt: -1 })
      .lean();

    let nextCodeNumber = 1001;
    if (lastUser?.affiliateCode) {
      const numPart = parseInt(lastUser.affiliateCode.replace("SV", ""));
      if (!isNaN(numPart)) {
        nextCodeNumber = numPart + 1;
      }
    }
    cleanData.affiliateCode = `SV${nextCodeNumber}`;

    // 🧑‍💻 Create user
    let newUser;
    try {
      newUser = await User.create(cleanData);
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ message: `${field} already exists` });
      }
      throw err;
    }

    // 📧 Welcome Email
    try {
      await sendWelcomeEmail({
        to: newUser.email,
        name: newUser.fullName
      });
    } catch (mailErr) {
      console.error("📭 Failed to send welcome email:", mailErr.message);
    }

    // 🤝 Create lead if sponsorCode is valid
    if (cleanData.sponsorCode) {
      const referrer = await User.findOne({ affiliateCode: cleanData.sponsorCode });
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

    // 🍪 Auth Token Cookie
    const token = generateToken(newUser._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
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
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ✅ Login
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  try {
    // 🧼 Sanitize and normalize input
    const email = sanitizeHtml(req.body.email.trim().toLowerCase());
    const password = req.body.password;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 🍪 Auth token
    const token = generateToken(user._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        sponsorCode: user.sponsorCode,
        affiliateCode: user.affiliateCode,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


// ✅ Logout
exports.logoutUser = (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      sameSite: isProduction ? "None" : "Lax",
      secure: isProduction,
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ message: "Failed to logout" });
  }
};


// ✅ Get Profile
exports.getLoggedInUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("enrolledCourses.course", "title price");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let sponsor = null;

    if (user.sponsorCode) {
      sponsor = await User.findOne({ affiliateCode: user.sponsorCode }).select("fullName");
    }

    res.status(200).json({
      ...user.toObject(),
      sponsorName: sponsor?.fullName || null,
    });
  } catch (err) {
    console.error("❌ Error fetching user profile:", err);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};


// ✅ Update Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const updates = {};

    // ✅ Only allow specific fields to be updated
    const allowedFields = ["email", "mobileNumber", "dob", "state", "address"];

    for (const key of allowedFields) {
      if (req.body[key]) {
        updates[key] = sanitizeHtml(req.body[key].toString().trim());
      }
    }

    // ✅ Handle profile image if uploaded
    if (req.file?.path) {
      updates.profileImage = req.file.path; // full Cloudinary URL
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(400).json({ message: "Failed to update profile" });
  }
};

// ✅ Change Password
exports.changePassword = async (req, res) => {
  try {
    const oldPassword = sanitizeHtml(req.body.oldPassword?.trim() || "");
    const newPassword = sanitizeHtml(req.body.newPassword?.trim() || "");

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new passwords are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ message: "Old and new password cannot be the same" });
    }

    if (!Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    console.log(`[SECURITY] Password changed for ${user.email} at ${new Date().toISOString()}`);

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    return res.status(500).json({ message: "Password change failed" });
  }
};

// ✅ Get KYC Status
exports.getKycStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, kycRaw] = await Promise.all([
      User.findById(userId).select("kycStatus kycReason"),
      UserKyc.findOne({ userId }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔓 Decrypt sensitive fields if KYC exists
    const kyc = kycRaw
      ? {
          ...kycRaw,
          accountNumber: decrypt(kycRaw.accountNumber),
          aadhaarNumber: decrypt(kycRaw.aadhaarNumber),
          panCard: decrypt(kycRaw.panCard),
          upiId: decrypt(kycRaw.upiId),
        }
      : null;

    return res.status(200).json({
      status: user.kycStatus || "not-submitted",
      reason: user.kycReason || null,
      kyc,
    });
  } catch (err) {
    console.error("❌ Error fetching KYC status:", err.message);
    return res.status(500).json({ message: "Server error while fetching KYC" });
  }
};


// ✅ Submit KYC
exports.submitKycDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    const existing = await UserKyc.findOne({ userId });
    if (existing) {
      return res.status(400).json({ message: "KYC already submitted" });
    }

    // 🧼 Sanitize + 🔐 Encrypt
    const cleanData = {
      userId,
      accountHolderName: sanitizeHtml(req.body.accountHolderName?.trim() || ""),
      accountNumber: encrypt(sanitizeHtml(req.body.accountNumber?.trim() || "")),
      bankName: sanitizeHtml(req.body.bankName?.trim() || ""),
      ifscCode: sanitizeHtml(req.body.ifscCode?.trim() || ""),
      branch: sanitizeHtml(req.body.branch?.trim() || ""),
      upiId: encrypt(sanitizeHtml(req.body.upiId?.trim() || "")),
      aadhaarNumber: encrypt(sanitizeHtml(req.body.aadhaarNumber?.trim() || "")),
      panCard: encrypt(sanitizeHtml(req.body.panCard?.trim() || "")),
      aadhaarFrontImage: req.files?.aadhaarFrontImage?.[0]?.path || null,
      aadhaarBackImage: req.files?.aadhaarBackImage?.[0]?.path || null,
      panProofImage: req.files?.panProofImage?.[0]?.path || null,
    };

    // ✅ Check file uploads
    if (!cleanData.aadhaarFrontImage || !cleanData.aadhaarBackImage || !cleanData.panProofImage) {
      return res.status(400).json({ message: "All 3 document images are required" });
    }

    const kyc = await UserKyc.create(cleanData);

    res.status(201).json({ message: "KYC submitted successfully", kyc });
  } catch (err) {
    console.error("❌ KYC submission error:", err.message);
    res.status(500).json({ message: "Failed to submit KYC" });
  }
};

// ✅ Get Leads
exports.getAffiliateLeads = async (req, res) => {
  try {
    const leads = await Leads.find({
      referralId: req.user._id,
      status: "new"
    })
      .populate("leadUserId", "fullName mobileNumber affiliateCode profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({ leads });
  } catch (err) {
    console.error("❌ Error fetching affiliate leads:", err);
    return res.status(500).json({ message: "Failed to fetch leads" });
  }
};




// ✅ Delete Lead
exports.deleteLeadById = async (req, res) => {
  try {
    const leadId = req.params.id;

    if (!Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Leads.findOneAndDelete({
      _id: leadId,
      referralId: req.user._id,
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found or unauthorized" });
    }

    return res.status(200).json({ message: "Lead deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting lead:", err);
    return res.status(500).json({ message: "Server error while deleting lead" });
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
    const amount = parseFloat(sanitizeHtml(req.body.amount?.toString() || ""));
    const commissionId = sanitizeHtml(req.body.commissionId?.toString() || "");

    // ✅ Basic validations
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }
    if (!commissionId || !Types.ObjectId.isValid(commissionId)) {
      return res.status(400).json({ message: "Invalid commission ID" });
    }

    const payout = await Payout.create({
      userId: req.user._id,
      amount,
      commissionId,
    });

    return res.status(201).json({ message: "Payout requested", payout });
  } catch (err) {
    console.error("❌ Payout request error:", err);
    return res.status(500).json({ message: "Failed to request payout" });
  }
};

// ✅ Get Industry Earnings
exports.getIndustryEarnings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("industryEarnings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      industryEarnings: user.industryEarnings || [],
    });
  } catch (err) {
    console.error("❌ Error fetching industry earnings:", err);
    return res.status(500).json({ message: "Server error while fetching industry earnings" });
  }
};


// ✅ Update Industry Earnings (Admin only)
exports.updateIndustryEarnings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { industryEarnings } = req.body;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!Array.isArray(industryEarnings)) {
      return res.status(400).json({ message: "industryEarnings must be an array" });
    }

    // Optional: You can validate each item in array here if needed
    // Example: check for required fields like label, initialAmount, currentTotal

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.industryEarnings = industryEarnings;
    await user.save();

    return res.status(200).json({
      message: "Industry earnings updated successfully",
      industryEarnings: user.industryEarnings,
    });
  } catch (err) {
    console.error("❌ Error updating industry earnings:", err);
    return res.status(500).json({ message: "Server error while updating earnings" });
  }
};

exports.getSalesStats = async (req, res) => {
  try {
    const allowedTypes = ["daily", "weekly", "monthly"];
    const filterType = allowedTypes.includes(req.query.type) ? req.query.type : "daily";

    const user = await User.findById(req.user._id).select("_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const commissions = await Commissions.find({ userId: user._id })
      .populate("bundleCourseId", "title")
      .lean();

    const pieMap = {};
    const barMap = {};

    commissions.forEach((c) => {
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

    // ✅ Build barData with last 7 points
    const barData = [];
    const today = new Date();

    if (filterType === "daily") {
      for (let i = 6; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const label = day.toLocaleDateString("en-IN");
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    } else if (filterType === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const week = new Date(today);
        week.setDate(today.getDate() - i * 7);
        const label = `Week of ${week.toLocaleDateString("en-IN")}`;
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    } else if (filterType === "monthly") {
      for (let i = 6; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const label = month.toLocaleString("default", { month: "short", year: "numeric" });
        barData.push({ name: label, earnings: barMap[label] || 0 });
      }
    }

    const pieData = Object.entries(pieMap).map(([name, value]) => ({ name, value }));

    return res.status(200).json({ pieData, barData });
  } catch (err) {
    console.error("❌ Sales stats error:", err);
    return res.status(500).json({ message: "Failed to generate sales stats" });
  }
};


exports.getTopIncomeLeads = async (req, res) => {
  try {
    // 1. Find users referred by current user
    const referredUsers = await User.find({ sponsorCode: req.user.affiliateCode }).select("_id");
    const referredIds = referredUsers.map(u => u._id);

    if (!referredIds.length) {
      return res.status(200).json([]); // No referrals yet
    }

    // 2. Aggregate commissions of referred users
    const earnings = await Commissions.aggregate([
      { $match: { userId: { $in: referredIds } } },
      {
        $group: {
          _id: "$userId",
          total: { $sum: "$amount" },
        }
      },
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

    return res.status(200).json(earnings);
  } catch (error) {
    console.error(`❌ Top income leads error for ${req.user.affiliateCode}:`, error);
    return res.status(500).json({ message: "Server error while fetching top income leads" });
  }
};


// admin
// userController.js ke loginUser method me thoda change:
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

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

    return res.status(200).json({
      message: "Admin login successful",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Admin login error:", err);
    return res.status(500).json({ message: "Something went wrong during admin login" });
  }
};


// GET /api/user/payouts
exports.getUserPayouts = async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const payouts = await Payout.find({ userId: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json(payouts || []);
  } catch (error) {
    console.error(`❌ getUserPayouts error for user ${req.user._id}:`, error);
    return res.status(500).json({ message: "Failed to fetch payouts" });
  }
};

// GET /api/user/commission-summary
exports.getCommissionSummary = async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [paid, unpaid, pending, approved] = await Promise.all([
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

    return res.status(200).json({
      paid: paid[0]?.total || 0,
      unpaid: unpaid[0]?.total || 0,
      pending: pending[0]?.total || 0,
      processing: approved[0]?.total || 0,
    });
  } catch (error) {
    console.error("❌ getCommissionSummary error:", error);
    return res.status(500).json({ message: "Failed to fetch commission summary" });
  }
};

// GET /api/user/leaderboard?type=daily|weekly|monthly|all
exports.getLeaderboard = async (req, res) => {
  try {
    const allowedTypes = ["daily", "weekly", "monthly", "all"];
    const type = allowedTypes.includes(req.query.type) ? req.query.type : "all";

    const now = new Date();
    let dateFilter = {};

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

    return res.status(200).json(leaderboard);
  } catch (err) {
    console.error(`❌ Leaderboard fetch error [type=${req.query.type}]:`, err);
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};

//Forgot Password 
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@") || typeof email !== "string") {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedOtp = await bcrypt.hash(otpCode, 10);
    user.otp = {
      code: hashedOtp,
      expiresAt: otpExpiry,
    };

    await user.save();

    try {
      await sendOtpEmail({
        to: email,
        otp: otpCode,
        name: user.fullName,
      });
    } catch (mailErr) {
      console.error("❌ Failed to send OTP email:", mailErr.message);
      return res.status(500).json({ message: "OTP could not be sent. Please try again later." });
    }

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("❌ Error in forgotPassword:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// OTP Verification 
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  // Basic input validation
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required." });
  }

  if (!otp || typeof otp !== "string" || otp.length !== 6) {
    return res.status(400).json({ message: "OTP must be a 6-digit string." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check OTP expiry
    if (new Date(user.otp.expiresAt) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // ✅ Compare hashed OTP
    const isMatch = await bcrypt.compare(otp, user.otp.code);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // ✅ Clear OTP after success
    user.otp = undefined;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("❌ Error in verifyOtp:", err.message);
    res.status(500).json({ message: "Server error while verifying OTP" });
  }
};


// Reset Password
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional (Recommended): ensure OTP was verified before allowing password reset
    if (user.otp?.code) {
      return res.status(400).json({ message: "OTP verification required before resetting password" });
    }

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
      .sort({ createdAt: -1 })
      .lean(); // Optimize for read-only

    res.status(200).json(trainings || []);
  } catch (err) {
    console.error("❌ Error fetching trainings:", err.message);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};
