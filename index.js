const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const seedRoutes = require("./routes/seedRoutes");
const userRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
    res.send("Stravix backend is running...");
});
app.use("/api/auth", authRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/user", userRoutes);
app.use("/api/user", courseRoutes);
app.use("/api/courses", courseRoutes);


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 🔥", err.message);
  process.exit(1); // triggers Railway auto-restart
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥", err.message);
  process.exit(1); // triggers Railway auto-restart
});
