// controllers/adminController.js (ya payoutController.js me add kar sakte ho)

const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const User = require("../models/User");
const Commissions = require("../models/Commissions");
const UserKyc = require("../models/UserKyc");
const mongoose = require("mongoose");
const Payout = require("../models/Payout");
const Training = require("../models/Training");
const jwt = require("jsonwebtoken");
const { sendPayoutSuccessEmail, sendPayoutFailureEmail } = require("../utils/email");
const { decrypt } = require("../utils/encrypt");
const bcrypt = require("bcryptjs");
const { sendWelcomeEmail } = require("../utils/email");
const Enrollments = require("../models/Enrollments");
const Leads = require("../models/Leads");
const Course = require("../models/Course");
const { Types } = require("mongoose");
const Payment = require("../models/Payment");
const Webinar = require("../models/Webinar");
const validator = require("validator");



exports.getUsersForPayout = async (req, res) => {
  try {
    const { kycStatus, weekStart, weekEnd } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: "Week range is required" });
    }

    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    end.setDate(end.getDate() + 1); // include full end date

    // 1. Get all pending commissions in the week range
    const commissions = await Commissions.find({
      status: "pending",
      createdAt: { $gte: start, $lt: end },
    }).populate("userId");

    if (!commissions.length) {
      console.log("⚠️ No commissions found for payout.");
      return res.status(404).json({ message: "No commissions found for payout" });
    }

    console.log("📊 commissions fetched:", commissions.length);

    // 2. Group by user
    const groupedByUser = {};
    commissions.forEach((c) => {
      const user = c.userId;
      if (!user || !user._id) return;
      const uid = user._id.toString();

      if (!groupedByUser[uid]) {
        groupedByUser[uid] = {
          user,
          totalPendingAmount: 0,
          unpaidFromLastWeek: 0,
        };
      }

      groupedByUser[uid].totalPendingAmount += c.amount;
    });

    // 3. Fetch unpaid commissions for each user from past weeks
    const userIds = Object.keys(groupedByUser);
    const unpaidAgg = await Commissions.aggregate([
      {
        $match: {
          userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
          status: "unpaid",
          createdAt: { $lt: start },
        },
      },
      {
        $group: {
          _id: "$userId",
          unpaid: { $sum: "$amount" },
        },
      },
    ]);

    unpaidAgg.forEach(({ _id, unpaid }) => {
      const uid = _id.toString();
      if (groupedByUser[uid]) {
        groupedByUser[uid].unpaidFromLastWeek = unpaid;
      }
    });

    // 4. Filter by KYC status
    const filtered = Object.values(groupedByUser).filter(
      (entry) => entry.user.kycStatus === kycStatus
    );

    res.status(200).json(filtered);
  } catch (err) {
    console.error("🔥 getUsersForPayout error:", err);
    res.status(500).json({ message: "Failed to fetch payout data" });
  }
};

exports.getUsersForPayoutApproval = async (req, res) => {
  try {
    const { weekStart, weekEnd, kycStatus = "approved" } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: "weekStart and weekEnd required" });
    }

    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Get users whose commissions are pending for this period
    const commissions = await Commissions.aggregate([
      {
        $match: {
          status: "pending",
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$userId",
          totalPendingAmount: { $sum: "$amount" }
        }
      }
    ]);

    const userIds = commissions.map(c => c._id);

    // 2️⃣ Fetch user + KYC + unpaid from earlier weeks
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id fullName email mobile")
      .lean();

    const kycs = await UserKyc.find({ user: { $in: userIds } }).lean();

    const unpaidMap = await Commissions.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          status: "unpaid",
          createdAt: { $lt: start }
        }
      },
      {
        $group: {
          _id: "$userId",
          unpaidAmount: { $sum: "$amount" }
        }
      }
    ]);

    const unpaidObj = {};
    unpaidMap.forEach(u => {
      unpaidObj[u._id.toString()] = u.unpaidAmount;
    });

    const finalData = users.map(user => {
      const kyc = kycs.find(k => k.user.toString() === user._id.toString());
      const pending = commissions.find(c => c._id.toString() === user._id.toString());

      return {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        kycStatus: kyc?.status || "pending",
        totalPendingAmount: pending?.totalPendingAmount || 0,
        unpaidFromLastWeek: unpaidObj[user._id.toString()] || 0
      };
    });

    const filtered = finalData.filter(u => u.kycStatus === kycStatus);

    res.status(200).json(filtered);
  } catch (err) {
    console.error("🔴 Error in getUsersForPayoutApproval:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.approveAndGeneratePayout = async (req, res) => {
  try {
    const { userIds, weekStart, weekEnd } = req.body;

    if (!userIds || !weekStart || !weekEnd) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    end.setHours(23, 59, 59, 999);

    const rows = [];

    for (let userId of userIds) {
      const commissions = await Commissions.find({
        userId,
        status: "pending",
        createdAt: { $gte: start, $lte: end },
        paymentSuccess: true,
      });

      if (!commissions.length) {
        console.log(`ℹ️ No commissions found for user: ${userId}`);
        continue;
      }

      const totalAmount = Number(
        commissions.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)
      );

      const user = await User.findById(userId).lean();
      const kyc = await UserKyc.findOne({ userId }).lean();

      if (!user) {
        console.warn(`⚠️ Skipped userId ${userId} due to missing user`);
        continue;
      }

      if (!kyc || !kyc.accountHolderName || !kyc.accountNumber || !kyc.ifscCode) {
        console.warn(`⚠️ Skipped userId ${userId} due to missing/incomplete KYC`);
        continue;
      }

      if (user.kycStatus !== "approved") {
        console.warn(`⛔ Skipped userId ${userId} due to unapproved KYC status`);
        continue;
      }

      const decryptedAccountNumber = decrypt(kyc.accountNumber);

      const tdsPercent = 2;
      const tdsAmount = Number(((tdsPercent / 100) * totalAmount).toFixed(2));
      const netAmount = Number((totalAmount - tdsAmount).toFixed(2));

      const pastUnpaid = await Commissions.aggregate([
        { $match: { userId, status: "unpaid", createdAt: { $lt: start } } },
        { $group: { _id: "$userId", unpaid: { $sum: "$amount" } } },
      ]);

      const unpaidAmount = pastUnpaid[0]?.unpaid || 0;
      const remarks = unpaidAmount > 0 ? `last week payout pending: ₹${unpaidAmount}` : "";

      const payout = await Payout.create({
        userId,
        commissionIds: commissions.map((c) => c._id),
        beneficiaryName: kyc.accountHolderName,
        accountNumber: decryptedAccountNumber,
        ifscCode: kyc.ifscCode,
        totalAmount,
        tds: {
          amount: tdsAmount,
          percent: tdsPercent,
        },
        netAmount,
        status: "approved",
        transactionType: "NEFT",
        remarks,
        fromDate: start,
        toDate: end,
      });

      await Commissions.updateMany(
        { _id: { $in: commissions.map((c) => c._id) } },
        { $set: { status: "approved" } }
      );

      rows.push({
        "Beneficiary Name": kyc.accountHolderName,
        "Beneficiary Account Number": decryptedAccountNumber,
        IFSC: kyc.ifscCode,
        "Transaction Type": "NEFT",
        "Total Amount": totalAmount,
        "TDS Amount": tdsAmount,
        Amount: netAmount,
        Currency: "INR",
        "Beneficiary Email ID": user.email,
        Remarks: remarks,
      });

      console.log(`✅ Approved payout for user: ${user.fullName} – ₹${totalAmount}`);
    }

    if (!rows.length) {
      return res.status(400).json({ message: "No commissions to approve" });
    }

    const parser = new Parser();
    const csv = parser.parse(rows);
    const fileName = `payout-week-${weekStart}-to-${weekEnd}-${Date.now()}.csv`;
    const filePath = path.join(__dirname, "..", "downloads", "payouts", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, csv);

    res.status(200).json({
      message: "Payout approved and CSV generated",
      file: `/downloads/payouts/${fileName}`,
    });
  } catch (err) {
    console.error("❌ Error in approveAndGeneratePayout:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.listPayoutCSVFiles = async (req, res) => {
  try {
    const payoutDir = path.join(__dirname, "..", "downloads", "payouts");

    if (!fs.existsSync(payoutDir)) {
      return res.status(200).json([]);
    }

    const files = fs.readdirSync(payoutDir).filter(file => file.endsWith(".csv"));

    const data = files.map(file => {
      const filePath = path.join(payoutDir, file);
      const stats = fs.statSync(filePath);

      return {
        fileName: file,
        url: `/downloads/payouts/${file}`,
        createdAt: stats.birthtime
      };
    });

    res.status(200).json(data.reverse());
  } catch (err) {
    console.error("❌ Error in listPayoutCSVFiles:", err);
    res.status(500).json({ message: "Unable to fetch files" });
  }
};

exports.uploadBankResponse = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    console.log(`📦 Saving file with extension: ${ext}`);

    let records = [];
    if (ext === ".xlsx") {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(sheet);
    } else if (ext === ".csv") {
      const csvData = fs.readFileSync(filePath);
      const lines = csvData.toString().split("\n");
      const headers = lines[0].split(",");
      lines.slice(1).forEach((line) => {
        if (!line.trim()) return;
        const data = line.split(",");
        const row = {};
        headers.forEach((h, i) => {
          row[h.trim()] = data[i]?.trim();
        });
        records.push(row);
      });
    } else {
      return res.status(400).json({ message: "Only CSV or XLSX files allowed." });
    }

    console.log(`📥 Total Records Received: ${records.length}`);

    for (const [i, row] of records.entries()) {
      console.log(`🔄 Processing row ${i + 1}:`, row);

      const {
        "Beneficiary Email ID": email,
        "Amount": amountStr,
        "Transaction Type": type,
        "Transaction Date": txnDate,
        "UTR Number": utr,
        "Status": status,
        "Errors": errors,
      } = row;

      const amount = parseFloat((amountStr || "").replace(/[^0-9.]/g, ""));
      if (isNaN(amount)) {
        console.warn(`❌ Skipping row due to invalid amount: ${amountStr}`);
        continue;
      }
      if (!email || !amount) {
        console.warn(`⚠️ Skipping row ${i + 1} due to missing email or amount`);
        continue;
      }

      const user = await User.findOne({ email });
      if (!user) {
        console.warn(`❌ No user found for email: ${email}`);
        continue;
      }

      console.log(`🔎 Looking for payout of ₹${amount} for user ${user._id}`);

      const payout = await Payout.findOne({
        userId: user._id,
        netAmount: { $gte: amount - 0.01, $lte: amount + 0.01 },
        status: "approved",
        createdAt: {
          $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      });

      if (!payout) {
        console.warn(`❌ No approved payout found for ${email} with amount ₹${amount}`);
        continue;
      }

      console.log(`✅ Payout matched: ${payout._id}`);

      payout.transactionType = type;
      payout.transactionDate = txnDate || new Date();
      payout.utrNumber = utr || null;
      payout.status = status.toLowerCase() === "success" ? "paid" : "failed";
      payout.remarks = payout.status === "paid" ? "✅ Payout completed" : (errors || "❌ Bank error");

      await payout.save();
      console.log(`✅ Updated payout status for ${email} to "${payout.status}"`);

      const commissionStatus = payout.status === "paid" ? "paid" : "unpaid";

      const updated = await Commissions.updateMany(
        {
          userId: user._id,
          status: "approved",
          _id: { $in: payout.commissionIds || [] },
        },
        { $set: { status: commissionStatus } }
      );

      console.log(`🪙 Updated ${updated.modifiedCount} commissions for ${email} to "${commissionStatus}"`);

      const tdsAmount = payout.tds?.amount || 0;
      const netPaid = payout.netAmount || (payout.totalAmount - tdsAmount);

      if (payout.status === "paid") {
        await sendPayoutSuccessEmail({
          to: user.email,
          name: user.fullName,
          totalAmount: payout.totalAmount,
          tdsAmount,
          netAmount: netPaid,
        });
      } else {
        await sendPayoutFailureEmail({
          to: user.email,
          name: user.fullName,
          reason: payout.erros,
          netAmount: payout.netAmount,
        });
      }
    }

    return res.status(200).json({ message: "✅ Bank response uploaded and processed successfully." });
  } catch (error) {
    console.error("❌ uploadBankResponse error:", error);
    res.status(500).json({ message: "Internal server error while processing bank file." });
  }
};


exports.downloadWeeklyPayoutCSV = async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.query;
    const folderPath = path.join(__dirname, "..", "downloads", "payouts");

    const prefix = `payout-week-${weekStart}-to-${weekEnd}`;
    const files = fs.readdirSync(folderPath);
    const matchedFile = files.find((f) => f.startsWith(prefix));

    if (!matchedFile) {
      return res.status(404).json({ message: "CSV file not found for selected week" });
    }

    const filePath = path.join(folderPath, matchedFile);
    return res.download(filePath, matchedFile); // sends filename in response header
  } catch (err) {
    console.error("❌ CSV Download Error:", err);
    res.status(500).json({ message: "Failed to download payout file" });
  }
};


// Get all approved (processing) payouts
exports.getProcessingPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ status: "approved" }).populate("userId");
    res.status(200).json(payouts);
  } catch (err) {
    console.error("❌ Error fetching processing payouts:", err);
    res.status(500).json({ message: "Failed to fetch processing payouts" });
  }
};


// Get all completed (paid) payouts
exports.getCompletePayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ status: "paid" })
      .sort({ updatedAt: -1 })
      .populate("userId", "fullName email mobileNumber");

    res.status(200).json(payouts);
  } catch (err) {
    console.error("❌ Error fetching complete payouts:", err);
    res.status(500).json({ message: "Failed to fetch completed payouts" });
  }
};

exports.getFailedPayouts = async (req, res) => {
  try {
    const failedPayouts = await Payout.find({ status: "failed" })
      .populate("userId", "fullName email mobileNumber affiliateCode")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = failedPayouts.map((p) => ({
      _id: p._id,
      user: p.userId,
      amount: p.netAmount,
      reason: p.remarks || "No reason specified",
      transactionDate: p.transactionDate ? new Date(p.transactionDate).toLocaleDateString("en-IN") : "-",
      payoutDate: p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "-",
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ Failed to fetch failed payouts:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.createTraining = async (req, res) => {
  try {
    const {
      title,
      slug,
      type,
      youtubePlaylistId,
      youtubeVideoId,
    } = req.body;

    if (!title || !slug || !type) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // ✅ Cloudinary thumbnail required
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Thumbnail image is required" });
    }

    if (type === "playlist" && !youtubePlaylistId) {
      return res.status(400).json({ message: "Playlist ID is required" });
    }

    if (type === "single" && !youtubeVideoId) {
      return res.status(400).json({ message: "Video ID is required" });
    }

    const training = await Training.create({
      title,
      slug,
      thumbnail: req.file.path, // ✅ Cloudinary secure URL
      type,
      youtubePlaylistId: type === "playlist" ? youtubePlaylistId : null,
      youtubeVideoId: type === "single" ? youtubeVideoId : null,
      status: "published",
    });

    res.status(201).json({ message: "Training created", training });
  } catch (err) {
    console.error("❌ Admin training creation error:", err);
    res.status(500).json({ message: "Failed to create training" });
  }
};


// ✅ Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ✅ Get All Users Summary for Admin Dashboard
exports.getAllUserSummaries = async (req, res) => {
  try {
    const users = await User.find().populate("enrolledCourses.course", "title");

    const results = await Promise.all(
      users.map(async (user) => {
        const commissions = await Commissions.find({ userId: user._id });

        const totalEarnings = commissions.reduce((acc, c) => acc + c.amount, 0);
        const totalPaid = commissions
          .filter((c) => c.status === "paid")
          .reduce((acc, c) => acc + c.amount, 0);
        const totalUnpaid = commissions
          .filter((c) => c.status === "pending" || c.status === "unpaid")
          .reduce((acc, c) => acc + c.amount, 0);
        const totalIndustryEarning = user.industryEarnings?.reduce(
          (acc, e) => acc + (e.currentTotal || 0),
          0
        ) || 0;
        const sponsor = user.sponsorCode
          ? await User.findOne({ affiliateCode: user.sponsorCode })
          : null;

        return {
          userId: user.affiliateCode,
          name: user.fullName,
          mobile: user.mobileNumber,
          email: user.email,
          role: user.role,
          enrolledBundles: user.enrolledCourses.map((ec) => ec.course?.title),
          sponsorId: user.sponsorCode || "N/A",
          sponsorName: sponsor?.fullName || "N/A",
          industryEarning: totalIndustryEarning,
          totalEarnings,
          totalPaid,
          totalUnpaid,
          dateOfJoining: user.createdAt,
          kycStatus: user.kycStatus || "not-submitted",
          _id: user._id,
        };
      })
    );

    res.status(200).json(results);
  } catch (err) {
    console.error("❌ Error in getAllUserSummaries:", err);
    res.status(500).json({ message: "Failed to fetch user summaries" });
  }
};

exports.deleteUnpaidAffiliate = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "unpaid-affiliate") {
      return res.status(400).json({ message: "Only unpaid affiliates can be deleted using this route" });
    }

    // ✅ Only delete lead entry where this user is a lead (not as referrer)
    await Leads.deleteMany({ userId });

    // Delete user itself
    await user.deleteOne();

    res.status(200).json({ message: "Unpaid affiliate and their lead entry deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting unpaid affiliate:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ Admin Login As User (Impersonate)
exports.loginAsUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = generateToken(user._id);
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("impersonation_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });


    res.status(200).json({ message: `Logged in as ${user.fullName}` });
  } catch (err) {
    console.error("❌ Error in loginAsUser:", err);
    res.status(500).json({ message: "Impersonation failed" });
  }
};


// Get all pending KYCs
exports.getPendingKycs = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      kycStatus: { $in: ["not-submitted", "pending", "rejected", "approved"] },
    }).lean();

    const userIds = pendingUsers.map((u) => u._id);

    const kycs = await UserKyc.find({ userId: { $in: userIds } })
      .select("-__v")
      .lean();

    const merged = pendingUsers.map((user) => {
      const kyc = kycs.find((k) => k.userId?.toString() === user._id.toString());

      return {
        ...user,
        kycDetails: kyc
          ? {
            accountHolderName: kyc.accountHolderName || "",
            accountNumber: kyc.accountNumber ? decrypt(kyc.accountNumber) : "",
            ifscCode: kyc.ifscCode || "",
            upiId: kyc.upiId ? decrypt(kyc.upiId) : "",
            aadhaarNumber: kyc.aadhaarNumber ? decrypt(kyc.aadhaarNumber) : "",
            panCard: kyc.panCard ? decrypt(kyc.panCard) : "",
            aadharFrontImage: kyc.aadhaarFrontImage || "",
            aadharBackImage: kyc.aadhaarBackImage || "",
            panProofImage: kyc.panProofImage || "",
            bankProofDoc: kyc.bankProofDoc || "",
            status: kyc.kycStatus || "pending",
            rejectReason: kyc.rejectionReason || "",
          }
          : {},
      };
    });

    res.status(200).json(merged);
  } catch (err) {
    console.error("❌ KYC Fetch Error:", err.message, err.stack);
    res.status(500).json({ message: "Error fetching KYC data" });
  }
};



// adminController.js
exports.updateKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body; // "approved" / "rejected"

    // ✅ 1. Update User's KYC status
    const user = await User.findByIdAndUpdate(
      userId,
      { kycStatus: status },
      { new: true }
    );

    // ✅ 2. Update only the rejection reason in UserKyc
    const kyc = await UserKyc.findOneAndUpdate(
      { userId },
      {
        rejectionReason: status === "rejected" ? reason || "Rejected by admin" : null,
      },
      { new: true }
    );

    res.status(200).json({
      message: `✅ KYC ${status}`,
      user,
      kyc,
    });
  } catch (err) {
    console.error("❌ KYC Update Error:", err.message, err.stack);
    res.status(500).json({ message: "Failed to update KYC status" });
  }
};


exports.bulkRegisterAndEnrollWithRelations = async (req, res) => {
  const { users } = req.body;

  if (!Array.isArray(users)) {
    return res.status(400).json({ message: "users must be an array" });
  }

  const results = [];

  for (const userData of users) {
    try {
      const {
        fullName, username, email, mobileNumber,
        password, sponsorCode, courseId, address, dob
      } = userData;

      const existing = await User.findOne({ email });
      if (existing) {
        results.push({ email, status: "Already exists" });
        continue;
      }

      const course = await Course.findById(courseId).select("relatedBundleIds relatedCourses");
      if (!course) {
        results.push({ email, status: "Invalid courseId" });
        continue;
      }

      let affiliateCode;
      let nextNum = 1000;
      let isUnique = false;

      while (!isUnique) {
        const lastUser = await User.findOne({
          affiliateCode: { $regex: /^SV\d+$/ }
        }).sort({ affiliateCode: -1 }); // 🧠 sort numerically descending

        nextNum = lastUser
          ? parseInt(lastUser.affiliateCode.replace("SV", "")) + 1
          : 1000;

        affiliateCode = `SV${nextNum}`;

        const existingUser = await User.findOne({ affiliateCode });
        if (!existingUser) {
          isUnique = true;
        } else {
          nextNum++; // just in case a conflict happens in rare cases
        }
      }
      const firstName = fullName.split(" ")[0].toLowerCase();
      const generatedPassword = `${firstName}@123`;
      const newUser = await User.create({
        fullName,
        username,
        email: email.toLowerCase(),
        mobileNumber,
        password: generatedPassword,
        sponsorCode,
        address,
        dob,
        role: "paid-affiliate",
        affiliateCode,
      });

      if (sponsorCode) {
        const sponsor = await User.findOne({ affiliateCode: sponsorCode });
        if (sponsor) {
          await Leads.create({
            referralId: sponsor._id,
            leadUserId: newUser._id,
            name: newUser.fullName,
            email: newUser.email,
            mobile: newUser.mobileNumber,
            bundleCourseId: courseId,
          });
        }
      }

      // ✅ Step 1: Build full course list
      const enrolledCourseIds = new Set([courseId.toString()]);
      (course.relatedCourses || []).forEach(cid => enrolledCourseIds.add(cid.toString()));

      if (course.relatedBundleIds?.length > 0) {
        const relatedBundles = await Course.find({
          _id: { $in: course.relatedBundleIds }
        }).select("relatedCourses");

        for (const bundle of relatedBundles) {
          enrolledCourseIds.add(bundle._id.toString());
          (bundle.relatedCourses || []).forEach(cid => {
            if (cid) enrolledCourseIds.add(cid.toString());
          });
        }
      }

      // ✅ Step 2: Create one dummy payment
      const dummyOrderId = `MANUAL_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const dummyPaymentId = `MANUAL_PAYID_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      console.log(`👉 Creating payment for ${email}`);

      const payment = await Payment.create({
        user: newUser._id,
        course: courseId,
        razorpayOrderId: dummyOrderId,
        razorpayPaymentId: dummyPaymentId,
        amountPaid: 0,
        currency: "INR",
        status: "created",
        paidAt: new Date(),
        forBundleCourseId: courseId,
        remarks: "Pre Access To Special Members"
      });

      console.log(`✅ Payment ID: ${payment._id}`);

      // ✅ Step 3: Enroll in all collected course IDs
      for (const cid of enrolledCourseIds) {
        if (!cid) continue;

        const alreadyEnrolled = await Enrollments.findOne({
          userId: newUser._id,
          courseId: cid
        });

        if (alreadyEnrolled) {
          console.warn(`⚠️ Already enrolled: ${email} in course ${cid}`);
          continue;
        }

        await Enrollments.create({
          userId: newUser._id,
          courseId: cid,
          status: "active",
          paymentId: payment._id
        });

        console.log(`✅ Enrolled ${email} in course ${cid}`);
      }

      // ✅ Step 4: Update user's enrolledCourses array
      await User.findByIdAndUpdate(newUser._id, {
        $addToSet: {
          enrolledCourses: {
            $each: Array.from(enrolledCourseIds).map(cid => ({ course: cid }))
          }
        }
      });

      // ✅ Step 5: Welcome email
      await sendWelcomeEmail({
        to: newUser.email,
        name: newUser.fullName
      });

      results.push({ email, status: "Created and enrolled" });

    } catch (error) {
      console.error(`❌ Error for ${userData.email}:`, error.message);
      results.push({ email: userData.email, status: "Error", error: error.message });
    }
  }

  res.json({ message: "Bulk processing complete", results });
};

exports.getReceivedPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "captured" })
      .populate("user", "fullName email mobileNumber affiliateCode")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = payments.map((p) => ({
      _id: p._id,
      user: p.user,
      amount: p.amountPaid,
      currency: p.currency || "INR",
      method: p.paymentMethod || "N/A",
      courseType: p.forBundleCourseId ? "Bundle" : "Single",
      courseId: p.courseId || p.forBundleCourseId,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      paidAt: new Date(p.createdAt).toLocaleString("en-IN"),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ Failed to fetch received payments:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createOrUpdateWebinar = async (req, res) => {
  try {
    const { title, date, time, zoomLink, youtubeLink, status } = req.body;
    const thumbnail = req.file?.path;

    // Basic validation
    if (!title || !date || !time)
      return res.status(400).json({ message: "Title, date, and time are required." });

    if (!/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i.test(time))
      return res.status(400).json({ message: "Invalid time format (use HH:MM AM/PM)" });

    if (zoomLink && !validator.isURL(zoomLink))
      return res.status(400).json({ message: "Invalid Zoom link" });

    if (youtubeLink && !validator.isURL(youtubeLink))
      return res.status(400).json({ message: "Invalid YouTube link" });

    if (thumbnail && !validator.isURL(thumbnail))
      return res.status(400).json({ message: "Invalid thumbnail URL" });

    let webinar = await Webinar.findOne({ date });

    if (webinar) {
      webinar.title = title.trim();
      webinar.time = time.trim();
      webinar.zoomLink = zoomLink?.trim();
      webinar.youtubeLink = youtubeLink?.trim();
      webinar.thumbnail = thumbnail || webinar.thumbnail;
      webinar.status = status || webinar.status;
      await webinar.save();
    } else {
      webinar = await Webinar.create({
        title: title.trim(),
        date,
        time: time.trim(),
        zoomLink: zoomLink?.trim(),
        youtubeLink: youtubeLink?.trim(),
        thumbnail,
        status,
      });
    }

    res.status(200).json({ message: "Webinar saved", webinar });
  } catch (err) {
    console.error("❌ Error saving webinar:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.find().sort({ date: 1 });
    res.status(200).json(webinars);
  } catch (err) {
    console.error("❌ Error fetching webinars:", err);
    res.status(500).json({ message: "Server error" });
  }
};