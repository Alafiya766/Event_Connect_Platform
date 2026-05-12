const express = require("express");
const router  = express.Router();
const {
  getEvents, createEvent, deleteEvent,
  getOrganizerStats, getEventRegistrations
} = require("../controllers/eventController");

// Static routes MUST come before /:event_id to avoid Express matching "stats" as an ID
router.get("/",                            getEvents);
router.post("/create",                     createEvent);
router.get("/stats/:organizerId",          getOrganizerStats);
router.get("/registrations/:organizerId",  getEventRegistrations);
router.delete("/:event_id",               deleteEvent);

module.exports = router;
