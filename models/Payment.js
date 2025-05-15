// const mongoose = require("mongoose");

// const paymentSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     course: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Course",
//       required: true,
//     },
//     amountPaid: {
//       type: Number,
//       required: true,
//     },
//     paymentStatus: {
//       type: String,
//       enum: ["success", "failed", "pending"],
//       default: "pending",
//     },
//     paymentMethod: {
//       type: String,
//       enum: ["razorpay", "stripe", "upi", "manual"],
//       required: true,
//     },
//     transactionId: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     paymentDate: {
//       type: Date,
//       default: Date.now,
//     },
//     affiliate: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null, // if user was referred
//     },
//     affiliateCommissionEarned: {
//       type: Number,
//       default: 0,
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Payment", paymentSchema);
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    transactionId: { type: String, required: true },
    screenshotUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // set auto approved here
    },
    paymentMethod: { type: String, default: "manual" },
    amountPaid: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
