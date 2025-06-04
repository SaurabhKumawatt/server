const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        },
        commissionId: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Commissions', 
            required: true 
        }],
        amount: { 
            type: Number, required: 
            true, min: 0 
        },
        bundleCourseId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Course', 
            default: null 
        },
        paidAt: { 
            type: Date, 
            default: Date.now 
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'cancelled'],
            default: 'pending'
        },
        gatewayTransactionId: { 
            type: String, 
            default: null 
        },
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

module.exports = mongoose.model("Payout", payoutSchema);