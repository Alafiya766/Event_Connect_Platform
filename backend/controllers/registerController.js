const db = require("../db");
exports.registerForEvent = (req,res)=>{
  const {user_id,event_id} = req.body;
  if(!user_id || !event_id) return res.status(400).json({error: "user_id and event_id are required"});

  const checkQuery = "SELECT * FROM registrations WHERE user_id=? AND event_id=?";
  db.query(checkQuery, [user_id, event_id], (err, result) => {
    if(err) return res.status(500).json(err);
    if(result.length > 0) return res.status(400).json({error: "Already registered"});

    const insertQuery = "INSERT INTO registrations (user_id,event_id) VALUES (?,?)";
    db.query(insertQuery, [user_id, event_id], (err, result) => {
      if(err) return res.status(500).json(err);
      res.json({message: "Registered successfully"});
    });
  });
};

