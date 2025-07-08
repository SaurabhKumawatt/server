// /server/middleware/cloudinaryUpload.js
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const cloudinary = require("../utils/cloudinary");

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "stravix-profile",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

const thumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "stravix-thumbnails",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 1280, crop: "limit" }],
  },
});

const trainingThumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "trainings",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 450, crop: "fill" }],
  },
});
const webinarThumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "stravix/webinars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    // ❌ No transformation for original quality
  },
});


const promoMaterialStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "promo-materials",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});



exports.uploadTrainingThumbnail = multer({ storage: trainingThumbnailStorage });
exports.uploadProfileImage = multer({ storage: profileStorage });
exports.uploadThumbnailImage = multer({ storage: thumbnailStorage });
exports.uploadWebinarThumbnail = multer({ storage: webinarThumbnailStorage });
exports.uploadPromotionalThumbnail = multer({ storage: promoMaterialStorage });
