// routes/promotionalRoutes.js
const express = require("express");
const router = express.Router();
const { streamPromotionalFile } = require("../controllers/promotionalController");
const { protect } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/roles");
const axios = require("axios");

router.get("/file/:fileId", protect, authorizeRoles("paid-affiliate", "admin"), streamPromotionalFile);


router.get("/download", async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).send("URL required");

        const response = await axios.get(url, { responseType: "arraybuffer" });

        res.setHeader("Content-Disposition", `attachment; filename="${filename || 'file'}"`);
        res.setHeader("Content-Type", response.headers["content-type"]);
        res.send(response.data);
    } catch (err) {
        console.error("Download error:", err.message);
        res.status(500).send("Failed to download");
    }
});

module.exports = router;
