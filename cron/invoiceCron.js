// cron/invoiceCron.js
const { exportInvoiceSheet } = require("../controllers/adminController");

const cron = require("node-cron");
const httpMocks = require("node-mocks-http");

// Last day of month at 11:59 PM
cron.schedule("59 23 28-31 * *", async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0);

  if (now.getDate() !== lastDay.getDate()) return;

  const fromDate = new Date(year, month, 1);
  const toDate = lastDay;

  const req = httpMocks.createRequest({
    method: "GET",
    query: {
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0]
    }
  });

  const res = httpMocks.createResponse({
    eventEmitter: require("events").EventEmitter
  });

  console.log(`🟡 Running invoice generation for: ${req.query.fromDate} - ${req.query.toDate}`);

  res.on("finish", () => {
    if (res.statusCode === 200) {
      console.log("✅ Invoice generated successfully");
    } else {
      console.error("❌ Failed to generate invoice. Status:", res.statusCode);
    }
  });

  await exportInvoiceSheet(req, res);
});
