const express = require("express");
const router = express.Router();
const { getAllEvents, registerEvent } = require("../controllers/userEventController");

// All Events for User Dashboard
router.get("/", getAllEvents);

// User Registers for Event
router.post("/register", registerEvent);

module.exports = router;
