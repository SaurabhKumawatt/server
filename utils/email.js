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
          <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
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
          <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
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
    <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
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
          <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
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
          <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
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


exports.sendUpdateOtpEmail = async ({ name, to, otp }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "OTP for Email Change - OTP Inside",
      html: `
        <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
            <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
            <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
            <h2 style="margin: 0; font-size: 22px;">OTP for Email Change</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px; background-color: #ffffff; color: #333;">
            <p>Dear <strong>${name}</strong>,</p>

            <p>
              We received a request to change your email address. To proceed, please use the One-Time Password (OTP) below:
            </p>

            <p style="font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; margin: 30px 0;">
              OTP: <span style="color: #182432;">${otp}</span>
            </p>

            <p style="text-align: center; font-size: 14px; color: #555; margin-bottom: 30px;">
              Validity: This OTP is valid for <strong>10 minutes</strong> and can be used only once.
            </p>

            <p>
              If you didn't request an email change, please contact our support team at
              <a href="mailto:customerfirst@stravix.in" style="color: #1f3bb3;">customerfirst@stravix.in</a> to secure your account.
            </p>

            <p>Best regards,<br/>StraviX Team</p>
          </div>

          <!-- Footer -->
          <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} StraviX. All rights reserved.
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending update OTP email:", err.message);
  }
};


// ✅ Confirmation Email After Successful Update
exports.sendEmailUpdatedConfirmation = async ({ name, to }) => {
  try {
    await transporter.sendMail({
      from: `\"StraviX\" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Your Email Has Been Successfully Updated!",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
            <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" style="width: 150px;" />
            <h2>Email Update Confirmation</h2>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Your email has been successfully updated in your StraviX profile.</p>
            <p>If this was not done by you, please contact us immediately.</p>
            <p>Regards,<br/>Team StraviX</p>
          </div>
        </div>`
    });
  } catch (err) {
    console.error("Error sending email update confirmation:", err.message);
  }
};

exports.sendMobileUpdateOtpEmail = async ({ name, to, otp }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "OTP for Mobile Number Update",
      html: `
        <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
            <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
            <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
            <h2 style="margin: 0; font-size: 22px;">OTP for Mobile Number Update</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px; background-color: #ffffff; color: #333;">
            <p>Dear <strong>${name}</strong>,</p>

            <p>
              We received a request to change your mobile number. To proceed, please use the One-Time Password (OTP) below:
            </p>

            <p style="font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; margin: 30px 0;">
              OTP: <span style="color: #182432;">${otp}</span>
            </p>

            <p style="text-align: center; font-size: 14px; color: #555; margin-bottom: 30px;">
              Validity: This OTP is valid for <strong>10 minutes</strong> and can be used only once.
            </p>

            <p>
              If you didn't request a mobile number change, please contact our support team at
              <a href="mailto:customerfirst@stravix.in" style="color: #1f3bb3;">customerfirst@stravix.in</a> to secure your account.
            </p>

            <p>Best regards,<br/>StraviX Team</p>
          </div>

          <!-- Footer -->
          <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} StraviX. All rights reserved.
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending mobile update OTP email:", err.message);
  }
};

exports.sendMobileUpdatedConfirmation = async ({ name, to }) => {
  try {
    await transporter.sendMail({
      from: `"StraviX" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Your Mobile Number Has Been Successfully Updated!",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <!-- Header -->
          <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
            <img src="https://www.upthrivex.com/assets/logos/stravix 300 by 100.png" style="width: 150px;" />
            <h2>Mobile Number Update Confirmation</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px; background-color: #ffffff;">
            <p>Dear <strong>${name}</strong>,</p>
            <p>Your mobile number has been successfully updated in your StraviX profile.</p>
            <p>If this was not done by you, please contact us immediately to secure your account.</p>
            <p>Regards,<br/>Team <strong>StraviX</strong></p>
          </div>

          <!-- Footer -->
          <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} StraviX. All rights reserved.
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending mobile update confirmation:", err.message);
  }
};



// ✅ Send KYC Approval Email
exports.sendKycApprovalEmail = async ({ to, name }) => {
  await transporter.sendMail({
    from: `"StraviX" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "KYC Approved – Get Ready for Seamless Payouts",
    html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
            <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
            <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
            <h2 style="margin: 0; font-size: 22px;">KYC Approved – Get Ready for Seamless Payouts</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px; background-color: #ffffff; color: #333;">
            <p>Dear <strong>${name}</strong>,</p>
            <p>
              Greetings from <strong>StraviX!</strong><br/><br/>
              We’re glad to inform you that your <strong>KYC has been successfully approved</strong>. 
              From the upcoming payout cycle, your weekly payouts will now be credited directly.
            </p>
            
            <p>Thank you for being a valued part of StraviX.</p>
            <p>Best regards,<br/>Team <strong>StraviX</strong><br/><em>#WhereSkillsMeetSuccess</em></p>
          </div>

          <!-- Footer -->
          <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} StraviX. All rights reserved.
          </div>
        </div>
    `,
  });
};

// ❌ Send KYC Rejection Email
exports.sendKycRejectionEmail = async ({ to, name, reason }) => {
  await transporter.sendMail({
    from: `"StraviX" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Action Required – KYC Rejected",
    html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <!-- Header -->
  <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
    <img src="https://www.stravix.in/assets/logos/Stravix-logo.svg" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
    <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
    <h2 style="margin: 0; font-size: 22px;">Action Required – KYC Rejected</h2>
  </div>

  <!-- Body -->
  <div style="padding: 30px; background-color: #ffffff; color: #333;">
    <p>Dear <strong>${name}</strong>,</p>

    <p>Greetings from <strong>StraviX</strong>.</p>

    <p>We regret to inform you that your KYC has not been approved.</p>

    <p style="background:#f8f8f8; padding:12px 16px; border-left:4px solid #182432; margin:16px 0;">
      <strong>Reason:</strong> ${reason}
    </p>

    <p>
      Kindly update and resubmit your KYC documents at the earliest so we can activate your weekly payouts without delay.
    </p>

    <p>
      For any support, feel free to reach us at
      <a href="mailto:customerfirst@stravix.in" style="color: #1f3bb3;">customerfirst@stravix.in</a>.
    </p>

    <p>Best regards,<br/>StraviX Team</p>
  </div>

  <!-- Footer -->
  <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
    © ${new Date().getFullYear()} StraviX. All rights reserved.
  </div>
</div>

    `,
  });
};








exports.sendBirthdayEmail = async ({ to, name }) => {
  await transporter.sendMail({
    from: `"StraviX" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `Happy Birthday, ${name}! Wishing You a Year of Growth & Success ✨`,
    html: `
      <div style="width: 100%; margin: auto; font-family: Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <!-- Header -->
  <div style="background-color: #182432; padding: 20px; text-align: center; color: #fff;">
    <img src="https://www.stravix.in/assets/logos/stravix%20300%20by%20100.png" alt="StraviX Logo" style="width: 150px; margin-bottom: 10px;" />
    <h2 style="margin: 0; font-size: 12px;">Where Skills Meet Success</h2>
    <h2 style="margin: 0; font-size: 22px;">Happy Birthday, ${name}! <br />  Wishing You a Year of Growth & Success ✨</h2>
  </div>

  <!-- Body -->
  <div style="padding: 30px; background-color: #ffffff; color: #333;">
    <p>Dear <strong>${name}</strong>,</p>

    <p>On your special day, the entire <strong>StraviX Family</strong> joins together to celebrate you. 🌟</p>

    <p>
      Birthdays are not just about adding another year—they’re about embracing new opportunities, setting bigger goals, and becoming an even better version of yourself. 
      Knowing the passion and dedication you carry, we’re sure this year will open doors to even greater achievements. 🚀
    </p>

    <p style="margin: 18px 0;"><strong>May this year bring you:</strong></p>
    <ul style="margin: 0 0 20px 18px; padding: 0; line-height: 1.7;">
      <li>💡 New learnings that shape your growth</li>
      <li>💪 Strength to chase your boldest dreams</li>
      <li>❤️ Happiness, health, and memorable moments with your loved ones</li>
    </ul>

    <p>
      We’re proud to have you as part of the StraviX Family, and we look forward to seeing you shine even brighter in the year ahead.
    </p>

    <p><strong>Keep believing, keep growing—the best is yet to come! 🌈</strong></p>

    <p>Warm wishes,<br/>Team <strong>StraviX</strong></p>
  </div>

  <!-- Footer -->
  <div style="background-color: #182432; text-align: center; padding: 10px; font-size: 12px; color: #999;">
    © ${new Date().getFullYear()} StraviX. All rights reserved.
  </div>
</div>
    `,
  });
};
