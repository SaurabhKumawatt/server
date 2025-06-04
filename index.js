const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");


const allowedOrigins = [
  "http://localhost:5173",                        // local dev
  "https://stravix.in",                           // prod for master
  "https://www.stravix.in",
  "https://upthrivex.com",                        // ✅ prod for main
  "https://www.upthrivex.com",
  "https://client-self-nine.vercel.app",          // optional: Vercel preview
  "https://main-stravix-client.vercel.app"        // optional: main branch preview
];

// 🧠 Load env config
require("dotenv").config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.local"
});


const connectDB = require("./config/db");
const app = express();
const PORT = process.env.PORT || 5000;

// === Load CORS domain from env
const BACKEND_CORS = process.env.CLIENT_URL || "http://localhost:5173";

// 🔒 Security
app.use(helmet());
app.use(cookieParser());

// ✅ CORS Config
// app.use(
//   cors({
//     origin: [BACKEND_CORS, "http://localhost:5173"],
//     credentials: true,
//   })
// );


app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Rate Limiter
app.set("trust proxy", 1);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ✅ Connect MongoDB
connectDB();

// ✅ Razorpay Webhook: Raw body parser (must be before express.json)
app.post(
  "/api/payments/verify",
  express.raw({ type: "application/json" }),
  require("./controllers/paymentController").verifyPayment
);

// ✅ Body parser
app.use(express.json());

// === Static Files
app.use("/uploads/profile", express.static(path.join(__dirname, "uploads/profile")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/uploads/course-thumbnails",
  express.static(path.join(__dirname, "uploads/course-thumbnails"), {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000");
    },
  })
);

// === Health Check
app.get("/", (req, res) => {
  res.send("✅ Stravix backend is running...");
});

// === Route Imports
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));

// === 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: "❌ Route not found" });
});

// === Global Error Catchers
process.on("unhandledRejection", (err) => {
  console.error("❗ UNHANDLED REJECTION:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err.message);
  process.exit(1);
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
