// models/TripRegistration.js
const mongoose = require("mongoose");

const tripRegistrationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        campaignName: { type: String, default: "StraviX Success Meet - 2025" },
        whatsappNumber: { type: String, required: true },
        aadhaarFrontUrl: { type: String, },
        aadhaarBackUrl: { type: String,},

        price: { type: Number, default: 5000 },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        paymentStatus: {
            type: String,
            enum: ["created", "captured", "failed"],
            default: "created",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Registration", tripRegistrationSchema);
