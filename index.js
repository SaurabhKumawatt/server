const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 5000;
const BACKEND_CROS = process.env.BACKEND_CROS;

// Route Imports
const userRoutes = require("./routes/userRoutes");
const courseRoutes = require("./routes/courseRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");

// Security Headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: BACKEND_CROS, // ✅ change in prod
    credentials: true,
  })
);
app.set("trust proxy", 1); // For rate-limit + IP handling


// 👇 Must be BEFORE express.json() — only for Razorpay
app.post(
  "/api/payments/verify",
  express.raw({ type: "application/json" }),
  require("./controllers/paymentController").verifyPayment
);

// Now parse everything else normally
app.use(express.json());
app.use(cookieParser());


// Connect DB
connectDB();

// Rate Limiting
const limiter = rateLimit({
  windowMs: 155 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);


// Logging for unknown hits
// app.use((req, res, next) => {
//   console.log("🔍 Unknown route hit:", req.method, req.url);
//   next();
// });

// Health check
app.get("/", (req, res) => {
  res.send("Stravix backend is running...");
});

// App routes
app.use("/api/user", userRoutes);
app.use("/uploads/profile", express.static(path.join(__dirname, "uploads/profile")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/courses", courseRoutes);
app.use("/api/payments", paymentRoutes); // other payment routes
app.use("/api/enrollments", enrollmentRoutes);
app.use(
  "/uploads/course-thumbnails",
  express.static(path.join(__dirname, "uploads/course-thumbnails"), {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000");
    },
  })
);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 🔥", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥", err.message);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
