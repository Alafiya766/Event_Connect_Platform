const db = require("../db");

exports.getEvents = (req, res) => {
  db.query("SELECT * FROM events", (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json(result);
  });
};

//for create event
exports.createEvent = (req, res) => {
  const { title, description, event_date, location, price, organizer_id } = req.body;

  if (!title || !description || !event_date || !location || !price || !organizer_id) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  const sql = "INSERT INTO events (title, description, event_date, location, price, organizer_id) VALUES (?,?,?,?,?,?)";

  db.query(sql, [title, description, event_date, location, price, organizer_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err });

    res.json({
      success: true,
      message: "Event created successfully",
      event_id: result.insertId
    });
  });
};

//for delete event
exports.deleteEvent = (req, res) => {
  db.query("DELETE FROM events WHERE event_id = ?", [req.params.event_id], (err) => {
    if (err) return res.status(500).json({ error: err });

    res.json({ success: true, message: "Event deleted successfully" });
  });
};

//stats for organizer dashboard
exports.getOrganizerStats = async (req, res) => {
  const organizerId = req.params.organizerId;

  try {
    // Use PROMISE VERSION
    const [events] = await db.promise().query(
      "SELECT COUNT(*) AS totalEvents FROM events WHERE organizer_id = ?",
      [organizerId]
    );

    const [registrations] = await db.promise().query(
      `SELECT COUNT(*) AS totalRegistrations 
       FROM registrations r 
       JOIN events e ON r.event_id = e.event_id
       WHERE e.organizer_id = ?`,
      [organizerId]
    );

    const [payments] = await db.promise().query(
      `SELECT COALESCE(SUM(p.amount), 0) AS totalPayments 
       FROM payments p 
       JOIN events e ON p.event_id = e.event_id
       WHERE e.organizer_id = ?`,
      [organizerId]
    );

    res.json({
      totalEvents: events[0].totalEvents,
      totalRegistrations: registrations[0].totalRegistrations,
      totalPayments: payments[0].totalPayments
    });

  } catch (err) {
    console.error("Error loading organizer stats:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
};

// New: Get registration counts per event for organizer (for chart)
exports.getEventRegistrations = async (req, res) => {
  const organizerId = req.params.organizerId;

  try {
    const [results] = await db.promise().query(
      `SELECT e.event_id, e.title, COUNT(r.reg_id) AS registrations
       FROM events e
       LEFT JOIN registrations r ON e.event_id = r.event_id
       WHERE e.organizer_id = ?
       GROUP BY e.event_id
       ORDER BY e.event_id`,
      [organizerId]
    );

    res.json(results);
  } catch (err) {
    console.error("Error loading event registrations:", err);
    res.status(500).json({ error: "Failed to load event registrations" });
  }
};