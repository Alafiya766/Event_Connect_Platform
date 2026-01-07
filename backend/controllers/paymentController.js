const crypto = require("crypto");
const db = require("../db");
const Razorpay = require("razorpay");
const { sendPaymentEmails } = require("./emailController");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

//  Create Razorpay order & save payment as PENDING
exports.createOrder = async (req, res) => {
    try {
        const { user_id, event_id, amount } = req.body;

        if (!user_id || !event_id || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // in paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            payment_capture: 1,
        });

        // Save order in DB with PENDING status
        db.query(
            "INSERT INTO payments (user_id, event_id, amount, status, razorpay_order_id) VALUES (?,?,?,?,?)",
            [user_id, event_id, amount, "PENDING", order.id],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                // Send Razorpay order details and DB payment ID to frontend
                res.json({ ...order, db_payment_id: result.insertId });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ---------------------------
//   Verify Razorpay Payment
// ---------------------------
exports.verifyPayment = (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    email
  } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  // Signature mismatch
  if (generated_signature !== razorpay_signature) {
    db.query(
      "UPDATE payments SET status='FAILED' WHERE razorpay_order_id=?",
      [razorpay_order_id]
    );
    return res.status(400).json({ success: false, message: "Payment verification failed" });
  }

  // Signature valid → mark payment SUCCESS
  db.query(
    "UPDATE payments SET status='SUCCESS', razorpay_payment_id=? WHERE razorpay_order_id=?",
    [razorpay_payment_id, razorpay_order_id],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      try {
        // Fetch payment + event + organizer + user
        const [rows] = await db.promise().query(`
          SELECT 
            p.amount,
            u.name AS user_name,
            u.email AS user_email,
            e.title AS event_name,
            e.event_date,
            e.location,
            o.name AS organizer_name,
            o.email AS organizer_email
          FROM payments p
          JOIN users u ON p.user_id = u.user_id
          JOIN events e ON p.event_id = e.event_id
          JOIN users o ON e.organizer_id = o.user_id
          WHERE p.razorpay_order_id = ?
        `, [razorpay_order_id]);

        if (!rows.length) {
          return res.status(404).json({ error: "Payment record not found" });
        }

        const data = rows[0];

        // Send confirmation emails
        await sendPaymentEmails({
          user: { name: data.user_name, email: data.user_email },
          organizer: { name: data.organizer_name, email: data.organizer_email },
          event: {
            name: data.event_name,
            date: data.event_date,
            location: data.location
          },
          amount: data.amount
        });

        return res.json({ success: true });

      } catch (mailErr) {
        console.error("Email error:", mailErr);
        return res.json({
          success: true,
          warning: "Payment successful but email failed"
        });
      }
    }
  );
};
