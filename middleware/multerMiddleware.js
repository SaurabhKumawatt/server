const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Create upload folder if it doesn't exist
const getStorage = (folderName) => {
  const dir = path.join("uploads", folderName);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload folder: ${dir}`);
  }

  return multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      console.log("📦 Saving file with extension:", ext);
      cb(null, uniqueName);
    },
  });
};

// ✅ Only allow safe image file types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];
  const allowedExt = [".jpeg", ".jpg", ".png", ".webp"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeOk = allowedMimeTypes.includes(file.mimetype);
  const isExtOk = allowedExt.includes(ext);

  if (isMimeOk && isExtOk) {
    return cb(null, true);
  }

  cb(new Error("❌ Invalid file type. Only JPEG, PNG, JPG, or WEBP images allowed."));
};

// ✅ Export folder-specific multer instance
exports.uploadTo = (folderName) => {
  return multer({
    storage: getStorage(folderName),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
};
