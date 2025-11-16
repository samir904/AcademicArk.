import nodemailer from "nodemailer";

let transporter;

/**
 * Create and cache Nodemailer transporter for Gmail SMTP
 */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // false for 587, true for 465
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Verify connection
  transporter
    .verify()
    .then(() => console.log("✅ Gmail SMTP connection verified"))
    .catch((err) => console.error("❌ Gmail SMTP error:", err));

  return transporter;
}

/**
 * Send email via Gmail SMTP
 */
export async function sendEmail(to, subject, html, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const mailOptions = {
        from: `"AcademicArk" <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: to,
        subject: subject,
        html: html,
      };

      console.log(`📧 Sending via Gmail SMTP...`);
      console.log(`   From: ${mailOptions.from}`);
      console.log(`   To: ${to}`);

      const result = await getTransporter().sendMail(mailOptions);
      console.log(`✅ Email sent successfully!`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `Attempt ${attempt}/${retries} failed for ${to}: ${error.message}`
      );

      if (attempt < retries) {
        const waitTime = 1000 * attempt; // exponential backoff
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Generate password reset email HTML
 */
export function getResetPasswordEmailHtml(resetUrl) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password Reset</title>
    <style>
      body, table, td, p { margin: 0; padding: 0; }
      body { background: #000; color: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }
      img { border: none; max-width: 100%; display: block; }
      a { text-decoration: none; color: inherit; }

      .email-container {
        width: 100%;
        max-width: 600px;
        margin: auto;
      }
      .inner-padding {
        padding: 40px 30px;
      }

      .header {
        text-align: center;
        padding: 40px 20px;
        background: linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 100%);
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        color: #fff;
      }

      .body-text {
        font-size: 18px;
        line-height: 26px;
        color: #ddd;
        margin-bottom: 30px;
      }

      .btn {
        display: inline-block;
        padding: 14px 28px;
        background: linear-gradient(135deg, #4f46e5, #9333ea);
        color: #fff !important;
        font-weight: bold;
        border-radius: 50px;
        font-size: 16px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      }

      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #555;
        background: #000;
      }
    </style>
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000; padding:20px 0;">
      <tr>
        <td align="center">
          <table class="email-container" cellpadding="0" cellspacing="0" role="presentation" style="background:#111; border-radius:16px; overflow:hidden; border:1px solid #222;">
            <tr>
              <td class="header">
                <h1>AcademicArk</h1>
                <p style="margin: 8px 0 0; color: #999; font-size: 14px;">Password Reset Request</p>
              </td>
            </tr>
            <tr>
              <td class="inner-padding" align="center">
                <p class="body-text">
                  We received a request to reset your AcademicArk password. Click the button to create a new one.
                </p>
                <a href="${resetUrl}" class="btn">Reset Your Password</a>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                  This link expires in 15 minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td class="footer">
                © 2025 AcademicArk • Learn Without Limits
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
