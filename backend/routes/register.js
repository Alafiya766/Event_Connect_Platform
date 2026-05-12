const express = require("express");
const router  = express.Router();
const { registerForEvent, getRegistrationStatus } = require("../controllers/registerController");

router.post("/",                          registerForEvent);
router.get("/status/:user_id/:event_id",  getRegistrationStatus);

module.exports = router;
