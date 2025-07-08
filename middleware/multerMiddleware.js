const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 🔧 Create folder if not exists
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
      cb(null, uniqueName);
    },
  });
};

// ✅ Filter for image files
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];
  const allowedExt = [".jpeg", ".jpg", ".png"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeOk = allowedMimeTypes.includes(file.mimetype);
  const isExtOk = allowedExt.includes(ext);

  if (isMimeOk && isExtOk) {
    return cb(null, true);
  }

  cb(new Error("❌ Invalid image file type."));
};

// ✅ Filter for payout CSV/XLSX files
const payoutFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "text/csv",
    "application/vnd.ms-excel", // .csv
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" // .xlsx
  ];
  const allowedExt = [".csv", ".xlsx"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeOk = allowedMimeTypes.includes(file.mimetype);
  const isExtOk = allowedExt.includes(ext);

  if (isMimeOk && isExtOk) {
    return cb(null, true);
  }

  cb(new Error("❌ Only CSV or XLSX payout files allowed."));
};

// 📦 Export for image upload
exports.uploadTo = (folderName) => {
  return multer({
    storage: getStorage(folderName),
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
};

// 📦 Export for payout file upload
exports.uploadPayoutFile = () => {
  return multer({
    storage: getStorage("payouts"), // uploads/payouts/
    fileFilter: payoutFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
};
