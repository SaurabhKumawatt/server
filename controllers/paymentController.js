const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Enrollment = require("../models/Enrollments");
const Commission = require("../models/Commissions");
const Course = require("../models/Course");
const User = require("../models/User");
const Leads = require("../models/Leads");



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Initiate Payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, courseId, forBundleCourseId } = req.body;

    console.log("📥 Received initiatePayment request:", req.body);

    if (!amount || !courseId) {
      return res.status(400).json({ message: "Amount and Course ID are required." });
    }

    const order = await razorpay.orders.create({
      amount: Math.floor(amount * 100), // Razorpay requires integer paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    await Payment.create({
      user: req.user._id,
      course: courseId,
      forBundleCourseId: forBundleCourseId || courseId, // use fallback
      amountPaid: amount,
      razorpayOrderId: order.id,
      status: "created",
      paidAt: new Date()
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
    console.log("📩 Razorpay Webhook received");

    const parsed = req.body;

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("❌ Invalid Razorpay Signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const data = parsed.payload.payment.entity;
    const { id, order_id, status, currency, method } = data;

    const alreadyProcessed = await Payment.findOne({ razorpayPaymentId: id });
    if (alreadyProcessed) return res.status(200).json({ message: "Already processed" });

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

    if (!payment) return res.status(404).json({ message: "Payment record not found" });

    const user = await User.findById(payment.user);
    const purchasedBundle = await Course.findById(payment.forBundleCourseId);

    console.log("🎓 Enrolling user:", user.username, "in bundle:", purchasedBundle.title);

    const existing = await Enrollment.findOne({
      userId: user._id,
      courseId: purchasedBundle._id,
    });

    if (!existing) {
      await Enrollment.create({
        userId: user._id,
        courseId: purchasedBundle._id,
        forBundleCourseId: payment.forBundleCourseId,
        paymentId: payment._id,
        status: "active",
      });

      await User.findByIdAndUpdate(user._id, {
        $push: { enrolledCourses: { course: purchasedBundle._id, progress: 0 } },
      });

      console.log("✅ Main bundle enrolled:", purchasedBundle.title);
    }

    const allBundles = await Course.find({ isBundle: true, status: "published" }).sort({ price: 1 });
    const bundlesToEnroll = allBundles.filter(b => b.price <= purchasedBundle.price);

    const freshUser = await User.findById(user._id);
    const alreadyEnrolled = new Set(freshUser.enrolledCourses.map(c => c.course.toString()));

    for (const bundle of bundlesToEnroll) {
      if (!alreadyEnrolled.has(bundle._id.toString())) {
        await Enrollment.create({
          userId: user._id,
          courseId: bundle._id,
          forBundleCourseId: payment.forBundleCourseId,
          paymentId: payment._id,
          status: "active",
        });

        await User.findByIdAndUpdate(user._id, {
          $push: { enrolledCourses: { course: bundle._id, progress: 0 } },
        });

        console.log(`🎁 Auto-enrolled into lower bundle: ${bundle.title} (₹${bundle.price})`);
      }
    }

    if (user?.sponsorCode) {
      const sponsor = await User.findOne({ affiliateCode: user.sponsorCode });

      if (sponsor) {
        const sponsorEnrollments = await Enrollment.find({ userId: sponsor._id }).populate("courseId");

        const sponsorBundles = sponsorEnrollments
          .filter(e => e.courseId?.isBundle)
          .map(e => e.courseId.price);

        const sponsorMaxPrice = sponsorBundles.length > 0 ? Math.max(...sponsorBundles) : 0;
        const referredBundlePrice = purchasedBundle.price;

        const commissionBase = Math.min(sponsorMaxPrice, referredBundlePrice);
        const commissionPercent = purchasedBundle.affiliateCommissionPercent || 0;
        const commissionAmount = Math.floor((commissionPercent / 100) * commissionBase);

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

        console.log(`💸 Commission of ₹${commissionAmount} credited to ${sponsor.username} (Max allowed: ₹${sponsorMaxPrice})`);
      }

      await Leads.findOneAndUpdate(
        { leadUserId: user._id },
        { status: "converted", updatedAt: new Date() }
      );

      console.log(`🔁 Lead status updated for referral of ${user.username}`);
    }

    res.status(200).json({ message: "✅ Payment verified and user enrolled in eligible bundles." });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};




// ✅ Get all payments for user
exports.getUserPayments = async (req, res) => {
  const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(payments);
};

// ✅ Admin: All payments
exports.getAllPayments = async (req, res) => {
  const payments = await Payment.find().populate("user course").sort({ createdAt: -1 });
  res.json(payments);
};

// ✅ Admin: Payment details
exports.getPaymentDetails = async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate("user course");
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  res.json(payment);
};

// ✅ Admin: Refund handler (Mock)
exports.processRefund = async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found" });

  payment.status = "refunded";
  await payment.save();

  res.json({ message: "Refund processed", payment });
};
