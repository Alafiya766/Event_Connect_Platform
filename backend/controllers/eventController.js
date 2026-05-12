const db = require("../db");

/* ─────────────────────────────────────────────
   GET ALL EVENTS (exclude soft-deleted)
   ───────────────────────────────────────────── */
exports.getEvents = (req, res) => {
  db.query(
    "SELECT * FROM events WHERE is_deleted = 0 ORDER BY event_date ASC",
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json(result);
    }
  );
};

/* ─────────────────────────────────────────────
   CREATE EVENT
   ───────────────────────────────────────────── */
exports.createEvent = (req, res) => {
  const { title, description, event_date, location, price, organizer_id, category, capacity } = req.body;

  if (!title || !description || !event_date || !location || price === undefined || !organizer_id)
    return res.status(400).json({ success: false, message: "All required fields must be provided" });

  const sql = `
    INSERT INTO events (title, description, event_date, location, price, organizer_id, category, capacity)
    VALUES (?,?,?,?,?,?,?,?)
  `;
  db.query(sql, [title, description, event_date, location, price, organizer_id, category || "Other", capacity || null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Event created successfully", event_id: result.insertId });
    }
  );
};

/* ─────────────────────────────────────────────
   DELETE EVENT  – hard delete + cascade
   All registrations & payments are CASCADE deleted
   by the DB foreign keys.
   ───────────────────────────────────────────── */
exports.deleteEvent = async (req, res) => {
  const { event_id } = req.params;
  if (!event_id) return res.status(400).json({ error: "event_id is required" });

  try {
    // Verify event exists
    const [check] = await db.promise().query(
      "SELECT event_id, organizer_id FROM events WHERE event_id=? AND is_deleted=0",
      [event_id]
    );
    if (!check.length) return res.status(404).json({ error: "Event not found" });

    // Hard delete (CASCADE handles registrations + payments via FK)
    await db.promise().query("DELETE FROM events WHERE event_id=?", [event_id]);

    res.json({ success: true, message: "Event and all associated data deleted successfully" });
  } catch (err) {
    console.error("deleteEvent error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ─────────────────────────────────────────────
   ORGANIZER STATS
   Revenue = only SUCCESS payments
   Registrations = only PAID registrations
   ───────────────────────────────────────────── */
exports.getOrganizerStats = async (req, res) => {
  const organizerId = req.params.organizerId;
  try {
    const [events] = await db.promise().query(
      "SELECT COUNT(*) AS totalEvents FROM events WHERE organizer_id=? AND is_deleted=0",
      [organizerId]
    );

    // Only count confirmed (PAID) registrations
    const [registrations] = await db.promise().query(
      `SELECT COUNT(*) AS totalRegistrations
       FROM registrations r
       JOIN events e ON r.event_id = e.event_id
       WHERE e.organizer_id=? AND e.is_deleted=0 AND r.payment_status='PAID'`,
      [organizerId]
    );

    // Only sum SUCCESS payments
    const [payments] = await db.promise().query(
      `SELECT COALESCE(SUM(p.amount), 0) AS totalPayments
       FROM payments p
       JOIN events e ON p.event_id = e.event_id
       WHERE e.organizer_id=? AND e.is_deleted=0 AND p.status='SUCCESS'`,
      [organizerId]
    );

    // Revenue per event (for chart)
    const [revenuePerEvent] = await db.promise().query(
      `SELECT e.event_id, e.title,
              COALESCE(SUM(p.amount),0) AS revenue,
              COUNT(p.payment_id) AS paid_count
       FROM events e
       LEFT JOIN payments p ON e.event_id = p.event_id AND p.status='SUCCESS'
       WHERE e.organizer_id=? AND e.is_deleted=0
       GROUP BY e.event_id
       ORDER BY e.event_date ASC`,
      [organizerId]
    );

    res.json({
      totalEvents:         events[0].totalEvents,
      totalRegistrations:  registrations[0].totalRegistrations,
      totalPayments:       payments[0].totalPayments,
      revenuePerEvent,
    });
  } catch (err) {
    console.error("getOrganizerStats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
};

/* ─────────────────────────────────────────────
   REGISTRATIONS PER EVENT (for chart)
   Only PAID registrations counted
   ───────────────────────────────────────────── */
exports.getEventRegistrations = async (req, res) => {
  const organizerId = req.params.organizerId;
  try {
    const [results] = await db.promise().query(
      `SELECT e.event_id, e.title,
              COUNT(r.reg_id) AS registrations,
              COALESCE(SUM(p.amount),0) AS revenue
       FROM events e
       LEFT JOIN registrations r ON e.event_id = r.event_id AND r.payment_status='PAID'
       LEFT JOIN payments p ON e.event_id = p.event_id AND p.status='SUCCESS'
       WHERE e.organizer_id=? AND e.is_deleted=0
       GROUP BY e.event_id
       ORDER BY e.event_date ASC`,
      [organizerId]
    );
    res.json(results);
  } catch (err) {
    console.error("getEventRegistrations error:", err);
    res.status(500).json({ error: "Failed to load event registrations" });
  }
};
