import EmailCampaign from "../MODELS/emailCampaign.model.js";
import User from "../MODELS/user.model.js";
import Apperror from "../UTIL/error.util.js";
import { sendEmail } from "../UTIL/sendemail.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**

@CREATE_CAMPAIGN_WITH_IMAGE

@ROUTE /api/v1/admin/campaign/create

@ACCESS Private (Admin only)
*/
export const createCampaign = async (req, res, next) => {
  try {
    const {
      campaignName,
      subject,
      message,
      ctaText,
      ctaLink,
      targetRole,
      dailyLimit,
      headerImage,
      logo,
      features,
      screenshots, // ✅ NEW: Screenshot showcase
    } = req.body;

    if (!campaignName || !subject || !message) {
      return next(
        new Apperror("Campaign name, subject, and message are required", 400)
      );
    }

    let query = {};
    if (targetRole && targetRole !== "ALL") {
      query.role = targetRole;
    }

    const users = await User.find(query).select("email _id");

    if (!users || users.length === 0) {
      return next(new Apperror("No users found for this campaign", 404));
    }

    // ✅ Convert screenshots to plain objects
    const screenshotsArray = screenshots
      ? screenshots.map((s) => ({
          title: s.title || "",
          description: s.description || "",
          imageUrl: s.imageUrl || "",
          bgColor: s.bgColor || "",
        }))
      : [];

    const campaign = await EmailCampaign.create({
      campaignName,
      subject,
      message,
      ctaText,
      ctaLink,
      targetRole,
      dailyLimit: dailyLimit || 100,
      totalUsers: users.length,
      headerImage,
      logo,
      features,
      screenshots: screenshotsArray, // ✅ Store screenshots
      pendingUsers: users.map((u) => ({ userId: u._id, email: u.email })),
      createdBy: req.user.id,
      status: "scheduled",
    });

    res.status(201).json({
      success: true,
      message: `Campaign created successfully with ${users.length} users`,
      data: campaign,
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**

@SEND_DAILY_CAMPAIGN_EMAILS

@ROUTE /api/v1/admin/campaign/send-daily
*/
/**
 * @SEND_DAILY_CAMPAIGN_EMAILS
 * @ROUTE /api/v1/admin/campaign/send-daily
 */
export const sendDailyCampaignEmails = async (req, res, next) => {
  try {
    console.log("📅 Starting daily campaign email send...");

    const activeCampaigns = await EmailCampaign.find({
      status: "scheduled",
      pendingUsers: { $exists: true, $ne: [] },
    });

    if (activeCampaigns.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active campaigns to send",
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    // ✅ Use Apple-style template
    const templatePath = path.join(
      __dirname,
      "../TEMPLATES/appleStyleEmail.hbs"
    );
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    for (const campaign of activeCampaigns) {
      console.log(`\n📧 Processing campaign: ${campaign.campaignName}`);

      const batchSize = Math.min(
        campaign.dailyLimit,
        campaign.pendingUsers.length
      );
      const usersBatch = campaign.pendingUsers.slice(0, batchSize);

      console.log(`📬 Sending to ${usersBatch.length} users today`);

      let batchSent = 0;
      let batchFailed = 0;

      for (const userRecord of usersBatch) {
        try {
          const features = campaign.features
            ? campaign.features.map((f) => ({
                icon: f.icon || "",
                title: f.title || "",
                description: f.description || "",
              }))
            : [];

          // ✅ Convert screenshots to plain objects
          const screenshots = campaign.screenshots
            ? campaign.screenshots.map((s) => ({
                title: s.title || "",
                description: s.description || "",
                imageUrl: s.imageUrl || "",
              }))
            : [];

          const htmlContent = template({
            subject: campaign.subject,
            message: campaign.message.replace(/\n/g, "<br>"),
            ctaText: campaign.ctaText,
            ctaLink: campaign.ctaLink,
            headerImage: campaign.headerImage,
            logo: campaign.logo,
            features: features,
            screenshots: screenshots, // ✅ Pass screenshots
            unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe/${userRecord.userId}`,
            preferencesLink: `${process.env.FRONTEND_URL}/preferences`,
          });

          await sendEmail(userRecord.email, campaign.subject, htmlContent);
          batchSent++;
          console.log(`  ✅ Sent to ${userRecord.email}`);
        } catch (error) {
          batchFailed++;
          console.error(
            `  ❌ Failed to send to ${userRecord.email}: ${error.message}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const sentUsers = usersBatch.map((u) => ({
        userId: u.userId,
        email: u.email,
        sentAt: new Date(),
      }));

      campaign.sentToUsers.push(...sentUsers);
      campaign.pendingUsers = campaign.pendingUsers.slice(batchSize);
      campaign.sentCount += batchSent;
      campaign.failedCount += batchFailed;

      if (campaign.pendingUsers.length === 0) {
        campaign.status = "completed";
        campaign.completedAt = new Date();
        console.log(`✅ Campaign ${campaign.campaignName} COMPLETED!`);
      }

      await campaign.save();

      totalSent += batchSent;
      totalFailed += batchFailed;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 BROADCAST COMPLETE`);
    console.log(`${"=".repeat(60)}`);
    console.log(`✅ Successfully sent: ${totalSent}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`${"=".repeat(60)}\n`);

    res.status(200).json({
      success: true,
      message: "Daily campaign emails sent successfully",
      data: {
        totalSent,
        totalFailed,
        campaignsProcessed: activeCampaigns.length,
      },
    });
  } catch (error) {
    console.error("🔴 Campaign send error:", error);
    return next(new Apperror(error.message, 500));
  }
};

// ... rest of the controller remains the same

/**
 * @GET_CAMPAIGNS
 * @ROUTE /api/v1/admin/campaign/list
 * @ACCESS Private (Admin only)
 */
export const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await EmailCampaign.find()
      .populate("createdBy", "email fullName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @GET_CAMPAIGN_DETAILS
 * @ROUTE /api/v1/admin/campaign/:campaignId
 * @ACCESS Private (Admin only)
 */
export const getCampaignDetails = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    const campaign = await EmailCampaign.findById(campaignId).populate(
      "createdBy",
      "email fullName"
    );

    if (!campaign) {
      return next(new Apperror("Campaign not found", 404));
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @PAUSE_CAMPAIGN
 * @ROUTE /api/v1/admin/campaign/:campaignId/pause
 * @ACCESS Private (Admin only)
 */
export const pauseCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    const campaign = await EmailCampaign.findByIdAndUpdate(
      campaignId,
      { status: "paused" },
      { new: true }
    );

    if (!campaign) {
      return next(new Apperror("Campaign not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Campaign paused successfully",
      data: campaign,
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};

/**
 * @RESUME_CAMPAIGN
 * @ROUTE /api/v1/admin/campaign/:campaignId/resume
 * @ACCESS Private (Admin only)
 */
export const resumeCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    const campaign = await EmailCampaign.findByIdAndUpdate(
      campaignId,
      { status: "scheduled" },
      { new: true }
    );

    if (!campaign) {
      return next(new Apperror("Campaign not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Campaign resumed successfully",
      data: campaign,
    });
  } catch (error) {
    return next(new Apperror(error.message, 500));
  }
};
