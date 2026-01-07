const express = require("express");
const router = express.Router();
const { getEvents, createEvent, deleteEvent, getOrganizerStats, getEventRegistrations} = require("../controllers/eventController");

router.get("/", getEvents);
router.post("/create", createEvent);
router.delete("/:event_id", deleteEvent);
router.get("/stats/:organizerId", getOrganizerStats);
router.get("/registrations/:organizerId", getEventRegistrations);

module.exports = router;
