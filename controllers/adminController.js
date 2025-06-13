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

      const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);

      await Commissions.updateMany(
        { _id: { $in: commissions.map((c) => c._id) } },
        { $set: { status: "approved" } }
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

      console.log("✅ KYC Details:", {
        accountHolderName: kyc.accountHolderName,
        accountNumber: kyc.accountNumber,
        ifscCode: kyc.ifscCode,
      });

      const pastUnpaid = await Commissions.aggregate([
        {
          $match: {
            userId: userId,
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

      const unpaidAmount = pastUnpaid[0]?.unpaid || 0;
      const remarks = unpaidAmount > 0 ? `last week payout pending: ₹${unpaidAmount}` : "";

      // ✅ Include commissionIds when creating payout
      await Payout.create({
        userId,
        commissionIds: commissions.map(c => c._id), // <-- ✅ critical
        beneficiaryName: kyc.accountHolderName,
        accountNumber: kyc.accountNumber,
        ifscCode: kyc.ifscCode,
        totalAmount: totalAmount,
        status: "approved",
        transactionType: "NEFT",
        remarks,
        fromDate: start,
        toDate: end,
      });

      rows.push({
        "Beneficiary Name": kyc.accountHolderName,
        "Beneficiary Account Number": kyc.accountNumber,
        IFSC: kyc.ifscCode,
        "Transaction Type": "NEFT",
        Amount: totalAmount,
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
      lines.slice(1).forEach((line, index) => {
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
        totalAmount: { $gte: amount - 0.01, $lte: amount + 0.01 },
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
      payout.status = status.toLowerCase() === "success" ? "paid" : "unpaid";
      payout.remarks = status.toLowerCase() === "success" ? "✅ Payout completed" : (errors || "❌ Bank error");

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
