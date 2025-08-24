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
const { sendWelcomeEmail, sendUpdateOtpEmail, sendEmailUpdatedConfirmation } = require("../utils/email");
const { sendOtpEmail, sendMobileUpdateOtpEmail } = require("../utils/email");
const { validationResult } = require("express-validator");
const { Types } = require("mongoose");
const mongoose = require("mongoose");
const sanitizeHtml = require("sanitize-html");
const { encrypt } = require("../utils/encrypt");
const { decrypt } = require("../utils/encrypt");
const Webinar = require("../models/Webinar");
const validator = require("validator");
const crypto = require("crypto");
const ReelIdea = require("../models/ReelIdea");
const PromotionalMaterial = require("../models/PromotionalMaterial");
const Enrollments = require("../models/Enrollments")
const TargetMilestone = require("../models/TargetMilestone");
const { google } = require("googleapis");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const uploadDriveFileToR2 = require("../utils/driveToR2");
const r2 = require("../utils/r2");


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
    const emailExists = await User.findOne({ email: cleanData.email });
    if (emailExists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const mobileExists = await User.findOne({ mobileNumber: cleanData.mobileNumber });
    if (mobileExists) {
      return res.status(400).json({ message: "Mobile number already exists" });
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
      .populate("enrolledCourses.course", "title price isBundle");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allCommissions = await Commissions.find({ userId: user._id });
    const totalEarnings = allCommissions.reduce((sum, c) => sum + c.amount, 0);

    const { determineAffiliateLevel } = require("../utils/levelsFn");
    const level = determineAffiliateLevel(totalEarnings);

    if (user.level !== level) {
      user.level = level;
      await user.save();
    }

    let sponsor = null;
    if (user.sponsorCode) {
      sponsor = await User.findOne({ affiliateCode: user.sponsorCode }).select("fullName");
    }

    res.status(200).json({
      ...user.toObject(),
      sponsorName: sponsor?.fullName || null,
      level: user.level,
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
      User.findById(userId).select("kycStatus"),
      UserKyc.findOne({ userId }).lean(),
    ]);
    console.log("🧾 KYC REJECTION REASON:", kycRaw?.rejectionReason);

    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    if (!kycRaw) {
      console.log("⚠️ No KYC record found for:", userId);
    }

    const kyc = kycRaw
      ? {
        ...kycRaw,
        accountNumber: kycRaw.accountNumber ? decrypt(kycRaw.accountNumber) : "",
        aadhaarNumber: kycRaw.aadhaarNumber ? decrypt(kycRaw.aadhaarNumber) : "",
        panCard: kycRaw.panCard ? decrypt(kycRaw.panCard) : "",
        upiId: kycRaw.upiId ? decrypt(kycRaw.upiId) : "",
      }
      : null;

    return res.status(200).json({
      status: user.kycStatus || "not-submitted",
      reason: kycRaw?.rejectionReason || null,
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
    if (existing) return res.status(400).json({ message: "KYC already submitted" });

    const maxSize = 5 * 1024 * 1024;

    const aadhaarFront = req.files?.aadhaarFrontImage?.[0];
    const aadhaarBack = req.files?.aadhaarBackImage?.[0];
    const panProof = req.files?.panProofImage?.[0];
    const bankProof = req.files?.bankProofDoc?.[0];

    // ❌ Missing file check (split)
    if (!aadhaarFront) return res.status(400).json({ message: "Aadhaar front image is required" });
    if (!aadhaarBack) return res.status(400).json({ message: "Aadhaar back image is required" });
    if (!panProof) return res.status(400).json({ message: "PAN card image is required" });
    if (!bankProof) return res.status(400).json({ message: "Bank Proof document is required" });

    // ❌ File size validations (split)
    if (aadhaarFront.size > maxSize) return res.status(400).json({ message: "Aadhaar front image is too large (max 5MB)" });
    if (aadhaarBack.size > maxSize) return res.status(400).json({ message: "Aadhaar back image is too large (max 5MB)" });
    if (panProof.size > maxSize) return res.status(400).json({ message: "PAN card image is too large (max 5MB)" });
    if (bankProof.size > maxSize) return res.status(400).json({ message: "Bank Proof image is too large (max 5MB)" });

    // 🧼 Sanitize
    const accountHolderName = sanitizeHtml(req.body.accountHolderName?.trim() || "");
    const accountNumber = sanitizeHtml(req.body.accountNumber?.trim() || "");
    const bankName = sanitizeHtml(req.body.bankName?.trim() || "");
    const ifscCode = sanitizeHtml(req.body.ifscCode?.trim()?.toUpperCase() || "");
    const branch = sanitizeHtml(req.body.branch?.trim() || "");
    const upiId = req.body.upiId ? sanitizeHtml(req.body.upiId?.trim()) : null;
    const aadhaarNumber = sanitizeHtml(req.body.aadhaarNumber?.replace(/\s+/g, "").trim() || "");
    const panCard = sanitizeHtml(req.body.panCard?.trim()?.toUpperCase() || "");

    // ❌ Field presence
    if (!accountHolderName || !accountNumber || !bankName || !ifscCode || !branch || !aadhaarNumber || !panCard) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🛡 Manual validations
    if (!/^[a-zA-Z\s]{3,}$/.test(accountHolderName)) return res.status(400).json({ message: "Invalid account holder name" });
    if (accountNumber.length < 6 || accountNumber.length > 20) return res.status(400).json({ message: "Account number must be 6 to 20 digits" });
    if (!/^[a-zA-Z\s]{3,}$/.test(bankName)) return res.status(400).json({ message: "Invalid bank name" });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) return res.status(400).json({ message: "Invalid IFSC code" });
    if (branch.length < 3) return res.status(400).json({ message: "Branch name must be at least 3 characters" });
    if (upiId && !/^[\w.-]+@[\w]+$/.test(upiId)) return res.status(400).json({ message: "Invalid UPI ID" });
    if (!/^\d{12}$/.test(aadhaarNumber)) return res.status(400).json({ message: "Aadhaar number must be 12 digits" });
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCard)) return res.status(400).json({ message: "Invalid PAN number format" });

    const cleanData = {
      userId,
      accountHolderName,
      accountNumber: encrypt(accountNumber),
      bankName,
      ifscCode,
      branch,
      upiId: upiId ? encrypt(upiId) : null,
      aadhaarNumber: encrypt(aadhaarNumber),
      panCard: encrypt(panCard),
      aadhaarFrontImage: aadhaarFront.path,
      aadhaarBackImage: aadhaarBack.path,
      panProofImage: panProof.path,
      bankProofDoc: bankProof.path,
    };

    const kyc = await UserKyc.create(cleanData);
    await User.findByIdAndUpdate(userId, { kycStatus: "pending" });

    return res.status(201).json({ message: "KYC submitted successfully", kyc });
  } catch (err) {
    console.error("❌ KYC submission error:", err.message || err);
    return res.status(500).json({ message: "Failed to submit KYC" });
  }
};


exports.updateKycDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    const existing = await UserKyc.findOne({ userId });
    if (!existing) {
      return res.status(404).json({ message: "No KYC record found to update" });
    }

    const maxSize = 5 * 1024 * 1024;

    const aadhaarFront = req.files?.aadhaarFrontImage?.[0];
    const aadhaarBack = req.files?.aadhaarBackImage?.[0];
    const panProof = req.files?.panProofImage?.[0];
    const bankProof = req.files?.bankProofDoc?.[0];

    // ❌ Missing file check
    if (!aadhaarFront) return res.status(400).json({ message: "Aadhaar front image is required" });
    if (!aadhaarBack) return res.status(400).json({ message: "Aadhaar back image is required" });
    if (!panProof) return res.status(400).json({ message: "PAN card image is required" });
    if (!bankProof) return res.status(400).json({ message: "Bank Proof document is required" });

    // ❌ File size validations
    if (aadhaarFront.size > maxSize) return res.status(400).json({ message: "Aadhaar front image is too large (max 5MB)" });
    if (aadhaarBack.size > maxSize) return res.status(400).json({ message: "Aadhaar back image is too large (max 5MB)" });
    if (panProof.size > maxSize) return res.status(400).json({ message: "PAN card image is too large (max 5MB)" });
    if (bankProof.size > maxSize) return res.status(400).json({ message: "Bank Proof image is too large (max 5MB)" });

    // 🧼 Sanitize
    const accountHolderName = sanitizeHtml(req.body.accountHolderName?.trim() || "");
    const accountNumber = sanitizeHtml(req.body.accountNumber?.trim() || "");
    const bankName = sanitizeHtml(req.body.bankName?.trim() || "");
    const ifscCode = sanitizeHtml(req.body.ifscCode?.trim()?.toUpperCase() || "");
    const branch = sanitizeHtml(req.body.branch?.trim() || "");
    const upiId = req.body.upiId ? sanitizeHtml(req.body.upiId?.trim()) : null;
    const aadhaarNumber = sanitizeHtml(req.body.aadhaarNumber?.replace(/\s+/g, "").trim() || "");
    const panCard = sanitizeHtml(req.body.panCard?.trim()?.toUpperCase() || "");

    // 🛡️ Manual validations
    if (!/^[a-zA-Z\s]{3,}$/.test(accountHolderName)) {
      return res.status(400).json({ message: "Invalid account holder name" });
    }
    if (accountNumber.length < 6 || accountNumber.length > 20) {
      return res.status(400).json({ message: "Account number must be 6 to 20 digits" });
    }
    if (!/^[a-zA-Z\s]{3,}$/.test(bankName)) {
      return res.status(400).json({ message: "Invalid bank name" });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json({ message: "Invalid IFSC code" });
    }
    if (branch.length < 3) {
      return res.status(400).json({ message: "Branch name must be at least 3 characters" });
    }
    if (upiId && !/^[\w.-]+@[\w]+$/.test(upiId)) {
      return res.status(400).json({ message: "Invalid UPI ID" });
    }
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ message: "Aadhaar number must be 12 digits" });
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCard)) {
      return res.status(400).json({ message: "Invalid PAN number format" });
    }

    const updateData = {
      accountHolderName,
      accountNumber: encrypt(accountNumber),
      bankName,
      ifscCode,
      branch,
      upiId: upiId ? encrypt(upiId) : null,
      aadhaarNumber: encrypt(aadhaarNumber),
      panCard: encrypt(panCard),
      aadhaarFrontImage: aadhaarFront.path,
      aadhaarBackImage: aadhaarBack.path,
      panProofImage: panProof.path,
      bankProofDoc: bankProof.path,
      kycStatus: "pending",
      rejectionReason: null,
      updatedAt: new Date(),
    };

    const updatedKyc = await UserKyc.findOneAndUpdate({ userId }, updateData, { new: true });

    await User.findByIdAndUpdate(userId, { kycStatus: "pending" });

    return res.status(200).json({ message: "KYC resubmitted successfully", kyc: updatedKyc });
  } catch (err) {
    console.error("❌ KYC update error:", err.message);
    return res.status(500).json({ message: "Failed to update KYC" });
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
  function getWeekStartLabel(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ensure Monday start
    d.setDate(diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `Week of ${dd}/${mm}/${yyyy}`;
  }

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
        label = getWeekStartLabel(created);
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
        week.setDate(week.getDate() - i * 7);
        const label = getWeekStartLabel(week);
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
    const allowedTypes = ["daily", "weekly", "monthly", "yearly", "all", "industry"];
    const type = allowedTypes.includes(req.query.type) ? req.query.type : "all";
    const userId = req.user._id;

    const now = new Date();
    let dateFilter = {};

    if (type === "daily") {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    } else if (type === "weekly") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      dateFilter.createdAt = { $gte: sevenDaysAgo };
    } else if (type === "monthly") {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else if (type === "yearly") {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) };
    }

    // 🧠 Industry Rank
    if (type === "industry") {
      const all = await User.aggregate([
        {
          $addFields: {
            totalIndustryEarnings: { $sum: "$industryEarnings.currentTotal" },
          },
        },
        {
          $match: { role: { $in: ["admin", "paid-affiliate"] } },
        },
        { $sort: { totalIndustryEarnings: -1 } },
        {
          $project: {
            fullName: 1,
            profileImage: 1,
            totalEarnings: "$totalIndustryEarnings",
            _id: 1,
          },
        },
      ]);

      const myIndex = all.findIndex((u) => u._id.toString() === userId.toString());
      const myData = all[myIndex] || null;

      const leaderboard = all.slice(0, 10);

      return res.status(200).json({
        leaderboard,
        myRank: {
          rank: myIndex >= 0 ? myIndex + 1 : null,
          totalEarnings: myData?.totalEarnings || 0,
        },
      });
    }

    // 🧠 Commission Leaderboard (Non-industry)
    const earnings = await Commissions.aggregate([
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
    ]);

    const earningUserIds = earnings.map((e) => e._id.toString());

    const users = await User.find({ _id: { $in: earningUserIds }, role: { $in: ["admin", "paid-affiliate"] } })
      .select("fullName profileImage role")
      .lean();

    // Only include commissions of allowed roles
    const filtered = earnings.filter((e) =>
      users.find((u) => u._id.toString() === e._id.toString())
    );

    const fullLeaderboard = filtered.map((entry, idx) => {
      const user = users.find((u) => u._id.toString() === entry._id.toString());
      return {
        fullName: user?.fullName || "User",
        profileImage: user?.profileImage || null,
        totalEarnings: entry.totalEarnings,
        _id: entry._id,
        rank: idx + 1,
      };
    });

    const currentUser = await User.findById(userId).select("fullName profileImage role").lean();
    let myIndex = fullLeaderboard.findIndex((u) => u._id.toString() === userId.toString());
    let myData = fullLeaderboard[myIndex] || null;

    if (!myData && ["admin", "paid-affiliate"].includes(currentUser?.role)) {
      myData = {
        _id: userId,
        fullName: currentUser.fullName,
        profileImage: currentUser.profileImage,
        totalEarnings: 0,
        rank: fullLeaderboard.length + 1,
      };
    }

    const leaderboard = fullLeaderboard.slice(0, 10);

    return res.status(200).json({
      leaderboard,
      myRank: {
        rank: myData ? myData.rank : null,
        totalEarnings: myData?.totalEarnings || 0,
      },
    });
  } catch (err) {
    console.error(`❌ Leaderboard fetch error [type=${req.query.type}]:`, err);
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};




exports.getMyNearbyRank = async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Get total commission per user
    const earnings = await Commissions.aggregate([
      {
        $group: {
          _id: "$userId",
          totalEarnings: { $sum: "$amount" },
        },
      },
    ]);

    // Step 2: Get all users with their earnings
    const users = await User.find().select("fullName profileImage").lean();

    const merged = users.map((user) => {
      const e = earnings.find((i) => i._id.toString() === user._id.toString());
      return {
        _id: user._id,
        fullName: user.fullName,
        profileImage: user.profileImage,
        totalEarnings: e?.totalEarnings || 0,
      };
    });

    // Step 3: Sort by earnings and assign rank
    const sorted = merged
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .map((u, idx) => ({ ...u, rank: idx + 1 }));

    const myIndex = sorted.findIndex((u) => u._id.toString() === userId.toString());
    const myRank = myIndex >= 0 ? myIndex + 1 : null;

    const nearbyRanks = [];

    if (myIndex === 0) {
      nearbyRanks.push(sorted[myIndex]);
      if (sorted[myIndex + 1]) nearbyRanks.push(sorted[myIndex + 1]);
      if (sorted[myIndex + 2]) nearbyRanks.push(sorted[myIndex + 2]);
    } else if (myIndex === sorted.length - 1) {
      if (sorted[myIndex - 2]) nearbyRanks.push(sorted[myIndex - 2]);
      if (sorted[myIndex - 1]) nearbyRanks.push(sorted[myIndex - 1]);
      nearbyRanks.push(sorted[myIndex]);
    } else {
      if (sorted[myIndex - 1]) nearbyRanks.push(sorted[myIndex - 1]);
      nearbyRanks.push(sorted[myIndex]);
      if (sorted[myIndex + 1]) nearbyRanks.push(sorted[myIndex + 1]);
    }

    return res.status(200).json({
      userRank: myRank,
      nearbyRanks,
    });
  } catch (err) {
    console.error("❌ Nearby Rank Fetch Error:", err);
    return res.status(500).json({ message: "Failed to fetch nearby ranks" });
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


exports.adminSearchUser = async (req, res) => {
  const query = req.query.query?.trim();

  if (!query) {
    return res.status(400).json({ message: "Search query required" });
  }

  const user = await User.findOne({
    $or: [
      { email: query.toLowerCase() },
      { affiliateCode: query.toUpperCase() },
      { mobileNumber: query },
    ]
  });

  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json({ user });
};


exports.getAllWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.find({}, {
      title: 1,
      date: 1,
      time: 1,
      thumbnail: 1,
      zoomLink: 1,
      youtubeLink: 1,
      status: 1,
    }).sort({ date: 1 });

    res.status(200).json(webinars);
  } catch (err) {
    console.error("❌ Error fetching webinars (user):", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.sendOtpToCurrentEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found." });
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const sanitizedEmail = validator.normalizeEmail(email);
    if (sanitizedEmail !== user.email) {
      return res.status(400).json({ message: "Email does not match your account." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = bcrypt.hashSync(otp, 10);

    user.otp = {
      code: hashedOtp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    await user.save();

    await sendUpdateOtpEmail({ name: user.fullName, to: user.email, otp });
    res.status(200).json({ message: "OTP sent to your current email." });
  } catch (err) {
    console.error("[sendOtpToCurrentEmail]", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// 🔐 Verify OTP before allowing email update
exports.verifyOtpForEmailUpdate = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || !/^[0-9]{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP format." });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.otp?.code) return res.status(400).json({ message: "OTP not found." });
    if (Date.now() > user.otp.expiresAt) return res.status(400).json({ message: "OTP expired." });

    const isMatch = await bcrypt.compare(otp, user.otp.code);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP." });

    user.otp = null; // clear OTP
    user.markModified("otp");
    await user.save();

    res.status(200).json({ message: "OTP verified. You can now update your email." });
  } catch (err) {
    console.error("[verifyOtpForEmailUpdate]", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ✅ Update email after OTP verified
exports.updateUserEmail = async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail || !validator.isEmail(newEmail)) {
      return res.status(400).json({ message: "Invalid new email format." });
    }

    const sanitizedNewEmail = validator.normalizeEmail(newEmail);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const existing = await User.findOne({ email: sanitizedNewEmail });
    if (existing) return res.status(409).json({ message: "Email already in use." });

    user.email = sanitizedNewEmail;
    await user.save();

    await sendEmailUpdatedConfirmation({ name: user.fullName, to: sanitizedNewEmail });
    res.status(200).json({ message: "Email updated successfully.", email: sanitizedNewEmail });
  } catch (err) {
    console.error("[updateUserEmail]", err);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.sendOtpForMobileUpdate = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { mobile } = req.body;

    if (!mobile || !validator.isMobilePhone(mobile, "en-IN")) {
      return res.status(400).json({ message: "Invalid mobile number" });
    }

    if (user.mobileNumber !== mobile) {
      return res.status(400).json({ message: "Old mobile number doesn't match" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.otp = { code: hashedOtp, expiresAt: Date.now() + 10 * 60 * 1000 };
    await user.save();

    await sendMobileUpdateOtpEmail({ name: user.fullName, to: user.email, otp })

    res.json({ message: "OTP sent to your registered email" });
  } catch (err) {
    console.error("OTP send error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// ✅ Verify OTP
exports.verifyOtpForMobileUpdate = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (!otp || !validator.isNumeric(otp) || otp.length !== 6) {
      return res.status(400).json({ message: "Invalid OTP format" });
    }

    const hashed = crypto.createHash("sha256").update(otp).digest("hex");
    if (
      !user.otp ||
      user.otp.code !== hashed ||
      user.otp.expiresAt < Date.now()
    ) {
      return res.status(400).json({ message: "OTP expired or incorrect" });
    }

    user.otp = undefined;
    await user.save();

    res.json({ message: "OTP verified. You can now update mobile." });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};

// ✅ Update Mobile Number
exports.updateMobileNumber = async (req, res) => {
  try {
    const { newMobile } = req.body;
    const user = await User.findById(req.user._id);

    if (!newMobile || !validator.isMobilePhone(newMobile, "en-IN")) {
      return res.status(400).json({ message: "Invalid new mobile number" });
    }

    user.mobileNumber = newMobile;
    await user.save();

    res.json({ message: "Mobile number updated", mobileNumber: newMobile });
  } catch (err) {
    console.error("Mobile update error:", err);
    res.status(500).json({ message: "Failed to update mobile number" });
  }
};

exports.getPromotionalRootFolders = async (req, res) => {
  try {
    const folders = await PromotionalMaterial.find({
      parent: null,
      type: "folder",
      status: "published",
    }).sort({ isFeatured: -1, createdAt: -1 });

    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch folders", error: err.message });
  }
};

exports.getPromotionalChildrenBySlug = async (req, res) => {
  try {
    const parent = await PromotionalMaterial.findOne({ slug: req.params.slug });
    if (!parent) return res.status(404).json({ message: "Not found" });

    let children = [];

    if (parent.driveFolderId) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GDRIVE_CLIENT_EMAIL,
          private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });
      const drive = google.drive({ version: "v3", auth });
      const result = await drive.files.list({
        q: `'${parent.driveFolderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, thumbnailLink)",
      });

      // ⚡ Parallel upload checks but limited concurrency
      children = await Promise.all(
        result.data.files.map(async (file) => {
          try {
            const key = `promotional/${file.id}-${file.name}`;

            // Step 1: Check if file exists in R2
            let existsInR2 = true;
            try {
              await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
            } catch (err) {
              existsInR2 = false;
            }

            // Step 2: Upload if not exists
            if (!existsInR2) {
              await uploadDriveFileToR2(file.id, file.name);
            }

            // Step 3: Signed URL
            const signedUrl = await getSignedUrl(
              r2,
              new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
              { expiresIn: 3600 }
            );

            return {
              type: file.mimeType.startsWith("image/") ? "image" : "video",
              title: file.name,
              url: signedUrl,
              thumbnail: file.thumbnailLink,
            };
          } catch (err) {
            console.error(`❌ Failed processing file ${file.name}:`, err.message);
            return null;
          }
        })
      );

      // remove nulls
      children = children.filter(Boolean);
    }

    res.json({ parent, children });
  } catch (err) {
    console.error("❌ Error in getPromotionalChildrenBySlug:", err.message);
    res.status(500).json({ message: "Failed to fetch materials", error: err.message });
  }
};

exports.getPromotionalChildrenByCat = async (req, res) => {
  try {
    // 🧭 1. Find parent folder by slug
    const parent = await PromotionalMaterial.findOne({ slug: req.params.slug });

    if (!parent) {
      return res.status(404).json({ message: "Promotional Material not found" });
    }

    // 🔁 2. If driveFolderId is available, fetch assets from Google Drive
    let children = [];

    if (parent.driveFolderId) {
      if (!process.env.GDRIVE_CLIENT_EMAIL || !process.env.GDRIVE_PRIVATE_KEY) {
        console.error("❌ Google Drive credentials missing in environment variables.");
        return res.status(500).json({ message: "Google Drive credentials not configured" });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GDRIVE_CLIENT_EMAIL,
          private_key: process.env.GDRIVE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });

      const drive = google.drive({ version: "v3", auth });
      const result = await drive.files.list({
        q: `'${parent.driveFolderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, thumbnailLink)",
      });

      children = result.data.files.map((file) => ({
        type: file.mimeType.startsWith("image/") ? "image" : "video",
        title: file.name,
        url: file.id,
        thumbnail: file.thumbnailLink,
      }));
    } else {
      // 📁 3. If not using drive, fallback to DB children (if any)
      children = await PromotionalMaterial.find({
        parent: parent._id,
        status: "published",
      }).sort({ type: 1, createdAt: -1 });
    }

    return res.status(200).json({ parent, children });
  } catch (err) {
    console.error("❌ Error in getPromotionalChildrenBySlug:", err.message);
    return res.status(500).json({
      message: "Failed to fetch promotional material children",
      error: err.message,
    });
  }
};


exports.trackCourseUsage = async (req, res) => {
  try {
    const { courseId, videoId, videoTimeSpent, generalTimeSpent } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const enrollment = await Enrollments.findOne({
      userId: req.user._id,
      courseId,
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    // 🟡 1. Save general time spent on CoursePlayer
    if (generalTimeSpent && generalTimeSpent > 0) {
      if (!enrollment.totalCourseTimeLogs) enrollment.totalCourseTimeLogs = [];

      enrollment.totalCourseTimeLogs.push({
        entryTime: new Date(),
        duration: Math.min(generalTimeSpent, 3600),
      });
    }

    // 🟢 2. Save video-wise time
    if (videoId && videoTimeSpent && videoTimeSpent > 0) {
      const safeDuration = Math.min(videoTimeSpent, 3600);

      const existing = enrollment.videoWatchLogs.find(
        (v) => v.videoId === videoId
      );

      if (existing) {
        existing.duration += safeDuration;
        existing.lastWatchedAt = new Date();
      } else {
        enrollment.videoWatchLogs.push({
          videoId,
          duration: safeDuration,
          lastWatchedAt: new Date(),
        });
      }
    }

    await enrollment.save();

    res.status(200).json({ message: "Time progress saved successfully" });
  } catch (err) {
    console.error("❌ updateCourseProgress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTargetProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "From and To dates are required" });
    }

    const start = new Date(from);
    const end = new Date(to);
    end.setDate(end.getDate() + 1); // include full end date

    const commissions = await Commissions.find({
      userId,
      createdAt: { $gte: start, $lt: end },
    });


    const total = commissions.reduce((sum, c) => sum + c.amount, 0);

    const tiers = [
      { target: 400000, label: "₹4L+ Rewards" },
      { target: 300000, label: "₹3L+ Rewards" },
      { target: 200000, label: "₹2L+ Rewards" },
      { target: 100000, label: "₹1L+ Rewards" },
      { target: 50000, label: "₹50K+ Rewards" },
      { target: 0, label: "Below ₹50K" },
    ];

    const currentTier = tiers.find(t => total >= t.target);

    res.status(200).json({
      totalEarned: total,
      currentTier,
      targets: tiers.map(t => ({ ...t, achieved: total >= t.target }))
    });
  } catch (err) {
    console.error("🎯 Target Tracker Error:", err);
    res.status(500).json({ message: "Failed to calculate target progress" });
  }
};

exports.getUserTargetCampaigns = async (req, res) => {
  try {
    const campaigns = await TargetMilestone.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).sort({ startDate: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: "Failed to load campaigns", error: err.message });
  }
};

exports.getUserTotalWatchTime = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    const result = await Enrollments.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } }, // ✅ FIXED
      { $unwind: "$videoWatchLogs" },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$videoWatchLogs.duration" }
        }
      },
      {
        $project: {
          _id: 0,
          totalMinutes: { $round: [{ $divide: ["$totalSeconds", 60] }, 2] }
        }
      }
    ]);

    const totalMinutes = result.length > 0 ? result[0].totalMinutes : 0;
    res.json({ totalMinutes });
  } catch (error) {
    console.error("Error fetching watch time:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.getEarningsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "Date is required (YYYY-MM-DD)" });
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const commissions = await Commissions.find({
      userId: req.user._id,
      createdAt: { $gte: start, $lte: end },
    });

    const total = commissions.reduce((sum, c) => sum + c.amount, 0);

    return res.status(200).json({
      date,
      totalEarning: total,
      commissions,
    });
  } catch (err) {
    console.error("❌ Error fetching earnings by date:", err);
    return res.status(500).json({ message: "Server error while fetching earnings" });
  }
};
