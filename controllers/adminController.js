// controllers/adminController.js 
const Razorpay = require("razorpay");
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
const { sendPayoutSuccessEmail, sendPayoutFailureEmail, sendKycApprovalEmail, sendKycRejectionEmail } = require("../utils/email");
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
const { determineAffiliateLevel } = require("../utils/levelsFn");
const PromotionalMaterial = require("../models/PromotionalMaterial");
const moment = require("moment");
const TargetMilestone = require("../models/TargetMilestone");
const uploadDriveFileToR2 = require("../utils/driveToR2");
const { google } = require("googleapis");




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
      return res.status(404).json({ message: "No commissions found for payout" });
    }


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
        "Beneficiary Account Number": `="${decryptedAccountNumber}"`,
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

      const amount = parseFloat((amountStr || "").toString().replace(/[^0-9.]/g, ""));
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
      const parsedTxnDate = moment(txnDate, "DD/MM/YYYY", true);
      if (!parsedTxnDate.isValid()) {
        console.warn(`❌ Invalid date format in row ${i + 1}: ${txnDate}`);
        continue;
      }
      payout.transactionDate = parsedTxnDate.toDate();

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
    const users = await User.find().populate("enrolledCourses.course", "title price isBundle");
    const { determineAffiliateLevel } = require("../utils/levelsFn");

    const results = await Promise.all(
      users.map(async (user) => {
        const commissions = await Commissions.find({ userId: user._id });

        const totalEarnings = commissions.reduce((acc, c) => acc + c.amount, 0);
        const level = determineAffiliateLevel(totalEarnings); // ✅ Just calculate, don’t update DB

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

        const highestPricedBundle = (user.enrolledCourses || [])
          .map(ec => ec.course)
          .filter(c => {
            return c && c.isBundle && c.price;
          })
          .reduce((max, course) => (course.price > max.price ? course : max), { price: 0 });



        return {
          userId: user.affiliateCode,
          name: user.fullName,
          mobile: user.mobileNumber,
          email: user.email,
          role: user.role,
          enrolledBundles: highestPricedBundle ? highestPricedBundle.title : null,
          sponsorId: user.sponsorCode || "N/A",
          sponsorName: sponsor?.fullName || "N/A",
          industryEarning: totalIndustryEarning,
          totalEarnings,
          totalPaid,
          totalUnpaid,
          dateOfJoining: user.createdAt,
          kycStatus: user.kycStatus || "not-submitted",
          _id: user._id,
          level, // ✅ This is calculated live, not from DB
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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ 2. Update only the rejection reason in UserKyc
    const kyc = await UserKyc.findOneAndUpdate(
      { userId },
      {
        rejectionReason: status === "rejected" ? reason || "Rejected by admin" : null,
      },
      { new: true }
    );

    // ✅ 3. Send Email Notification
    try {
      if (status === "approved") {
        await sendKycApprovalEmail({ to: user.email, name: user.fullName });
      } else if (status === "rejected") {
        await sendKycRejectionEmail({ to: user.email, name: user.fullName, reason });
      }
    } catch (mailErr) {
      console.error("📭 KYC email send error:", mailErr.message);
    }

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
        password, sponsorCode, courseId, address, dob,
        paymentReceived = "N", paymentMethod = null, amountPaid = 0,
        giveCommission = "N", commissionStatus = "pending", remarks = "",
      } = userData;

      // ✅ Check existing user
      const existing = await User.findOne({ email });
      if (existing) {
        results.push({ email, status: "Already exists" });
        continue;
      }

      // ✅ Find course
      const course = await Course.findById(courseId)
        .select("relatedBundleIds relatedCourses discountedPrice affiliateCommissionPercent title");
      if (!course) {
        results.push({ email, status: "Invalid courseId" });
        continue;
      }

      // ✅ Generate affiliate code
      let affiliateCode;
      let nextNum = 1000;
      let isUnique = false;
      while (!isUnique) {
        const lastUser = await User.findOne({
          affiliateCode: { $regex: /^SV\d+$/ }
        }).sort({ affiliateCode: -1 });

        nextNum = lastUser
          ? parseInt(lastUser.affiliateCode.replace("SV", "")) + 1
          : 1000;

        affiliateCode = `SV${nextNum}`;
        const existingUser = await User.findOne({ affiliateCode });
        if (!existingUser) isUnique = true;
        else nextNum++;
      }

      const firstName = fullName.split(" ")[0].toLowerCase();
      const generatedPassword = `${firstName}@123`;

      // ✅ Create user
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

      // ✅ Create lead if sponsorCode exists
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

      // ✅ Collect all courses (bundle + related)
      const enrolledCourseIds = new Set([courseId.toString()]);
      (course.relatedCourses || []).forEach(cid => enrolledCourseIds.add(cid.toString()));
      if (course.relatedBundleIds?.length > 0) {
        const relatedBundles = await Course.find({ _id: { $in: course.relatedBundleIds } })
          .select("relatedCourses");
        for (const bundle of relatedBundles) {
          enrolledCourseIds.add(bundle._id.toString());
          (bundle.relatedCourses || []).forEach(cid => cid && enrolledCourseIds.add(cid.toString()));
        }
      }

      // ✅ Create payment record
      const dummyOrderId = `MANUAL_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const dummyPaymentId = `MANUAL_PAYID_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      let finalStatus = "created";
      let finalAmount = 0;

      if (paymentReceived === "Y") {
        if (!amountPaid || Number(amountPaid) <= 0) {
          throw new Error("Amount must be greater than 0 if payment is received");
        }
        finalStatus = "captured";
        finalAmount = Number(amountPaid);
        finalRemarks = `Manual bulk registration - payment received via ${paymentMethod || "N/A"}`;
      }



      const payment = await Payment.create({
        user: newUser._id,
        course: courseId,
        razorpayOrderId: dummyOrderId,
        razorpayPaymentId: dummyPaymentId,
        amountPaid: finalAmount || 0,
        paymentMethod: paymentMethod || null,
        currency: "INR",
        status: finalStatus,
        paidAt: new Date(),
        forBundleCourseId: courseId,
        remarks: remarks || (paymentReceived === "Y"
          ? `Manual bulk registration - payment received via ${paymentMethod || "N/A"}`
          : "Manual bulk registration - payment pending"),
      });

      // ✅ Enroll user in courses
      for (const cid of enrolledCourseIds) {
        const alreadyEnrolled = await Enrollments.findOne({ userId: newUser._id, courseId: cid });
        if (!alreadyEnrolled) {
          await Enrollments.create({
            userId: newUser._id,
            courseId: cid,
            status: "active",
            paymentId: payment._id
          });
        }
      }

      await User.findByIdAndUpdate(newUser._id, {
        $addToSet: {
          enrolledCourses: Array.from(enrolledCourseIds).map(cid => ({ course: cid }))
        }
      });

      // ✅ Create commission (if sponsor exists & giveCommission = Y)
      if (sponsorCode && giveCommission === "Y" && paymentReceived === "Y") {
        const sponsor = await User.findOne({ affiliateCode: sponsorCode });
        if (sponsor) {
          const commissionAmount = Math.round(
            Number(course.discountedPrice) * (Number(course.affiliateCommissionPercent) / 100)
          );
          await Commissions.create({
            userId: sponsor._id,
            referralUser: newUser._id,
            amount: commissionAmount,
            bundleCourseId: courseId,
            transactionId: payment._id,
            status: commissionStatus || "pending",
            paymentSuccess: true,
          });
        }
      }

      await sendWelcomeEmail({ to: newUser.email, name: newUser.fullName });

      results.push({ email, status: "Created and enrolled", firstName });

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
      paidAt: new Date(p.paidAt).toLocaleString("en-IN"),
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

    // 🔒 Validation
    if (!title?.trim() || !date || !time?.trim()) {
      return res.status(400).json({ message: "Title, date, and time are required." });
    }

    if (!/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i.test(time.trim())) {
      return res.status(400).json({ message: "Invalid time format (use HH:MM AM/PM)" });
    }

    if (zoomLink && !validator.isURL(zoomLink)) {
      return res.status(400).json({ message: "Invalid Zoom link" });
    }

    if (youtubeLink && !validator.isURL(youtubeLink)) {
      return res.status(400).json({ message: "Invalid YouTube link" });
    }

    if (thumbnail && !validator.isURL(thumbnail)) {
      return res.status(400).json({ message: "Invalid thumbnail URL" });
    }

    let webinar = await Webinar.findOne({ date });

    if (webinar) {
      // 🔁 Update
      webinar.title = title.trim();
      webinar.time = time.trim();
      webinar.zoomLink = zoomLink?.trim() || "";
      webinar.youtubeLink = youtubeLink?.trim() || "";
      webinar.thumbnail = thumbnail || webinar.thumbnail;
      webinar.status = status || webinar.status;
      await webinar.save();
    } else {
      // 🆕 Create
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

exports.deleteWebinar = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Webinar.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Webinar not found" });
    }
    res.status(200).json({ message: "Webinar deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting webinar:", err);
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
exports.createOrUpdatePromotionalMaterial = async (req, res) => {
  try {
    const {
      _id,
      title,
      parent,
      type = "folder",
      url,
      status,
      isFeatured,
      driveFolderId: driveFolderIdBody,
    } = req.body;

    const data = { title, parent: parent || null, type, status, isFeatured };

    // extract Drive folder ID
    const extractId = (input = "") => {
      if (!input) return "";
      const m1 = input.match(/folders\/([A-Za-z0-9_-]{10,})/);
      const m2 = input.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/);
      if (m1) return m1[1];
      if (m2) return m2[1];
      if (/^[A-Za-z0-9_-]{10,}$/.test(input)) return input;
      return "";
    };

    if (type === "folder") {
      const id = extractId(url) || extractId(driveFolderIdBody);
      if (id) data.driveFolderId = id;
    }

    let result;
    if (_id) {
      result = await PromotionalMaterial.findByIdAndUpdate(_id, data, { new: true });
    } else {
      const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let slug = baseSlug, i = 1;
      while (await PromotionalMaterial.findOne({ slug })) slug = `${baseSlug}-${i++}`;
      data.slug = slug;
      result = await PromotionalMaterial.create(data);
    }

    // 🔥 Drive → R2 Sync here
    if (result.driveFolderId) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GDRIVE_CLIENT_EMAIL,
          private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });
      const drive = google.drive({ version: "v3", auth });

      const driveFiles = await drive.files.list({
        q: `'${result.driveFolderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, thumbnailLink)",
      });

      for (const file of driveFiles.data.files) {
        const r2Key = await uploadDriveFileToR2(file.id, file.name);

        // 🗃️ Save in DB as child material
        await PromotionalMaterial.updateOne(
          { driveFolderId: file.id },
          {
            title: file.name,
            parent: result._id,
            type: file.mimeType.startsWith("image/") ? "image" : "video",
            url: r2Key,
            thumbnail: file.thumbnailLink,
            status: "published",
          },
          { upsert: true }
        );
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Admin create/update error:", err);
    res.status(400).json({ message: "Operation failed", error: err.message });
  }
};




exports.deletePromotionalMaterial = async (req, res) => {
  try {
    const deleted = await PromotionalMaterial.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Deletion failed", error: err.message });
  }
};

exports.getAllPromotionalFolders = async (req, res) => {
  try {
    const materials = await PromotionalMaterial.find({})
      .sort({ createdAt: -1 })
      .select("title slug type driveFolderId thumbnail url parent status isFeatured createdAt")
      .populate("parent", "title slug"); // ✅ Parent ka title & slug populate

    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch promotional materials", error: err.message });
  }
};




const getMonthlyTDSReport = async (month) => {
  const [year, mon] = month.split("-");
  const start = new Date(`${year}-${mon}-01`);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  const paidPayouts = await Payout.find({
    status: "paid",
    createdAt: { $gte: start, $lt: end }
  })
    .populate("userId", "fullName affiliateCode")
    .lean();

  const kycs = await UserKyc.find({
    userId: { $in: paidPayouts.map(p => p.userId._id) }
  }).lean();

  const report = paidPayouts.reduce((acc, p) => {
    const uid = p.userId._id.toString();
    if (!acc[uid]) {
      const kyc = kycs.find(k => k.userId.toString() === uid);
      acc[uid] = {
        name: p.userId.fullName,
        affiliateCode: p.userId.affiliateCode || "N/A",
        pan: kyc?.panCard ? decrypt(kyc.panCard) : "",
        aadhaar: kyc?.aadhaarNumber
          ? '="' + decrypt(kyc.aadhaarNumber).toString().padStart(12, "0") + '"'
          : "",

        totalIncome: 0,
        incomeBreakdown: [],
        totalPaidAmount: 0,
        paidBreakdown: [],
        totalTds: 0,
        tdsBreakdown: [],
        paymentDates: [],
      };
    }

    const paidDate = new Date(p.createdAt).toLocaleDateString("en-IN");
    acc[uid].totalIncome += p.totalAmount;
    acc[uid].totalPaidAmount += p.netAmount;
    acc[uid].totalTds += p.tds.amount;
    acc[uid].incomeBreakdown.push(`${p.totalAmount} (${paidDate})`);
    acc[uid].paidBreakdown.push(`${p.netAmount} (${paidDate})`);
    acc[uid].tdsBreakdown.push(`${p.tds.amount} (${paidDate})`);
    acc[uid].paymentDates.push(paidDate);

    const code = p.userId.affiliateCode || "N/A";
    return acc;
  }, {});

  return Object.values(report);
};

// 📊 1. API: Preview report in browser (used for view only)
exports.getMonthlyTDSReport = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: "Month required" });

    const report = await getMonthlyTDSReport(month);
    res.json(report);
  } catch (err) {
    console.error("❌ getMonthlyTDSReport error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ⚙️ 2. Auto-cron based CSV generator (no response, only file save)
exports.generateMonthlyTDSCSV = async () => {
  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7); // e.g., "2025-07"

  const report = await getMonthlyTDSReport(monthStr);
  if (!report.length) return;

  const parser = new Parser({
    fields: [
      "name", "affiliateCode", "pan", "aadhaar", "totalIncome",
      "incomeBreakdown", "totalPaidAmount", "paidBreakdown",
      "totalTds", "tdsBreakdown", "paymentDates",
    ],
    quote: '"',
  });
  const csv = parser.parse(report);

  const folder = path.join(__dirname, "..", "downloads", "tds");
  fs.mkdirSync(folder, { recursive: true });

  const filePath = path.join(folder, `TDS-${monthStr}.csv`);
  fs.writeFileSync(filePath, csv);
  console.log(`✅ TDS CSV generated: ${filePath}`);
};

// 🖱️ 3. Admin-triggered manual CSV generation
exports.generateTDSCSVByMonth = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ message: "Month is required" });

    const report = await getMonthlyTDSReport(month);
    if (!report.length) return res.status(404).json({ message: "No data found for this month" });

    const parser = new Parser({
      fields: [
        "name", "affiliateCode", "pan", "aadhaar", "totalIncome",
        "incomeBreakdown", "totalPaidAmount", "paidBreakdown",
        "totalTds", "tdsBreakdown", "paymentDates",
      ],
      quote: '"',
    });
    const csv = parser.parse(report);

    const folder = path.join(__dirname, "..", "downloads", "tds");
    fs.mkdirSync(folder, { recursive: true });

    const fileName = `TDS-${month}.csv`;
    const filePath = path.join(folder, fileName);
    fs.writeFileSync(filePath, csv);

    res.json({ success: true, fileName });
  } catch (err) {
    console.error("❌ generateTDSCSVByMonth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📁 4. List all available TDS CSV files
exports.listTDSFiles = (req, res) => {
  const dir = path.join(__dirname, "..", "downloads", "tds");
  if (!fs.existsSync(dir)) return res.json([]);

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".csv"));
  const data = files.map(f => {
    const stats = fs.statSync(path.join(dir, f));
    const name = f.replace(".csv", "").replace("TDS-", "");
    return {
      fileName: f,
      month: name,
      generatedAt: stats.birthtime,
    };
  });

  res.json(data.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)));
};

// 📦 5. Download selected TDS file
exports.downloadTDSCSV = (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(__dirname, "..", "downloads", "tds", fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
  res.download(filePath);
};


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.exportInvoiceSheet = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const payments = await Payment.find({
      paidAt: { $gte: start, $lte: end },
    })
      .populate("user")
      .populate("forBundleCourseId")
      .lean();

    const verifiedRows = [];

    for (let p of payments) {
      const paymentId = p.razorpayPaymentId;
      if (!paymentId || paymentId.startsWith("MANUAL") || paymentId.startsWith("TEST")) continue;

      let razorpayData;
      try {
        razorpayData = await razorpay.payments.fetch(paymentId);
      } catch (err) {
        console.warn(`❌ Razorpay fetch failed for ${paymentId}:`, err?.error?.description || err?.message || err);
        continue;
      }

      if (razorpayData.status !== "captured") {
        console.log(`⛔ Payment ${paymentId} not captured, skipping.`);
        continue;
      }

      const user = p.user;
      const course = p.forBundleCourseId;
      if (!user || !course) continue;

      const price = p.amountPaid || 0;
      const taxableAmount = +(price / 1.18).toFixed(2);

      const isDelhi =
        (user.state && user.state.toLowerCase().includes("delhi")) ||
        (user.address && user.address.toLowerCase().includes("delhi"));

      const cgst = isDelhi ? +(taxableAmount * 0.09).toFixed(2) : 0;
      const sgst = isDelhi ? +(taxableAmount * 0.09).toFixed(2) : 0;
      const igst = !isDelhi ? +(taxableAmount * 0.18).toFixed(2) : 0;
      const totalAmount = +(taxableAmount + cgst + sgst + igst).toFixed(2);

      verifiedRows.push({
        "Invoice No.": user.affiliateCode || "-",
        "Invoice Date": new Date(p.paidAt).toLocaleDateString("en-IN"),
        "SAC Code": "9983",
        "Name": user.fullName || "-",
        "GST No.": "NA",
        "Place": user.state || "N/A",
        "Taxable Amount": taxableAmount,
        "CGST (9%)": cgst,
        "SGST (9%)": sgst,
        "IGST (18%)": igst,
        "Total Amount": totalAmount,
        "Tax %": "18%",
      });
    }

    if (verifiedRows.length === 0) {
      return res.status(404).json({ message: "No valid payments found for selected range" });
    }

    const ws = XLSX.utils.json_to_sheet(verifiedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");

    const fileName = `invoice-sheet-${fromDate}-to-${toDate}.xlsx`;
    const filePath = path.join(__dirname, "..", "downloads", "invoices", fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    XLSX.writeFile(wb, filePath);

    res.download(filePath, fileName);
  } catch (err) {
    console.error("❌ Invoice Export Error:", err);
    res.status(500).json({ message: "Failed to generate invoice sheet" });
  }
};

exports.listInvoiceFiles = async (req, res) => {
  try {
    const invoiceDir = path.join(__dirname, "..", "downloads", "invoices");

    if (!fs.existsSync(invoiceDir)) return res.status(200).json([]);

    const files = fs.readdirSync(invoiceDir).filter(f => f.endsWith(".xlsx"));

    const data = files.map((file) => {
      const filePath = path.join(invoiceDir, file);
      const stats = fs.statSync(filePath);
      return {
        fileName: file,
        url: `/downloads/invoices/${file}`,
        createdAt: stats.birthtime,
      };
    });

    res.status(200).json(data.reverse()); // most recent first
  } catch (err) {
    console.error("❌ Error listing invoice files:", err);
    res.status(500).json({ message: "Failed to fetch invoice files" });
  }
};

exports.deleteInvoiceOrPayoutFile = async (req, res) => {
  try {
    const { fileName } = req.body;
    const type = fileName.includes("invoice") ? "invoices" : "payouts";
    const filePath = path.join(__dirname, "..", "downloads", type, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.status(200).json({ message: `${type} file deleted` });
    } else {
      return res.status(404).json({ message: "File not found" });
    }
  } catch (err) {
    console.error("❌ File delete error:", err);
    res.status(500).json({ message: "Failed to delete file" });
  }
};


exports.createCampaign = async (req, res) => {
  try {
    const { campaign, startDate, endDate, milestones } = req.body;
    const data = await TargetMilestone.create({ campaign, startDate, endDate, milestones });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to create campaign", error: err.message });
  }
};

exports.getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await TargetMilestone.find({ isActive: true }).sort({ campaign: 1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch campaigns", error: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    await TargetMilestone.findByIdAndDelete(req.params.id);
    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};


exports.getAdminDashboardStats = async (req, res) => {
  try {
    const { filter } = req.query;

    let startDate = new Date();
    switch (filter) {
      case "weekly":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "monthly":
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const [dbPayments, payouts] = await Promise.all([
      Payment.find({ createdAt: { $gte: startDate }, status: "captured" }),
      Payout.find({ createdAt: { $gte: startDate }, status: "paid" }),
    ]);

    let totalEarning = 0;
    let verifiedUnits = 0;

    for (const dbPayment of dbPayments) {
      const { razorpayOrderId, razorpayPaymentId, amountPaid } = dbPayment;

      if (!razorpayOrderId || !razorpayPaymentId) continue;

      try {
        // Fetch all payments under this order
        const orderPayments = await razorpay.orders.fetchPayments(razorpayOrderId);

        const verified = orderPayments.items.find(
          (p) => p.id === razorpayPaymentId && p.status === "captured"
        );

        if (verified) {
          totalEarning += amountPaid || 0;
          verifiedUnits += 1;
        }
      } catch (err) {
        console.warn(`❌ Razorpay check failed for order ${razorpayOrderId}`);
      }
    }

    const payout = payouts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const gst = parseFloat((totalEarning * 0.18).toFixed(2));
    const tds = parseFloat((totalEarning * 0.02).toFixed(2));
    const profit = parseFloat((totalEarning - gst - tds - payout).toFixed(2));

    res.json({
      earning: totalEarning,
      units: verifiedUnits,
      payout,
      gst,
      tds,
      profit,
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};



exports.exportDashboardCSV = async (req, res) => {
  try {
    const { filter } = req.query;
    let startDate = new Date();
    switch (filter) {
      case "weekly":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "monthly":
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const payments = await Payment.find({ createdAt: { $gte: startDate }, status: "success" });
    const enrollments = await Enrollments.find({ createdAt: { $gte: startDate }, status: "active" });
    const payouts = await Payout.find({ createdAt: { $gte: startDate }, status: "paid" });

    const earning = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const units = enrollments.length;
    const payout = payouts.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const tds = payouts.reduce((sum, p) => sum + (p.tds?.amount || 0), 0);
    const gst = parseFloat((earning * 0.18).toFixed(2));
    const profit = earning - payout - gst - tds;

    const fields = ["Date Range", "Earning", "Units", "Payout", "GST", "TDS", "Profit"];
    const parser = new Parser({ fields });
    const csv = parser.parse([
      {
        "Date Range": `${startDate.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`,
        Earning: earning,
        Units: units,
        Payout: payout,
        GST: gst,
        TDS: tds,
        Profit: profit,
      },
    ]);

    res.header("Content-Type", "text/csv");
    res.attachment(`stravix-dashboard-${filter}.csv`);
    res.send(csv);
  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).json({ message: "Failed to export CSV" });
  }
};


// 📊 Sales & Profit Summary (Admin Dashboard)
exports.getSalesSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const end = to ? new Date(to) : new Date();

    // 1️⃣ Fetch Razorpay captured payments
    const payments = await Payment.find({
      status: "captured",
      createdAt: { $gte: start, $lte: end }
    }).lean();

    // 2️⃣ Aggregate
    const summary = payments.map(p => {
      const totalSale = p.amountPaid;
      const gst = +(totalSale * 0.18).toFixed(2);
      const tds = +(totalSale * 0.02).toFixed(2);
      const payout = totalSale - tds;
      const profit = totalSale - gst - tds;

      const date = new Date(p.createdAt);
      return {
        month: date.toLocaleString("default", { month: "long" }),
        week: `W${Math.ceil(date.getDate() / 7)}`,
        date: date.toLocaleDateString("en-IN"),
        day: date.toLocaleDateString("en-IN", { weekday: "long" }),
        totalSale,
        gst,
        tds,
        payout,
        profit
      };
    });

    res.json(summary);
  } catch (err) {
    console.error("❌ getSalesSummary error:", err);
    res.status(500).json({ message: "Failed to fetch sales summary" });
  }
};