const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { 
    getTrainingPlayer,
    getTrainingBySlug,
    getTrainingPlaylistVideos
} = require("../controllers/trainingController");

// Reusing existing playlist logic
router.get("/playlist/:id", protect, getTrainingPlaylistVideos);
router.get("/:slug/player", protect, getTrainingPlayer);
router.get("/:slug", protect, getTrainingBySlug);


module.exports = router;
