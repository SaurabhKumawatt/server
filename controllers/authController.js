const User = require("../models/User");
const jwt = require("jsonwebtoken");
const Payment = require("../models/Payment");
const Course = require("../models/Course");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");


exports.registerManualUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      password,
      mobile,
      state,
      dob,
      referralCode,
      selectedCourse,
      txnId,
    } = req.body;

    if (!fullName || !email || !password || !txnId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      username,
      email,
      password: hashedPassword,
      phone: mobile,
      state,
      dob,
      referredBy: referralCode || null,
      affiliateCode: uuidv4().slice(0, 6),
      isEmailVerified: true,
    });

    const course = await Course.findOne({ slug: selectedCourse });
    if (!course) {
      console.log("❌ Course not found:", selectedCourse);
      return res.status(404).json({ message: "Course not found" });
    }

    await Payment.create({
      user: user._id,
      course: course._id,
      transactionId: txnId,
      screenshotUrl: "https://dummy-screenshot.com", // replace with real upload later
      status: "approved",
      amountPaid: course.discountedPrice || course.price,
    });

    res.status(201).json({
      message: "User registered and payment approved",
      token: generateToken(user._id),
    });

  } catch (error) {
    console.error("❌ Manual Signup Error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};



// @desc    Register new user
exports.registerUser = async (req, res) => {
    const { fullName, email, password } = req.body;


    if (!fullName || !email || !password)
        return res.status(400).json({ message: "All fields are required" });

    const userExists = await User.findOne({ email });
    if (userExists)
        return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ fullName, email, password });

    if (user) {
        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: "Invalid user data" });
    }
};

// @desc    Login user
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    console.log("Login Attempt =>", email, password); // 👀 Log 1

    const user = await User.findOne({ email });

    console.log("Found User =>", user); // 👀 Log 2


    if (user && (await user.matchPassword(password))) {

        console.log("✅ Password matched");
        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        console.log("❌ Invalid credentials");
        res.status(401).json({ message: "Invalid credentials" });
    }
};

// @desc    Get user data (token protected)
exports.getMe = async (req, res) => {
    const user = await User.findById(req.user.id).select("-password");
    res.status(200).json(user);
};

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};
