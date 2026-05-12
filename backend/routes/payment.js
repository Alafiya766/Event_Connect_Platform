const express = require("express");
const router  = express.Router();
const { createOrder, verifyPayment, markPaymentFailed } = require("../controllers/paymentController");

router.post("/create",  createOrder);
router.post("/verify",  verifyPayment);
router.post("/failed",  markPaymentFailed);

module.exports = router;
