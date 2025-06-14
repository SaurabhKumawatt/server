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
       <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
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
    console.error("Error sending welcome email:", err.message);
  }
};


// ✅ Send Commission Earned Email
exports.sendCommissionEmail = async ({ to, name, referredUser, courseTitle }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Referral Commission Update!",
      html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
          <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
          <h2 style="margin: 0; font-size: 22px;">Referral Update</h2>
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff; color: #333;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>We've got an update for you! Your dashboard has been updated to reflect the new referral.</p>

          <p>Here's a quick recap:</p>
          <ul>
            <li><strong>User Name:</strong> ${referredUser}</li>
            <li><strong>Package:</strong> ${courseTitle}</li>
          </ul>

          <p><em>Note: You'll receive your commission for this referral in our upcoming payout cycle.</em></p>

          <p>Keep referring and earning!</p>

          <p>Best regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
        </div>

        <!-- Footer -->
        <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
          © ${new Date().getFullYear()} StraviX. All rights reserved.
        </div>
      </div>
      `,
    });
  } catch (err) {
    console.error("Error sending commission email:", err.message);
  }
};

// Send OTP Email
exports.sendOtpEmail = async ({ name, to, otp }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>,`,
      to,
      subject: "Reset Your Password - OTP Inside",
      html:
        `
       <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <!-- Header -->
  <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
    <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
    <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
    <h2 style="margin: 0; font-size: 22px;">Password Reset Request</h2>
  </div>

  <!-- Body -->
  <div style="padding: 30px; background-color: #ffffff; color: #333;">
    <p>Dear <strong>${name}</strong>,</p>

    <p>
      We received a request to reset your password. To proceed, please use the One-Time Password (OTP) below:
    </p>

    <p style="font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; margin: 30px 0;">
      OTP: <span style="color: #182432;">${otp}</span>
    </p>

    <p style="text-align: center; font-size: 14px; color: #555; margin-bottom: 30px;">
      Validity: This OTP is valid for <strong>10 minutes</strong> and can be used only once.
    </p>

    <p>
      If you didn't request a password reset, please contact our support team at
      <a href="mailto:customerfirst@stravix.in" style="color: #1f3bb3;">customerfirst@stravix.in</a> to secure your account.
    </p>

    <p>Best regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
  </div>

  <!-- Footer -->
  <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
    © ${new Date().getFullYear()} StraviX. All rights reserved.
  </div>
</div>

       `,
    });
  } catch (err) {
    console.error(" Error sending OTP email:", err.message);
  }
};


exports.sendPayoutSuccessEmail = async ({ to, name, totalAmount, tdsAmount, netAmount }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX Team" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "🎉 Congratulations! Your weekly Payouts are In!",
      html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
          <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
          <h2 style="margin: 0; font-size: 22px;">Payout Details</h2>
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff; color: #333;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>We are pleased to inform you that you have received a payment of <strong>₹${totalAmount.toFixed(2)}</strong> from StraviX.</p>
          <p>Below are the payout details:</p>
          <ul>
            <li><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</li>
            <li><strong>2% TDS:</strong> ₹${tdsAmount.toFixed(2)}</li>
            <li><strong>Net Paid:</strong> ₹${netAmount.toFixed(2)}</li>
          </ul>
          <p>For any assistance or queries, please feel free to reach out to us at
          <a href="mailto:CustomerFirst@stravix.in" style="color:#1f3bb3;">CustomerFirst@stravix.in</a>.
          </p>
          <p>Best regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
        </div>

        <!-- Footer -->
        <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
          © ${new Date().getFullYear()} StraviX. All rights reserved.
        </div>
      </div>
      `,
    });
  } catch (err) {
    console.error("Error sending payout success email:", err.message);
  }
};

// Payout Failure Email
exports.sendPayoutFailureEmail = async ({ to, name, reason, netAmount }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Payout Failed Notification",
      html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
          <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
          <h2 style="margin: 0; font-size: 22px;">Payout Issue</h2>
        </div>

        <!-- Body -->
        <div style="padding: 30px; background-color: #ffffff; color: #333;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>We're sorry to inform you that your payout has been <strong>failed</strong>.</p>
          <p>Here are the details:</p>
          <ul>
            <li><strong>Amount Processed:</strong> ₹${netAmount.toFixed(2)}</li>
            <li><strong>Reason for Failure:</strong> ${reason || "Unknown"}</li>
          </ul>
          <p>For any assistance or queries, please feel free to reach out to us at 
          <a href="mailto:CustomerFirst@stravix.in" style="color:#1f3bb3;">CustomerFirst@stravix.in</a></p>
          <p>Best regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
        </div>

        <!-- Footer -->
        <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
          © ${new Date().getFullYear()} StraviX. All rights reserved.
        </div>
      </div>
      `,
    });
  } catch (err) {
    console.error("Error sending payout failure email:", err.message);
  }
};