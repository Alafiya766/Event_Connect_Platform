const db = require("../db");

// GET all events (non-deleted) for browsing
exports.getAllEvents = (req, res) => {
  db.query(
    "SELECT * FROM events WHERE is_deleted=0 ORDER BY event_date ASC",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};

// GET user's PAID (confirmed) registrations
exports.getUserRegistrations = (req, res) => {
  const { user_id } = req.params;
  const sql = `
    SELECT e.*, r.reg_date, r.payment_status
    FROM registrations r
    JOIN events e ON r.event_id = e.event_id
    WHERE r.user_id=? AND r.payment_status='PAID' AND e.is_deleted=0
    ORDER BY e.event_date ASC
  `;
  db.query(sql, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
