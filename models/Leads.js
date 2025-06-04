const mongoose = require("mongoose");

const leadsSchema = new mongoose.Schema(
    {
        referralId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        },
        leadUserId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            default: null 
        },
        bundleCourseId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Course', 
            default: null 
        },
        type: { 
            type: String, 
            default: 'referral' 
        },
        name: { 
            type: String, 
            required: true 
        },
        email: { 
            type: String, 
            default: null 
        },
        mobile: { 
            type: String, 
            default: null 
        },
        affiliated: { 
            type: Boolean, 
            default: false 
        },
        status: {
            type: String,
            enum: ['new', 'contacted', 'converted', 'rejected'],
            default: 'new'
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

module.exports = mongoose.model("Leads", leadsSchema);