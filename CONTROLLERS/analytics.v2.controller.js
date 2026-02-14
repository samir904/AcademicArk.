// controllers/analytics.controller.js

import Session from "../MODELS/Session.model.js";
import PageView from "../MODELS/PageView.model.js";
import Event from "../MODELS/Event.model.js";
import mongoose from "mongoose";

export const getAnalyticsOverview = async (req, res) => {
  try {

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalSessions,
      activeSessions,
      avgDuration,
      totalPageViews,
      totalEvents
    ] = await Promise.all([

      Session.countDocuments(),

      Session.countDocuments({
        startedAt: { $gte: last24Hours }
      }),

      Session.aggregate([
        { $match: { duration: { $ne: null } } },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: "$duration" }
          }
        }
      ]),

      PageView.countDocuments(),

      Event.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSessions,
        activeSessions,
        avgSessionDuration: avgDuration[0]?.avgDuration || 0,
        totalPageViews,
        totalEvents
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getTrafficSources = async (req, res) => {
  try {

    const sources = await Session.aggregate([
      {
        $group: {
          _id: "$referrerType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: sources
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getDeviceStats = async (req, res) => {
  try {

    const devices = await Session.aggregate([
      {
        $group: {
          _id: "$device.type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: devices
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getExitPages = async (req, res) => {
  try {

    const exits = await Session.aggregate([
      {
        $match: { exitPage: { $ne: null } }
      },
      {
        $group: {
          _id: "$exitPage",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: exits
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getPageEngagement = async (req, res) => {
  try {

    const pages = await PageView.aggregate([
      {
        $group: {
          _id: "$path",
          avgTime: { $avg: "$timeSpent" },
          avgScroll: { $avg: "$scrollDepth" },
          views: { $sum: 1 }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 15 }
    ]);

    res.status(200).json({
      success: true,
      data: pages
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getPreviewToDownloadFunnel = async (req, res) => {
  try {

    const previewCount = await Event.countDocuments({
      type: "PREVIEW_START"
    });

    const downloadCount = await Event.countDocuments({
      type: "DOWNLOAD_SUCCESS"
    });

    res.status(200).json({
      success: true,
      data: {
        previewCount,
        downloadCount,
        conversionRate: previewCount
          ? ((downloadCount / previewCount) * 100).toFixed(2)
          : 0
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getSessions = async (req, res) => {
  try {

    const sessions = await Session.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: sessions
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};


export const getSessionDetails = async (req, res) => {
  try {

    const { id } = req.params;

    const session = await Session.findOne({ sessionId: id });

    if (!session) {
      return res.status(404).json({ success: false });
    }

    const pageViews = await PageView.find({ sessionId: id });
    const events = await Event.find({ sessionId: id });

    res.status(200).json({
      success: true,
      data: {
        session,
        pageViews,
        events
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};
