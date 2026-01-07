const express = require("express");
const router = express.Router();
const { registerForEvent } = require("../controllers/registerController");

router.post("/", registerForEvent);
module.exports = router;
