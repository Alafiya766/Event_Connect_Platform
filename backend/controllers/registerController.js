const db = require("../db");

/**
 * POST /register
 * Creates a PENDING registration.
 * Registration is only confirmed (PAID) after payment verification.
 */
exports.registerForEvent = (req, res) => {
  const { user_id, event_id } = req.body;
  if (!user_id || !event_id)
    return res.status(400).json({ error: "user_id and event_id are required" });

  // Check event exists and is not deleted
  db.query(
    "SELECT event_id, price FROM events WHERE event_id = ? AND is_deleted = 0",
    [event_id],
    (err, events) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!events.length) return res.status(404).json({ error: "Event not found" });

      const event = events[0];

      // Check for existing registration
      db.query(
        "SELECT reg_id, payment_status FROM registrations WHERE user_id = ? AND event_id = ?",
        [user_id, event_id],
        (err2, existing) => {
          if (err2) return res.status(500).json({ error: err2.message });

          if (existing.length > 0) {
            const reg = existing[0];
            if (reg.payment_status === "PAID") {
              return res.status(400).json({ error: "Already registered and paid for this event" });
            }
            // Existing PENDING/FAILED reg → return it so payment can proceed
            return res.json({
              message: "Registration pending payment",
              reg_id: reg.reg_id,
              status: reg.payment_status,
              requiresPayment: event.price > 0,
              price: event.price,
            });
          }

          // Insert PENDING registration
          db.query(
            "INSERT INTO registrations (user_id, event_id, payment_status) VALUES (?, ?, 'PENDING')",
            [user_id, event_id],
            (err3, result) => {
              if (err3) return res.status(500).json({ error: err3.message });

              // Free events are immediately PAID
              if (Number(event.price) === 0) {
                db.query(
                  "UPDATE registrations SET payment_status='PAID' WHERE reg_id=?",
                  [result.insertId]
                );
                return res.json({
                  message: "Registered successfully (free event)",
                  reg_id: result.insertId,
                  requiresPayment: false,
                });
              }

              // Paid events need payment step
              return res.json({
                message: "Registration created. Please complete payment.",
                reg_id: result.insertId,
                requiresPayment: true,
                price: event.price,
              });
            }
          );
        }
      );
    }
  );
};

/**
 * GET /register/status/:user_id/:event_id
 * Returns payment_status for a user's registration.
 */
exports.getRegistrationStatus = (req, res) => {
  const { user_id, event_id } = req.params;
  db.query(
    "SELECT reg_id, payment_status FROM registrations WHERE user_id=? AND event_id=?",
    [user_id, event_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.json({ registered: false });
      res.json({ registered: true, ...rows[0] });
    }
  );
};
