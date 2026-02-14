import { v4 as uuidv4 } from "uuid";
import Session from "../MODELS/Session.model.js";
import Event from "../MODELS/Event.model.js";
import PageView from "../MODELS/PageView.model.js";

export const startSession = async (req, res, next) => {
    try {
        const sessionId = uuidv4();

        const {
            device,
            os,
            browser,
            referrer,
            entryPage,
            utm
        } = req.body;

        const userId = req.user?._id || null;

        const session = await Session.create({
            sessionId,
            userId,
            device,
            os,
            browser,
            referrer: referrer || "direct",
            entryPage,
            utm,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            sessionId
        });

    } catch (err) {
        console.log("SESSION ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};


export const endSession = async (req, res) => {
    try {
        const { sessionId, exitPage } = req.body;

        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false });

        const endedAt = new Date();
        const duration = endedAt - session.startedAt;

        session.endedAt = endedAt;
        session.duration = duration;
        session.exitPage = exitPage;

        await session.save();

        res.status(200).json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};



export const trackPageView = async (req, res) => {
    try {
        const { sessionId, path, from } = req.body;

        await PageView.create({
            sessionId,
            userId: req.user?._id || null,
            path,
            from,
            entryAt: new Date()
        });

        // Also update exitPage in Session
        await Session.updateOne(
            { sessionId },
            { exitPage: path }
        );

        res.status(200).json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};



export const trackEvent = async (req, res) => {
    try {
        const { sessionId, type, metadata, page } = req.body;

        await Event.create({
            sessionId,
            userId: req.user?._id || null,
            type,
            metadata,
            page
        });

        res.status(200).json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false });
    }
};


export const trackPageExit = async (req, res) => {
  try {
    const { sessionId, path, timeSpent, scrollDepth } = req.body;

    await PageView.findOneAndUpdate(
      { sessionId, path },
      {
        $set: {
          timeSpent,
          scrollDepth,
          exitAt: new Date()
        }
      }
    );

    res.status(200).end();
  } catch (err) {
    res.status(200).end(); // never block beacon
  }
};
