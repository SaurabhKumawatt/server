const crypto = require("crypto");
const Payment = require("../models/Payment");
const Enrollment = require("../models/Enrollments");
const Commission = require("../models/Commissions");
const Course = require("../models/Course");
const User = require("../models/User");
const Leads = require("../models/Leads");
const { validationResult } = require("express-validator");
const { log } = require("console");

// ✅ Initiate Payment
exports.initiatePayment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
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

// ✅ Razorpay Webhook Handler with lower-tier bundle auto-enroll
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

    await User.findByIdAndUpdate(payment.user, {
      role: "paid-affiliate",
    });

    // 🎯 Get main course and its related lower bundles
    const mainCourse = await Course.findById(payment.course).lean();
    const courseIdsToEnroll = [mainCourse._id.toString(), ...(mainCourse.relatedBundleIds || []).map(id => id.toString())];

    // 🔄 Avoid duplicate enrollments
    const alreadyEnrolled = await Enrollment.find({
      userId: payment.user,
      courseId: { $in: courseIdsToEnroll }
    }).select("courseId");

    const alreadyEnrolledIds = new Set(alreadyEnrolled.map(e => e.courseId.toString()));
    const newEnrollments = courseIdsToEnroll.filter(id => !alreadyEnrolledIds.has(id));

    // ✅ Enroll in main + lower bundles
    for (const courseId of newEnrollments) {
      await Enrollment.create({
        userId: payment.user,
        courseId,
        paymentId: payment._id,
        status: "active",
      });
      await User.updateOne(
        { _id: payment.user, "enrolledCourses.course": { $ne: courseId } },
        {
          $push: {
            enrolledCourses: { course: courseId, progress: 0 },
          },
        }
      );

      // await User.findByIdAndUpdate(payment.user, {
      //   $push: {
      //     enrolledCourses: { course: courseId, progress: 0 },
      //   },
      // });
      await Course.findByIdAndUpdate(courseId, {
        $inc: { learnersEnrolled: 1 }
      });

    }


    // ✅ Also enroll in relatedCourses of lower bundles
    for (const lowerBundleId of mainCourse.relatedBundleIds || []) {
      const lowerBundle = await Course.findById(lowerBundleId).populate("relatedCourses");

      if (!lowerBundle) {
        console.log("❌ Lower bundle not found:", lowerBundleId);
        continue;
      }

      if (!lowerBundle.relatedCourses || lowerBundle.relatedCourses.length === 0) {
        console.log(`⚠️ No relatedCourses for lower bundle: ${lowerBundle.title || lowerBundle._id}`);
        continue;
      }

      console.log(`📦 Lower bundle "${lowerBundle.title}" has sub-courses:`, lowerBundle.relatedCourses.map(c => c.title || c._id));

      for (const subCourse of lowerBundle.relatedCourses) {
        const subAlready = await Enrollment.findOne({
          userId: payment.user,
          courseId: subCourse._id,
        });

        if (subAlready) {
          console.log(`🟡 Already enrolled in sub-course of lower bundle: ${subCourse.title || subCourse._id}`);
          continue;
        }

        await Enrollment.create({
          userId: payment.user,
          courseId: subCourse._id,
          paymentId: payment._id,
          status: "active",
        });

        await User.updateOne(
          { _id: payment.user, "enrolledCourses.course": { $ne: subCourse._id } },
          {
            $push: {
              enrolledCourses: { course: subCourse._id, progress: 0 },
            },
          }
        );

        // await User.findByIdAndUpdate(payment.user, {
        //   $push: {
        //     enrolledCourses: { course: subCourse._id, progress: 0 },
        //   },
        // });

        await Course.findByIdAndUpdate(subCourse._id, {
          $inc: { learnersEnrolled: 1 },
        });

        console.log(`✅ Enrolled in sub-course of lower bundle: ${subCourse.title || subCourse._id}`);
      }
    }



    // ✅ Also enroll in all sub-courses (relatedCourses)
    console.log("🔍 [RelatedCourses] Fetching sub-courses for course:", payment.course);

    const bundleWithSubs = await Course.findById(payment.course).populate("relatedCourses");

    if (!bundleWithSubs) {
      console.log("❌ Bundle course not found with ID:", payment.course);
    } else if (!bundleWithSubs.relatedCourses || bundleWithSubs.relatedCourses.length === 0) {
      console.log("⚠️ No relatedCourses found in bundle:", bundleWithSubs.title || bundleWithSubs._id);
    } else {
      console.log("📦 Sub-courses to enroll:", bundleWithSubs.relatedCourses.map(c => c.title || c._id));

      for (const subCourse of bundleWithSubs.relatedCourses) {
        const subAlready = await Enrollment.findOne({
          userId: payment.user,
          courseId: subCourse._id
        });

        if (subAlready) {
          console.log(`🟡 Already enrolled: ${subCourse.title || subCourse._id}`);
          continue;
        }

        await Enrollment.create({
          userId: payment.user,
          courseId: subCourse._id,
          paymentId: payment._id,
          status: "active",
        });
        await User.updateOne(
          { _id: payment.user, "enrolledCourses.course": { $ne: subCourse._id } },
          {
            $push: {
              enrolledCourses: { course: subCourse._id, progress: 0 },
            },
          }
        );

        // await User.findByIdAndUpdate(payment.user, {
        //   $push: {
        //     enrolledCourses: { course: subCourse._id, progress: 0 },
        //   },
        // });

        await Course.findByIdAndUpdate(subCourse._id, {
          $inc: { learnersEnrolled: 1 },
        });

        console.log(`✅ Enrolled in sub-course: ${subCourse.title || subCourse._id}`);
      }
    }





    // 💸 Commission (only on main bundle)
    const user = await User.findById(payment.user);
    if (user?.sponsorCode) {
      const sponsor = await User.findOne({ affiliateCode: user.sponsorCode });
      if (sponsor) {
        const course = await Course.findById(payment.course);
        const allBundles = await Course.find({ isBundle: true }).sort({ price: 1 });

        const sponsorEnrollments = await Enrollment.find({
          userId: sponsor._id,
          courseId: { $in: allBundles.map(b => b._id) },
        });

        let referrerBundle = null;
        for (let b of allBundles) {
          if (sponsorEnrollments.find(e => e.courseId.toString() === b._id.toString())) {
            referrerBundle = b;
          }
        }

        let commissionAmount;

        if (!referrerBundle) {
          // sponsor has no bundle → use current course commission normally
          const percent = parseFloat(course.affiliateCommissionPercent.toString());
          commissionAmount = Math.floor((percent / 100) * payment.amountPaid);
          
        } else {
          const sponsorPrice = referrerBundle.discountedPrice;
          
          const sponsorPercent = parseFloat(referrerBundle.affiliateCommissionPercent.toString());
          const coursePrice = course.discountedPrice;
          const coursePercent = parseFloat(course.affiliateCommissionPercent.toString());

          if (coursePrice <= sponsorPrice) {
            // selling same or lower bundle → use course % on course price
            commissionAmount = Math.floor((coursePercent / 100) * payment.amountPaid);
            
          } else {
            // selling higher bundle → use sponsor’s own bundle % on their bundle price
            commissionAmount = Math.floor((sponsorPercent / 100) * sponsorPrice);
          }
        }

        await Commission.create({
          userId: sponsor._id,
          referralUser: user._id,
          amount: commissionAmount,
          bundleCourseId: payment.forBundleCourseId,
          transactionId: payment._id,
        });

        // 🔄 Update industry earnings
        const industryLabel = "Affiliate Marketing";
        const existingIndex = sponsor.industryEarnings.findIndex(
          (entry) => entry.label === industryLabel
        );

        if (existingIndex !== -1) {
          sponsor.industryEarnings[existingIndex].currentTotal += commissionAmount;
        } else {
          sponsor.industryEarnings.push({
            label: industryLabel,
            initialAmount: commissionAmount,
            currentTotal: commissionAmount
          });
        }

        await sponsor.save();
      }

      const updatedLead = await Leads.findOneAndUpdate(
        { leadUserId: user._id },
        { status: "converted", updatedAt: new Date() },
        { new: true }
      );

      if (!updatedLead) {
        console.log("❌ Lead not found for user:", user._id);
      } else {
        console.log("✅ Lead updated:", updatedLead.status);
      }
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
