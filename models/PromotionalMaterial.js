const mongoose = require("mongoose");
const slugify = require("slugify");

const promotionalMaterialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PromotionalMaterial",
      default: null,
    },

    type: {
      type: String,
      enum: ["folder", "video", "image"],
      default: "folder",
    },

    thumbnail: {
      type: String,
      trim: true,
    },

    url: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["published", "draft"],
      default: "published",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔁 Auto-generate slug before save
promotionalMaterialSchema.pre("validate", async function (next) {
  if (!this.slug && this.title) {
    const baseSlug = slugify(this.title, { lower: true, strict: true });
    let slug = baseSlug;
    let count = 1;

    while (await mongoose.models.PromotionalMaterial.findOne({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    this.slug = slug;
  }

  next();
});

promotionalMaterialSchema.index({ slug: 1 });

module.exports = mongoose.model("PromotionalMaterial", promotionalMaterialSchema);
