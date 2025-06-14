const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const { uploadTrainingThumbnail } = require("../middleware/cloudinaryUpload");
const { 
    getTrainingPlayer,
    getTrainingBySlug,
    getTrainingPlaylistVideos,
    updateTrainingThumbnail
} = require("../controllers/trainingController");

// Reusing existing playlist logic
router.get("/playlist/:id", protect, getTrainingPlaylistVideos);
router.get("/:slug/player", protect, getTrainingPlayer);
router.get("/:slug", protect, getTrainingBySlug);
router.put(
  "/:id/thumbnail",
  protect,
  authorizeRoles("admin"),
  uploadTrainingThumbnail.single("thumbnail"),
  updateTrainingThumbnail
);


module.exports = router;
