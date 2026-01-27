import User from '../MODELS/user.model.js';
import Apperror from '../UTIL/error.util.js';
import { sendEmail } from '../UTIL/sendemail.js'; // ✅ Make sure path is correct
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @SEND_BROADCAST_EMAIL
 * @ROUTE /api/v1/admin/broadcast-email
 * @ACCESS Private (Admin only)
 */
export const sendBroadcastEmail = async (req, res, next) => {
  try {
    const { subject, message, ctaText, ctaLink, targetRole } = req.body;

    if (!subject || !message) {
      return next(new Apperror('Subject and message are required', 400));
    }

    // Build query based on targetRole
    let query = {};
    if (targetRole && targetRole !== 'ALL') {
      query.role = targetRole;
    }

    // Get all users matching criteria
    const users = await User.find(query).select('email fullName');

    if (!users || users.length === 0) {
      return next(new Apperror('No users found', 404));
    }

    console.log(`📧 Sending broadcast email to ${users.length} users...`);

    // Read email template
    const templatePath = path.join(__dirname, '../TEMPLATES/broadcastEmail.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    // Send emails in batches (to avoid rate limits)
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;
    const failedEmails = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`📬 Processing batch ${Math.ceil((i + 1) / batchSize)}/${Math.ceil(users.length / batchSize)}`);
      
      const emailPromises = batch.map(async (user) => {
        try {
          const htmlContent = template({
            subject,
            message: message.replace(/\n/g, '<br>'), // Convert newlines to <br>
            ctaText,
            ctaLink,
            unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe`
          });

          // ✅ FIXED: Call with proper parameters (to, subject, html)
          await sendEmail(user.email, subject, htmlContent);

          successCount++;
          console.log(`✅ Sent to ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed to send to ${user.email}:`, error.message);
          failCount++;
          failedEmails.push(user.email);
        }
      });

      await Promise.all(emailPromises);
      
      // Wait 1 second between batches to avoid rate limits
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n📊 Broadcast Complete: ${successCount} sent, ${failCount} failed`);

    res.status(200).json({
      success: true,
      message: `Email broadcast sent to ${successCount} users${failCount > 0 ? ` (${failCount} failed)` : ''}`,
      data: {
        totalUsers: users.length,
        successCount,
        failCount,
        failedEmails: failCount > 0 ? failedEmails : undefined
      }
    });

  } catch (error) {
    console.error('🔴 Broadcast error:', error.message);
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @GET_EMAIL_STATS
 * @ROUTE /api/v1/admin/email-stats
 * @ACCESS Private (Admin only)
 */
export const getEmailStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        usersByRole
      }
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};