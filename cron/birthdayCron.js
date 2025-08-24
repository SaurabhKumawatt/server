const cron = require("node-cron");
const User = require("../models/User");
const { sendBirthdayEmail } = require("../utils/email");

const birthdayCron = () => {
  cron.schedule(
    "38 23 * * *",
    async () => {
      try {
        const now = new Date();
        console.log("🎯 Birthday cron triggered at:", now.toString());

        const todayDay = now.getUTCDate();
        const todayMonth = now.getUTCMonth(); // 0-based

        const users = await User.find({
          dob: { $exists: true },
          role: "paid-affiliate", // ✅ Only paid affiliates
        });

        for (let user of users) {
          if (!user.dob) continue;

          const dob = new Date(user.dob);

          if (
            dob.getUTCDate() === todayDay &&
            dob.getUTCMonth() === todayMonth
          ) {
            await sendBirthdayEmail({ to: user.email, name: user.fullName });
            console.log(`🎂 Birthday mail sent to ${user.fullName} (${user.email})`);
          }
        }
      } catch (err) {
        console.error("❌ Birthday cron error:", err.message);
      }
    },
    {
      timezone: "Asia/Kolkata", // ✅ IST timezone
    }
  );
};

module.exports = birthdayCron;
