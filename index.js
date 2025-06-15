const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const path = require("path");

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.local",
});

const connectDB = require("./config/db");
const app = express();
const PORT = process.env.PORT || 5000;

// 🧠 Connect DB first
connectDB();

// 🔐 Security Middleware
app.use(helmet());
app.use(cookieParser());
app.use(compression()); // ✅ Enable gzip compression
app.set("trust proxy", 1); // required for secure cookies & redirect

// 🌐 CORS Config (with logging)
const allowedOrigins = [
  "http://localhost:5173",
  "https://www.stravix.in",
  "https://stravix.in",
  "https://stravix-testing-client.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS BLOCKED ORIGIN: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// 🔁 Force HTTPS (only in production)
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 🧱 Rate Limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// 🧾 Razorpay Webhook (must be before express.json)
app.post(
  "/api/payments/verify",
  express.raw({ type: "application/json" }),
  require("./controllers/paymentController").verifyPayment
);

// 📦 Body Parsers
app.use(express.json());

// 🖼 Static Files
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
app.use("/downloads", express.static(path.join(__dirname, "downloads")));
app.use("/downloads/payouts", express.static(path.join(__dirname, "..", "downloads", "payouts")));

// ✅ Health Check
app.get("/", (req, res) => {
  res.send("✅ Stravix backend is running securely over HTTPS!");
});

// 📌 API Routes
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/trainings", require("./routes/trainingRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// 🔍 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: "❌ Route not found" });
});

// 🧨 Global Error Handler (add this last)
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(500).json({ message: err.message || "Something went wrong!" });
});

// 💥 Unhandled Errors & Graceful Shutdown
process.on("unhandledRejection", (err) => {
  console.error("❗ UNHANDLED REJECTION:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// 🟢 Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
