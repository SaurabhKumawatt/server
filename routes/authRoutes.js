const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const { registerUser, loginUser, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { registerManualUser } = require("../controllers/authController");

router.post("/signup", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe); // test token
router.post("/manual-signup", upload.single("screenshot"), registerManualUser);


module.exports = router;
