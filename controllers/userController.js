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

// 🔐 Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ✅ Register
exports.registerUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      mobileNumber,
      password,
      sponsorCode,
      address,
      state,
      dob,
    } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email or username already exists" });
    }

    const affiliateCode = `STX${Date.now().toString().slice(-6)}`;
    const newUser = await User.create({
      fullName,
      username,
      email,
      mobileNumber,
      password,
      sponsorCode,
      affiliateCode,
      address,
      state,
      dob,
    });

    // 🔁 Create lead if sponsor is valid
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
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
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// ✅ Get Profile
exports.getLoggedInUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

// ✅ Get Affiliate Leads
exports.getAffiliateLeads = async (req, res) => {
  try {
    const leads = await Leads.find({ referralId: req.user._id, status: "new" })
      .populate("leadUserId", "fullName mobileNumber affiliateCode profileImage")
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (err) {
    console.error("❌ Error fetching leads:", err);
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
    console.error("Failed to delete lead:", err);
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
    console.error("❌ Error in getAffiliateCommissions:", err);
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
    console.error("Error fetching industry earnings:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update Industry Earnings (Admin)
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
    console.error("Error updating industry earnings:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ Get Sales Stats (Pie + Bar Charts)
exports.getSalesStats = async (req, res) => {
  try {
    const filterType = req.query.type || "daily";
    const commissions = await Commissions.find({ userId: req.user._id }).populate("bundleCourseId");

    const pieMap = {};
    const barMap = {};

    commissions.forEach(c => {
      const created = new Date(c.createdAt);
      let label;

      if (filterType === "daily") {
        label = created.toLocaleDateString("en-IN");
      } else if (filterType === "weekly") {
        const startOfWeek = new Date(created);
        startOfWeek.setDate(created.getDate() - created.getDay());
        label = `Week of ${startOfWeek.toLocaleDateString("en-IN")}`;
      } else if (filterType === "monthly") {
        label = created.toLocaleString("default", { month: "short", year: "numeric" });
      }

      const courseName = c.bundleCourseId?.title || "Other";
      pieMap[courseName] = (pieMap[courseName] || 0) + 1;
      barMap[label] = (barMap[label] || 0) + c.amount;
    });

    const pieData = Object.entries(pieMap).map(([name, value]) => ({ name, value }));
    const barData = Object.entries(barMap)
      .map(([name, earnings]) => ({ name, earnings }))
      .sort((a, b) => new Date(a.name.replace("Week of ", "")) - new Date(b.name.replace("Week of ", "")));

    res.json({ pieData, barData });
  } catch (err) {
    console.error("Sales stats error:", err);
    res.status(500).json({ message: "Failed to generate sales stats" });
  }
};


