import cashfreeClient from "../CONFIG/cashfreeClient.js";
import Payment from "../MODELS/payment.model.js";
import Plan from "../MODELS/plan.model.js";
import User from "../MODELS/user.model.js";


export const createCashfreeOrder = async (req, res) => {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
        return res.status(400).json({
            success: false,
            message: "planId is required"
        });
    }

    // 1️⃣ Fetch plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
        return res.status(400).json({
            success: false,
            message: "Invalid or inactive plan"
        });
    }

    // 2️⃣ Create orderId
    const orderId = `AA_${Date.now()}_${userId}`;

    // 3️⃣ Save payment (CREATED)
    await Payment.create({
        user: userId,
        planType: plan.code,
        amount: plan.price,
        orderId,
        status: "CREATED"
    });

    // 4️⃣ Create Cashfree order (REST)
    const { data } = await cashfreeClient.post("/orders", {
        order_id: orderId,
        order_amount: plan.price,
        order_currency: "INR",

        customer_details: {
            customer_id: userId.toString(),
            customer_email: req.user.email,
            customer_phone: "9999999999"
        },

        order_meta: {
            return_url: `${process.env.FRONTEND_URL}/payment-success?order_id={order_id}`
        },

        order_note: "AcademicArk Support"
    });


    console.log("✅ PAYMENT SESSION ID:", data.payment_session_id);

    // 5️⃣ Send ONLY session id to frontend
    res.status(200).json({
        success: true,
        paymentSessionId: data.payment_session_id
    });
};
export const cashfreeWebhook = async (req, res) => {
  try {
    console.log("🔥 CASHFREE WEBHOOK HIT");
    console.log(JSON.stringify(req.body, null, 2));

    const payload = req.body;
    const eventType = payload.type;
console.log("📨 EVENT TYPE:", eventType);

    // ✅ Ignore test webhooks safely
    if (!payload?.data?.order || !payload?.data?.payment) {
      console.log("ℹ️ Test webhook received, skipping");
      return res.sendStatus(200);
    }

    const orderId = payload.data.order.order_id;
    const paymentStatus = payload.data.payment.payment_status;
    const cfPaymentId = payload.data.payment.cf_payment_id;

    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.sendStatus(200);

    payment.status = paymentStatus === "SUCCESS" ? "SUCCESS" : "FAILED";
    payment.paymentId = cfPaymentId;
    await payment.save();

    if (payment.status === "SUCCESS") {
      const user = await User.findById(payment.user);
      const plan = await Plan.findOne({ code: payment.planType });

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + plan.validityDays * 24 * 60 * 60 * 1000
      );

      user.access = {
        plan: plan._id,
        startsAt: now,
        expiresAt,
        dailyDownloadLimit: plan.dailyDownloadLimit,
        downloadsToday: 0,
        lastDownloadDate: null,
        paymentId: payment._id
      };

      await user.save();
      console.log("✅ USER ACCESS GRANTED");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Cashfree webhook error:", err.message);
    res.sendStatus(200);
  }
};

export const getPaymentStatus = async (req, res) => {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ orderId });

    if (!payment) {
        return res.status(404).json({
            success: false,
            message: "Payment not found"
        });
    }

    res.status(200).json({
        success: true,
        status: payment.status
    });
};
