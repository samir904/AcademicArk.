import { Schema, model } from "mongoose";

const paywallEventSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false, // allow anonymous tracking later
        index: true
    },

    noteId: {
        type: Schema.Types.ObjectId,
        ref: "Note",
        required: false,
        index: true
    },

    eventType: {
        type: String,
        enum: [
            "LOCK_VIEWED",
            "LOCK_DOWNLOAD_ATTEMPT",    // user tried downloading locked note
            "PREVIEW_STARTED",
            "PREVIEW_ENDED",
            "PAYWALL_SHOWN",
            "PAYWALL_DISMISSED",        // user closed modal
            "SUPPORT_CLICKED",
            "SUPPORT_VIEWED",//support page viewed
            "SUPPORT_DISMISSED",        // user ignored support CTA
            "PAYMENT_STARTED",
            "PAYMENT_SUCCESS",
            "PREVIEW_SUPPORT_CLICKED",

            "DOWNLOAD_LIMIT_SUPPORT_CLICKED",
            "DOWNLOAD_LIMIT_DISMISSED"
        ],
        required: true,
        index: true
    },

    metadata: {
        type: Object,
        default: {}
    }

}, { timestamps: true });

// 🔥 For funnel queries
paywallEventSchema.index({ eventType: 1, createdAt: -1 });
paywallEventSchema.index({ userId: 1, createdAt: -1 });

const PaywallEvent = model("PaywallEvent", paywallEventSchema);

export default PaywallEvent;
