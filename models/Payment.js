const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      required: false,
      sparse: true
    },
    razorpayOrderId: {
      type: String,
      unique: true,
      required: true,
    },
    amountPaid: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, required: false }, // e.g., 'card', 'upi', 'netbanking', 'wallet'
    status: {
      type: String,
      enum: ['authorized', 'captured', 'failed', 'refunded', 'created'], // Common Razorpay statuses
      required: true
    },
    paidAt: {
      type: Date,
      required: true
    },
    razorpayRefundIds: [{ type: String }],
    gatewayDetails: {
      type: Object,
      default: {},
      // Example sub-fields from Razorpay webhook/response (store only what's necessary)
      // method_details: {
      //   card: { last4: String, network: String, type: String },
      //   upi: { vpa: String },
      //   netbanking: { bank: String }
      // }
    },
    forBundleCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    relatedCommissions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commissions'
    }],

    remarks: {
      type: String,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);