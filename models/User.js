const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
        },
        role: {
            type: String,
            enum: ["student", "affiliate", "admin"],
            default: "student",
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        kycStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "",
        },
        stravixId: {
            type: String,
            default: "STX0000123", // you can customize this format dynamically
        },
        affiliateCode: {
            type: String,
            unique: true,
            sparse: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        referralEarnings: {
            type: Number,
            default: 0,
        },
        profileImage: {
            type: String,
            default: "",
        },
        enrolledCourses: [
            {
                course: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Course",
                },
                progress: {
                    type: Number,
                    default: 0, // 0–100%
                },
            }
        ],

    },
    {
        timestamps: true,
    }
);

// Encrypt password before save
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
    const result = await bcrypt.compare(enteredPassword, this.password);
    console.log("🔐 Password Match:", result);
    return result;
};
module.exports = mongoose.model("User", userSchema);
