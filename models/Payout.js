const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    commissionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commissions',
        required: true,
      }
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Payout amount cannot be negative"],
    },

    tds: {
      amount: {
        type: Number,
        default: 0,
        min: [0, "TDS amount cannot be negative"],
      },
      percent: {
        type: Number,
        default: 2, // Default 2% TDS
        min: [0, "TDS percent cannot be negative"],
        max: [100, "TDS percent cannot exceed 100"],
      },
    },

    netAmount: {
      type: Number,
      default: 0,
      min: [0, "Net payout amount cannot be negative"],
    },

    beneficiaryName: {
      type: String,
      required: [true, "Beneficiary name is required"],
      trim: true,
    },

    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      minlength: 9,
      maxlength: 20,
      match: [/^\d+$/, "Account number must be numeric"],
    },

    ifscCode: {
      type: String,
      required: [true, "IFSC code is required"],
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format"],
    },

    transactionType: {
      type: String,
      default: "NEFT",
      enum: ["NEFT", "IMPS", "RTGS"],
    },

    transactionDate: {
      type: Date,
      default: null,
    },

    utrNumber: {
      type: String,
      default: null,
      trim: true,
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 300,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "paid", "unpaid", "failed"],
      default: "pending",
    },

    errors: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

payoutSchema.index({ userId: 1, status: 1 });
payoutSchema.index({ transactionDate: 1 });

module.exports = mongoose.model("Payout", payoutSchema);
