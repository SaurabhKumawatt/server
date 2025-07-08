const mongoose = require("mongoose");

const brandingKitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ Input fields from user
    fullName: { type: String, required: true },
    niches: [{ type: String, required: true }], // max 3
    occupation: { type: String, required: true },
    achievements: { type: String },
    preferredColors: [{ type: String, required: true }], // min 3 color codes

    // ✅ AI/DB generated content
    usernameSuggestions: [{ type: String }],
    optimizedName: { type: String }, // e.g., Saurabh Kumawat | Digital Entrepreneur
    bio: { type: String },

    colorPalette: [{ type: String }], // final color palette from AI
    highlightCoverNote: { type: String },
    highlightCoverLink: { type: String }, // Canva/Cloudinary

    captionTemplates: [{ type: String }],
    affiliateElements: {
      taglines: [{ type: String }],
      logos: [{ type: String }], // cloud image URLs
      phrases: [{ type: String }],
    },

    contentIdeas: [{ type: String }],

    // ⚙️ Control fields
    watermark: {
      type: Boolean,
      default: true,
    },
    regenerateCount: {
      type: Number,
      default: 0,
      max: 3,
    },
    shareableId: {
      type: String,
      required: true,
      unique: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrandingKit", brandingKitSchema);
