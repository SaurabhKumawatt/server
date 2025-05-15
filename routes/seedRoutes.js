const express = require("express");
const router = express.Router();
const Course = require("../models/Course");

router.post("/seed-course", async (req, res) => {
  try {
    await Course.deleteMany();

    await Course.create([
      {
        title: "Soft Skill Mastery",
        slug: "soft-skills",
        price: 1499,
        discountedPrice: 1299,
        description: "Master communication and presentation skills",
        features: ["Confidence", "Public Speaking"],
        thumbnail: "/assets/images/bundle1.jpg",
      },
      {
        title: "Personal Branding",
        slug: "personal-branding",
        price: 1499,
        discountedPrice: 1299,
        description: "Build a personal brand that attracts opportunities",
        features: ["LinkedIn Optimization", "Storytelling"],
        thumbnail: "/assets/images/bundle1.jpg",
      },
    ]);

    res.status(201).json({ message: "Courses seeded successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Seeding failed" });
  }
});

module.exports = router;
