const cron = require("node-cron");
const User = require("../models/User");
const { sendBirthdayEmail } = require("../utils/email");

const birthdayCron = () => {
  cron.schedule("25 23 * * *", async () => {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const users = await User.find({
        dob: { $exists: true },
        role: "paid-affiliate", // ✅ Only paid affiliates
      });

      for (let user of users) {
        if (!user.dob) continue;

        const userDob = new Date(user.dob);
        if (userDob.getDate() === day && userDob.getMonth() + 1 === month) {
          await sendBirthdayEmail({ to: user.email, name: user.fullName });
          console.log(`🎂 Birthday mail sent to ${user.fullName} (${user.email})`);
        }
      }
    } catch (err) {
      console.error("❌ Birthday cron error:", err.message);
    }
  });
};

module.exports = birthdayCron;
