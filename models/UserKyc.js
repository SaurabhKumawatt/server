const mongoose = require("mongoose");

const userKycSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            unique: true, 
            required: true 
        },
        accountHolderName: { 
            type: String, 
            required: true 
        },
        accountNumber: { 
            type: String, 
            required: true 
        },
        bankName: { 
            type: String, 
            required: true 
        },
        ifscCode: { 
            type: String, 
            required: true 
        },
        branch: { 
            type: String, 
            default: null,
            required: true 
        },
        upiId: { 
            type: String, 
            default: null,
            required: true 
        },
        aadhaarNumber: { 
            type: String, 
            unique: true, 
            required: true 
        },
        aadhaarFrontImage: { 
            type: String, 
            required: true 
        },
        aadhaarBackImage: { 
            type: String, 
            required: true 
        },

        panCard: {
             type: String, 
             unique: true, 
             required: true 
            },
        panProofImage: { 
            type: String, 
            required: true 
        },
        kycStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: 'pending'
        },
        verifiedAt: { 
            type: Date, 
            default: null 
        },
        updatedAt: { 
            type: Date, 
            default: Date.now 
        },
        rejectionReason: { 
            type: String, 
            default: null 
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("UserKyc", userKycSchema);