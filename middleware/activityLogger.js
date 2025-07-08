// 📁 middleware/activityLogger.js
const ActivityLog = require("../models/ActivityLog");
const requestIp = require("request-ip");
const geoip = require("geoip-lite");
const useragent = require("useragent");

const logActivity = async (req, res, next) => {
  try {
    const ip = requestIp.getClientIp(req);
    const geo = geoip.lookup(ip);
    const agent = useragent.parse(req.headers['user-agent']);

    await ActivityLog.create({
      userId: req.user?._id || null,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      device: agent.device.toString(),
      os: agent.os.toString(),
      browser: agent.toAgent(),
      location: geo ? {
        country: geo.country,
        region: geo.region,
        city: geo.city,
      } : {},
      endpoint: req.originalUrl,
      method: req.method,
      status: "initiated",
    });
  } catch (err) {
    console.error("Activity logging error:", err);
  }
  next();
};

module.exports = { logActivity };
