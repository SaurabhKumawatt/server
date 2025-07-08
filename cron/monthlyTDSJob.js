// cron/monthlyTDSJob.js
const cron = require("node-cron");
const { generateMonthlyTDSCSV } = require("../controllers/adminController");

cron.schedule("59 23 * * *", async () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  // ✅ Run only if tomorrow is 1st of next month → means today is last day
  if (tomorrow.getDate() === 1) {
    console.log("⏰ Running monthly TDS CSV generator...");

    try {
      await generateMonthlyTDSCSV();
      console.log("✅ Monthly TDS CSV generated successfully.");
    } catch (err) {
      console.error("❌ Error generating monthly TDS CSV:", err.message);
    }
  } else {
    console.log("🕒 Not the last day of the month. Skipping TDS generation.");
  }
});
