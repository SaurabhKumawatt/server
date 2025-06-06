const nodemailer = require("nodemailer");

// 🔐 Hostinger SMTP config
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465, // SSL (Use 587 for TLS if needed)
  secure: true,
  auth: {
    user: process.env.EMAIL_FROM, // e.g. contact@yourdomain.com
    pass: process.env.EMAIL_PASSWORD, // app password or email password
  },
});

// ✅ Send Welcome Email
exports.sendWelcomeEmail = async ({ to, name }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Welcome to StraviX – Let’s Begin Your Growth Journey!",
      html: `
       <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
          <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
          <h2 style="margin: 0; font-size: 22px;">Welcome to StraviX!</h2>
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>
            Thank you for registering with <strong>StraviX</strong> – we're thrilled to welcome you to a community dedicated to real-world learning and growth.
          </p>
          <p>
            Explore our expert-designed, skill-based courses at your own pace and start building the confidence, clarity, and capabilities to thrive in the 21st century.
          </p>

          <!-- Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://stravix.in/login" style="padding: 12px 24px; background-color: #182432; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Log In to StraviX
            </a>
          </div>

          <p>
            For any help, feel free to reach out at
            <a href="mailto:customerfirst@stravix.in" style="color: #1f3bb3;">customerfirst@stravix.in</a> or WhatsApp us at
            <strong>+91-92116 50144</strong>.
          </p>

          <p>We’re excited to be part of your transformation journey!</p>
          <p>Warm regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
        </div>

        <!-- Footer -->
        <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
          © ${new Date().getFullYear()} StraviX. All rights reserved.
        </div>
      </div>
      `,
    });
  } catch (err) {
    console.error("📭 Error sending welcome email:", err.message);
  }
};


// ✅ Send Commission Earned Email
exports.sendCommissionEmail = async ({ to, name, referredUser, courseTitle, commission }) => {
  try {
    await transporter.sendMail({
      from: `"Stravix LMS" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "💰 You just earned a commission!",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2196f3;">Hey ${name},</h2>
          <p>🎉 Great news! You just earned a commission of <strong>₹${commission}</strong> 🎉</p>
          <p>Your referral <strong>${referredUser}</strong> enrolled in <strong>${courseTitle}</strong>.</p>
          <p>Keep sharing your referral link and grow your income 🚀</p>
          <br/>
          <p style="color: #888;">– Team Stravix</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("📭 Error sending commission email:", err.message);
  }
};
