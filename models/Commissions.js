const mongoose = require("mongoose");

const commissionsSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            // required: true 
        },
        referralUser: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            // default: null
        },
        amount: { 
            type: Number, 
            required: true, 
            min: 0 
        },
        bundleCourseId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Course', 
            // default: null 
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'unpaid',  'paid', 'cancelled'],
            default: 'pending'
        },
        transactionId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Payment', 
            required: true 
        },
        paymentSuccess: { 
            type: Boolean, 
            default: true 
        },
        createdAt: { 
            type: Date, 
            default: Date.now },
        updatedAt: { 
            type: Date, 
            default: Date.now 
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Commissions", commissionsSchema);