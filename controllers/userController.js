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

// Generate JWT
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
    if (existingUser)
      return res.status(400).json({ message: "Email or username already exists" });

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
      secure: process.env.NODE_ENV === "production",
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// ✅ Get Logged-in User Profile
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
