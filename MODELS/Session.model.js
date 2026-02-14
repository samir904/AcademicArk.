// models/Session.js
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        // =========================
        // Identity
        // =========================
        sessionId: {
            type: String,
            required: true,
            index: true,
            unique: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        // =========================
        // Time
        // =========================
        startedAt: {
            type: Date,
            required: true,
            default: Date.now
        },

        endedAt: {
            type: Date,
            default: null
        },

        duration: {
            type: Number, // milliseconds
            default: null
        },

        // =========================
        // Device & Environment
        // =========================
        device: {
            type: {
                type: String,
                enum: ["mobile", "desktop", "tablet"],
                default: "desktop"
            },
            brand: {
                type: String,
                default: ""
            }
        },

        os: {
            name: { type: String, default: "" },
            version: { type: String, default: "" }
        },

        browser: {
            name: { type: String, default: "" },
            version: { type: String, default: "" }
        },

        // =========================
        // Network
        // =========================
        ip: {
            type: String,
            required: true
        },

        country: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        // =========================
        // Traffic / Entry Context
        // =========================
        referrer: {
            type: String,
            default: "direct"
        },

        referrerType: {
            type: String,
            enum: ["google", "whatsapp", "direct", "other"],
            default: "direct",
            index: true
        },
        utm: {
            source: String,   // whatsapp, google
            medium: String,   // share, organic
            campaign: String  // dbms_pyq
        },
        entryPage: {
            type: String,
            required: true
        },
        exitPage: {
            type: String,
            default: null
        },
    },
    { timestamps: true }
);

export default mongoose.model("Session", sessionSchema);
