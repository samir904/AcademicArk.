import { Schema,model } from "mongoose";

const NotificationBannerSchema =new Schema({
    title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  visible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional: auto-hide or auto-delete after this time
}, { timestamps: true });

export default model('NotificationBanner', NotificationBannerSchema);
