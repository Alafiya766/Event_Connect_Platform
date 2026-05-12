const express = require("express");
const router  = express.Router();
const { getAllEvents, getUserRegistrations } = require("../controllers/userEventController");

router.get("/",          getAllEvents);
router.get("/:user_id",  getUserRegistrations);

module.exports = router;
