const mongoose = require("mongoose");
const Course = require("./models/Course"); // adjust path if needed


mongoose
  .connect("mongodb+srv://saurabhk:Saurabh@cluster0.aac3d.mongodb.net/stravixNew?retryWrites=true&w=majority")
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    const newCourse = await Course.create({
      title: "Why Go Digital",
      slug: "why-go-digital",
      description: "",
      thumbnail: "",
      category: "digital",
      isBundle: false,
      price: 999,
      discountedPrice: 999,
      affiliateCommissionPercent: 0,
      tags: ["digital", "social-media"],
      status: "published",
      instructor: new mongoose.Types.ObjectId("683577d436fb29c18ec4054d"), // 🔁 Replace with actual instructor _id
    });

    console.log("✅ Course inserted:", newCourse);
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
