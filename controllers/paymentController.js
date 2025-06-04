const crypto = require("crypto");
const Payment = require("../models/Payment");
const Enrollment = require("../models/Enrollments");
const Commission = require("../models/Commissions");
const Course = require("../models/Course");
const User = require("../models/User");
const Leads = require("../models/Leads");

// ✅ Initiate Payment
exports.initiatePayment = async (req, res) => {
  try {
    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { amount, courseId, forBundleCourseId } = req.body;

    if (!amount || !courseId) {
      return res.status(400).json({ message: "Amount and Course ID are required." });
    }

    const order = await razorpay.orders.create({
      amount: Math.floor(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    await Payment.create({
      user: req.user._id,
      course: courseId,
      forBundleCourseId: forBundleCourseId || courseId,
      amountPaid: amount,
      razorpayOrderId: order.id,
      status: "created",
      paidAt: new Date(),
    });

    res.status(201).json({ order });
  } catch (err) {
    console.error("❌ Payment initiation error:", err);
    res.status(500).json({ message: "Something went wrong during payment initiation" });
  }
};

// ✅ Razorpay Webhook Handler
exports.verifyPayment = async (req, res) => {
  try {
    const raw = req.body.toString("utf8");
    const parsed = JSON.parse(raw);

    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const data = parsed.payload.payment.entity;
    const { id, order_id, status, currency, method } = data;

    const alreadyProcessed = await Payment.findOne({ razorpayPaymentId: id });
    if (alreadyProcessed) {
      return res.status(200).json({ message: "Already processed" });
    }

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: order_id },
      {
        razorpayPaymentId: id,
        status,
        currency,
        paymentMethod: method,
        gatewayDetails: data,
        paidAt: new Date(),
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Enroll User
    await Enrollment.create({
      userId: payment.user,
      courseId: payment.course,
      forBundleCourseId: payment.course,
      paymentId: payment._id,
      status: "active",
    });

    await User.findByIdAndUpdate(payment.user, {
      $push: {
        enrolledCourses: {
          course: payment.course,
          progress: 0,
        },
      },
    });

    // Referral Commission
    const user = await User.findById(payment.user);
    if (user?.sponsorCode) {
      const sponsor = await User.findOne({ affiliateCode: user.sponsorCode });
      if (sponsor) {
        const course = await Course.findById(payment.course);
        const commissionAmount = Math.floor(
          (course.affiliateCommissionPercent / 100) * payment.amountPaid
        );

        await Commission.create({
          userId: sponsor._id,
          referralUser: user._id,
          amount: commissionAmount,
          bundleCourseId: payment.forBundleCourseId,
          transactionId: payment._id,
        });

        sponsor.referralEarnings += commissionAmount;
        await sponsor.save();

        await User.updateOne(
          { _id: sponsor._id, "industryEarnings.label": "Affiliate Marketing" },
          { $inc: { "industryEarnings.$.currentTotal": commissionAmount } }
        );
      }

      await Leads.findOneAndUpdate(
        { leadUserId: user._id },
        { status: "converted", updatedAt: new Date() },
        { new: true }
      );
    }

    res.status(200).json({ message: "Payment verified and enrollment successful" });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

// ✅ Get logged-in user's payments
exports.getUserPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

// ✅ Admin: Get all payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("user course")
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all payments" });
  }
};

// ✅ Admin: Get one payment
exports.getPaymentDetails = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate("user course");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payment detail" });
  }
};

// ✅ Admin: Mock refund
exports.processRefund = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.status = "refunded";
    await payment.save();

    res.json({ message: "Refund processed", payment });
  } catch (err) {
    res.status(500).json({ message: "Refund failed" });
  }
};
