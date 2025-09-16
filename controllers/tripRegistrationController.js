// controllers/tripRegistrationController.js
const TripRegistration = require("../models/Registration");
const User = require("../models/User");
const Razorpay = require("razorpay");
const { sendTripSuccessEmail } = require("../utils/email"); // <-- अपना email utility use करो

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY2_KEY_ID,
    key_secret: process.env.RAZORPAY2_KEY_SECRET,
});

// ✅ Autofill user by affiliateCode
exports.getUserByAffiliate = async (req, res) => {
    try {
        const { affiliateCode } = req.params;
        const user = await User.findOne({ affiliateCode }).select(
            "fullName email mobileNumber affiliateCode"
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        console.error("getUserByAffiliate error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ✅ Register trip + create Razorpay order
exports.registerTrip = async (req, res) => {
    try {
        const { userId, whatsappNumber } = req.body;

        const order = await razorpay.orders.create({
            amount: 5000 * 100, // ₹5000
            currency: "INR",
            payment_capture: 1,
        });

        const trip = await TripRegistration.create({
            userId,
            whatsappNumber,
            price: 5000,
            razorpayOrderId: order.id,
            paymentStatus: "created",
        });

        res.status(201).json({ order, trip });
    } catch (err) {
        console.error("registerTrip error:", err);
        res.status(500).json({ message: "Failed to register trip" });
    }
};

// ✅ Webhook (payment verify + send mail)
exports.verifyTripPayment = async (req, res) => {
    try {
        const payload = req.body;
        const { order_id, payment_id, status } = payload.payload.payment.entity;

        const trip = await TripRegistration.findOneAndUpdate(
            { razorpayOrderId: order_id },
            { razorpayPaymentId: payment_id, paymentStatus: status },
            { new: true }
        ).populate("userId", "fullName email");

        if (!trip) return res.status(404).json({ message: "Trip not found" });

        // ✅ Send confirmation email only if payment captured
        if (status === "captured") {
            await sendTripSuccessEmail({
                to: trip.userId.email,
                fullName: trip.userId.fullName,
            });
        }

        res.json({ message: "Payment updated", trip });
    } catch (err) {
        console.error("verifyTripPayment error:", err);
        res.status(500).json({ message: "Failed to verify trip payment" });
    }
};

// ✅ Admin - Get all paid registrations
exports.getAllTripRegistrations = async (req, res) => {
    try {
        const trips = await TripRegistration.find({ paymentStatus: "captured" })
            .populate("userId", "fullName email mobileNumber affiliateCode");
        res.json(trips);
    } catch (err) {
        console.error("getAllTripRegistrations error:", err);
        res.status(500).json({ message: "Failed to fetch trips" });
    }
};


// controllers/tripRegistrationController.js
exports.checkUserTrip = async (req, res) => {
  try {
    const { userId } = req.params;
    const trip = await TripRegistration.findOne({
      userId,
      paymentStatus: "captured",
    });

    if (trip) {
      return res.json({ registered: true, trip });
    } else {
      return res.json({ registered: false });
    }
  } catch (err) {
    console.error("checkUserTrip error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

