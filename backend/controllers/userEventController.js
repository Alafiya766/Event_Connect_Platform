const db = require("../db");

// FETCH ALL EVENTS (for user dashboard)
exports.getAllEvents = (req, res) => {
  const sql = "SELECT * FROM events";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

// REGISTER USER FOR EVENT
exports.registerEvent = (req, res) => {
  const { user_id, event_id } = req.body;

  if (!user_id || !event_id) {
    return res.status(400).json({ message: "Missing inputs" });
  }

  const sql = "INSERT INTO registrations (user_id, event_id) VALUES (?, ?)";

  db.query(sql, [user_id, event_id], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.json({ message: "Already registered" });
      }
      return res.status(500).json({ error: err });
    }
    res.json({ message: "Registration successful" });
  });
};
