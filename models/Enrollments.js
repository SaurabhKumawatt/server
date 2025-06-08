const mongoose = require("mongoose");

const enrollmentsSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        }, 
        courseId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Course', 
            required: true
        },
        progress: { 
            type: Number, 
            min: 0, max: 100, 
            default: 0 
        },
        enrollDate: { 
            type: Date, 
            default: Date.now 
        }, 
        paymentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Payment', 
            required: true 
        },

        status: {
            type: String,
            enum: ['active', 'completed', 'cancelled', 'refunded', 'pending'], 
            default: 'pending' 
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

enrollmentsSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model("Enrollments", enrollmentsSchema);