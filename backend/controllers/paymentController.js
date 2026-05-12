const crypto = require("crypto");
const db = require("../db");
const Razorpay = require("razorpay");
const { sendPaymentEmails } = require("./emailController");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

/* ─────────────────────────────────────────────
   CREATE ORDER  →  save PENDING payment in DB
   ───────────────────────────────────────────── */
exports.createOrder = async (req, res) => {
  try {
    const { user_id, event_id, amount } = req.body;

    if (!user_id || !event_id || amount === undefined)
      return res.status(400).json({ error: "Missing required fields" });

    // Validate event exists
    const [events] = await db.promise().query(
      "SELECT event_id, price FROM events WHERE event_id=? AND is_deleted=0",
      [event_id]
    );
    if (!events.length)
      return res.status(404).json({ error: "Event not found" });

    // Validate that a PENDING registration exists (created by /register)
    const [regs] = await db.promise().query(
      "SELECT reg_id FROM registrations WHERE user_id=? AND event_id=? AND payment_status IN ('PENDING','FAILED')",
      [user_id, event_id]
    );
    if (!regs.length)
      return res.status(400).json({ error: "No pending registration found. Please register first." });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1,
    });

    // Upsert payment record (PENDING)
    const [existing] = await db.promise().query(
      "SELECT payment_id FROM payments WHERE user_id=? AND event_id=? AND status='PENDING'",
      [user_id, event_id]
    );

    if (existing.length) {
      await db.promise().query(
        "UPDATE payments SET razorpay_order_id=?, amount=? WHERE payment_id=?",
        [order.id, amount, existing[0].payment_id]
      );
    } else {
      await db.promise().query(
        "INSERT INTO payments (user_id, event_id, amount, status, razorpay_order_id) VALUES (?,?,?,?,?)",
        [user_id, event_id, amount, "PENDING", order.id]
      );
    }

    res.json({ ...order });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ─────────────────────────────────────────────
   VERIFY PAYMENT  →  confirm registration
   ───────────────────────────────────────────── */
exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, user_id, event_id, email } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature)
    return res.status(400).json({ error: "Missing payment verification fields" });

  // 1. Verify HMAC signature (backend validation — cannot be faked)
  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature !== razorpay_signature) {
    // Mark payment and registration as FAILED
    await db.promise().query(
      "UPDATE payments SET status='FAILED' WHERE razorpay_order_id=?",
      [razorpay_order_id]
    ).catch(() => {});

    if (user_id && event_id) {
      await db.promise().query(
        "UPDATE registrations SET payment_status='FAILED' WHERE user_id=? AND event_id=?",
        [user_id, event_id]
      ).catch(() => {});
    }

    return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
  }

  // 2. Signature valid → update payment to SUCCESS
  try {
    await db.promise().query(
      "UPDATE payments SET status='SUCCESS', razorpay_payment_id=? WHERE razorpay_order_id=?",
      [razorpay_payment_id, razorpay_order_id]
    );

    // 3. Confirm registration (mark PAID) — CRITICAL step
    if (user_id && event_id) {
      await db.promise().query(
        "UPDATE registrations SET payment_status='PAID' WHERE user_id=? AND event_id=?",
        [user_id, event_id]
      );
    } else {
      // Fallback: resolve user/event from payment record
      const [pRows] = await db.promise().query(
        "SELECT user_id, event_id FROM payments WHERE razorpay_order_id=?",
        [razorpay_order_id]
      );
      if (pRows.length) {
        await db.promise().query(
          "UPDATE registrations SET payment_status='PAID' WHERE user_id=? AND event_id=?",
          [pRows[0].user_id, pRows[0].event_id]
        );
      }
    }

    // 4. Send confirmation emails (non-blocking)
    try {
      const [rows] = await db.promise().query(`
        SELECT
          p.amount,
          u.name  AS user_name,
          u.email AS user_email,
          e.title AS event_name,
          e.event_date,
          e.location,
          o.name  AS organizer_name,
          o.email AS organizer_email
        FROM payments p
        JOIN users  u ON p.user_id       = u.user_id
        JOIN events e ON p.event_id      = e.event_id
        JOIN users  o ON e.organizer_id  = o.user_id
        WHERE p.razorpay_order_id = ?
      `, [razorpay_order_id]);

      if (rows.length) {
        const d = rows[0];
        await sendPaymentEmails({
          user:      { name: d.user_name,      email: d.user_email },
          organizer: { name: d.organizer_name, email: d.organizer_email },
          event:     { name: d.event_name, date: d.event_date, location: d.location },
          amount: d.amount,
        });
      }
    } catch (mailErr) {
      console.error("Email error (non-critical):", mailErr.message);
    }

    return res.json({ success: true, message: "Payment verified. Registration confirmed." });

  } catch (err) {
    console.error("verifyPayment error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* ─────────────────────────────────────────────
   PAYMENT FAILED WEBHOOK (called by frontend on failure)
   ───────────────────────────────────────────── */
exports.markPaymentFailed = async (req, res) => {
  const { razorpay_order_id, user_id, event_id } = req.body;

  try {
    if (razorpay_order_id) {
      await db.promise().query(
        "UPDATE payments SET status='FAILED' WHERE razorpay_order_id=?",
        [razorpay_order_id]
      );
    }
    if (user_id && event_id) {
      await db.promise().query(
        "UPDATE registrations SET payment_status='FAILED' WHERE user_id=? AND event_id=?",
        [user_id, event_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
