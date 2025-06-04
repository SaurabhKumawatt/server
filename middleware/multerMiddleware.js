const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Choose your destination folder
const getStorage = (folderName) => {
  // Ensure the folder exists
  const dir = `uploads/${folderName}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname); // must be like .jpg, .png
      console.log("📦 Uploading file with ext:", ext);
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    }


  });
};

// ✅ File filter (only allow images/pdf etc.)
const betterFileFilter = (req, file, cb) => {
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

  if (isExtOk && isMimeOk) return cb(null, true);
  cb(new Error("Only image are allowed"));
};



// ✅ Main upload function (folder-specific)
exports.uploadTo = (folderName) => {
  return multer({
    storage: getStorage(folderName),
    betterFileFilter: betterFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });
};
