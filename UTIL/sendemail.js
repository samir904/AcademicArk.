// utils/sendEmail.js
import nodemailer from 'nodemailer';

let transporter;

/**
 * Create and cache Nodemailer transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Optional: verify SMTP connection
  transporter.verify()
    .then(() => console.log('✅ SMTP server is ready to send emails'))
    .catch(err => console.error('❌ SMTP config error:', err));

  return transporter;
}

/**
 * Send any HTML email
 */
export async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: `"AcademicArk Support" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to,
    subject,
    html,
  };
  return getTransporter().sendMail(mailOptions);
}

/**
 * Generate a **modern, premium password reset email**
 * matching AcademicArk's dark B&W theme with gradient accents.
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
      /* Reset margins/paddings */
      body, table, td, p { margin: 0; padding: 0; }
      body { background: #000; color: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }
      img { border: none; max-width: 100%; display: block; }
      a { text-decoration: none; color: inherit; }

      /* Container */
      .email-container {
        width: 100%;
        max-width: 600px;
        margin: auto;
      }
      .inner-padding {
        padding: 40px 30px;
      }

      /* Header */
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
      .header p {
        margin: 8px 0 0;
        color: #999;
        font-size: 14px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      /* Body text */
      .body-text {
        font-size: 18px;
        line-height: 26px;
        color: #ddd;
        margin-bottom: 30px;
      }

      /* Button */
      .btn {
        display: inline-block;
        padding: 14px 28px;
        background: linear-gradient(135deg, #4f46e5, #9333ea);
        color: #fff !important;
        font-weight: bold;
        border-radius: 50px;
        font-size: 16px;
        letter-spacing: .5px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      }

      /* Fallback link */
      .fallback {
        margin-top: 30px;
        font-size: 14px;
        color: #aaa;
        line-height: 20px;
        word-break: break-all;
      }
      .fallback a {
        color: #60a5fa;
      }

      /* Disclaimer */
      .disclaimer {
        margin-top: 40px;
        font-size: 12px;
        color: #666;
        line-height: 18px;
      }

      /* Footer */
      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #555;
        background: #000;
      }

      /* Responsive */
      @media screen and (max-width: 480px) {
        .inner-padding { padding: 30px 20px !important; }
        .header h1 { font-size: 24px !important; }
        .header p { font-size: 12px !important; letter-spacing: .5px !important; }
        .body-text { font-size: 16px !important; line-height: 24px !important; }
        .btn { padding: 12px 20px !important; font-size: 14px !important; }
        .fallback { font-size: 12px !important; }
        .disclaimer { font-size: 10px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000; padding:20px 0;">
      <tr>
        <td align="center">
          <table class="email-container" cellpadding="0" cellspacing="0" role="presentation" style="background:#111; border-radius:16px; overflow:hidden; border:1px solid #222;">
            
            <!-- Header -->
            <tr>
              <td class="header">
                <h1>AcademicArk</h1>
                <p>Password Reset Request</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="inner-padding" align="center">
                <p class="body-text">
                  We received a request to reset your <strong>AcademicArk</strong> password.
                  Click the button below to create a new password.
                </p>
                <a href="${resetUrl}" class="btn">Reset Your Password</a>
                <p class="fallback">
                  Or copy and paste this link into your browser:<br/>
                  <a href="${resetUrl}">${resetUrl}</a>
                </p>
                <p class="disclaimer">
                  This link expires in 15 minutes.<br/>
                  If you didn’t request this, you can safely ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
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

