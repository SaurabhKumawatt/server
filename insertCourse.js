// const mongoose = require("mongoose");
// const Course = require("./models/Course"); // adjust path if needed


// mongoose
//   .connect("mongodb+srv://saurabhk:Saurabh@cluster0.aac3d.mongodb.net/stravixNew?retryWrites=true&w=majority")
//   .then(async () => {
//     console.log("✅ Connected to MongoDB");

//     const newCourse = await Course.create({
//       title: "Communication For Life",
//       slug: "communication-for-life",
//       description: "",
//       thumbnail: "",
//       category: "communication",
//       isBundle: false,
//       price: 999,
//       discountedPrice: 999,
//       affiliateCommissionPercent: 0,
//       tags: ["communication", "public speaker"],
//       status: "published",
//       youtubePlaylistId: "PLv9O1ieIsEgdztm-mSvd9kkfg58hxNBOO",
//       instructor: new mongoose.Types.ObjectId("683577d436fb29c18ec4054d"), // 🔁 Replace with actual instructor _id
//     });

//     console.log("✅ Course inserted:", newCourse);
//     mongoose.disconnect();
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//   });



const mongoose = require("mongoose");
const Course = require("./models/Course"); // adjust path if needed

mongoose
  .connect("mongodb+srv://saurabhk:Saurabh@cluster0.aac3d.mongodb.net/stravixNew?retryWrites=true&w=majority")
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    const courseId = "68428c648b6c4ada687ad10c"; // 🔁 bundle course _id
    const relatedCourses = [
      "6843314cc2e8aaf8b860699b", // ✅ related course 
      "68433183785f124d930b762d"
    ];

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { relatedCourses },
      { new: true }
    ).populate("relatedCourses", "title");

    console.log("✅ Updated Related Courses:", updatedCourse.relatedCourses);
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
