const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment } = require("../controllers/paymentController");

router.post("/create", createOrder);
router.post("/verify", verifyPayment);

module.exports = router;
