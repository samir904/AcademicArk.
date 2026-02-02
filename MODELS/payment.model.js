import { Schema, model } from "mongoose";

const paymentSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  planType: {
    type: String,
    enum: ["SEMESTER_SUPPORT", "EXAM_BOOST"],
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: "INR"
  },

  orderId: {
    type: String,
    required: true,
    unique: true
  },

  paymentId: {
    type: String
  },

  status: {
    type: String,
    enum: ["CREATED", "SUCCESS", "FAILED"],
    default: "CREATED"
  },

  gateway: {
    type: String,
    default: "CASHFREE"
  },

  rawResponse: {
    type: Object
  }
}, { timestamps: true });

export default model("Payment", paymentSchema);
